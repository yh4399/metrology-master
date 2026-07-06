# 台账导入出厂编号冲突检测与处理 — 设计文档

## 1. 概述

当前 Excel 台账导入流程（`POST /api/instruments/import/confirm`）对每行数据一律执行 `Instrument.createWithHistory()` **新建**记录，不检查导入数据中的出厂编号是否与系统现有记录冲突。这导致：

1. **重复记录**：同一出厂编号的器具被多次导入，数据库中出现多条重复（当前数据库已有 210 条中大量重复编号）
2. **数据割裂**：用户在台账模板中更新了信息（如换了证书），导入后变成新增而非更新，原有记录仍存在
3. **历史丢失**：原器具的变更历史、照片、证书附件等与新记录无法关联

## 2. 核心原则

- **不静默覆盖** — 任何编号冲突必须通知用户，由用户主动选择处理策略
- **双向选择** — 用户可决定是"以台账为准"还是"以系统为准"
- **操作可追溯** — 所有冲突处理操作写入变更历史
- **原有流程不受影响** — 无冲突的数据行照常导入，不影响现有的导入体验

## 3. 解决方案

### 3.1 整体流程

```
用户上传 Excel → 解析 Sheet → 字段映射 → 点击"确认导入"
                                              │
                                              ▼
                              后端逐行处理前，先做冲突检测
                                              │
                          ┌───────────────────┤
                          ▼                   ▼
                    编号不冲突            编号冲突（serial_number
                  （直接新建）           在系统中已存在）
                          │                   │
                          ▼                   ▼
                    创建新记录        收集冲突信息，暂停导入
                                            │
                                            ▼
                                    返回冲突报告给前端
                                            │
                                    用户逐条选择处理策略
                                            │
                          ┌─────────┬─────────┬─────────┐
                          ▼         ▼         ▼         ▼
                      以台账为准  以系统为准  跳过      强制新建
                    （更新已有记录 （保留已有  （不导入  （创建新记录
                     并写入历史）  不更新）   该行）   允许重复编号）
```

### 3.2 关键设计决策

| 决策 | 理由 |
|------|------|
| 冲突检测在导入确认阶段（非上传/解析阶段） | 此时映射已完成，类别和字段对应关系已确定 |
| 冲突发生时**暂停**导入，返回冲突报告而非直接拒绝 | 给用户提供逐个处理的灵活性，而非"全有或全无" |
| 冲突处理作为独立 API（`/import/resolve-conflicts`） | 将检测和处理解耦，用户可分批处理冲突 |
| 使用 `updateWithHistory` 而非 `createWithHistory` 处理"以台账为准" | 保留原器具 ID、变更历史和关联文件 |

---

## 4. API 设计

### 4.1 修改 `POST /api/instruments/import/confirm`

在现有逻辑中增加冲突检测阶段。导入确认后：

**Step 1：冲突检测**

对每条待导入数据，在 `createWithHistory` 之前检查 `serial_number`：

```js
// 伪代码
const conflicts = [];
const okRows = [];

for (const row of rowsToImport) {
  if (row.serial_number) {
    const existing = await Instrument.findBySerialNo(row.serial_number);
    if (existing) {
      conflicts.push({
        importRow: { /* 导入的字段值 */ },
        existingRecord: { /* 系统中已有的字段值 */ },
        conflictFields: diffFields(row, existing) // 哪些字段不一致
      });
      continue;
    }
  }
  okRows.push(row);
}

// 如果无冲突 → 直接全部导入
if (conflicts.length === 0) {
  return importAll(okRows);
}

// 如果有冲突 → 先导入无冲突的行，返回冲突列表
const result = await importAll(okRows);
result.conflicts = conflicts;
result.conflictCount = conflicts.length;
result.needsResolution = true;
return res.json({ code: 200, data: result });
```

**Step 2：冲突详情结构**

```json
{
  "code": 200,
  "data": {
    "sheets": [...],
    "totalRows": 50,
    "successRows": 35,
    "failRows": 0,
    "needsResolution": true,
    "conflictCount": 15,
    "conflicts": [
      {
        "index": 0,
        "sourceSheet": "压力表",
        "sourceRow": 5,
        "importData": {
          "serial_number": "L230822750",
          "category": "普通压力表",
          "model": "Y-150",
          "manufacturer": "红旗仪表",
          "installation_location": "中心一号B平台",
          "inspection_date": "2026-05-18",
          "valid_until": "2027-05-17",
          "certificate_number": "YLB-Y-H1-ZX1-2026051801-L230822750",
          "range_min": 0,
          "range_max": 1.6,
          "range_unit": "MPa"
        },
        "existingRecord": {
          "id": 88,
          "serial_number": "L230822750",
          "category": "普通压力表",
          "model": "Y-150",
          "manufacturer": "红旗仪表",
          "installation_location": "中心一号B平台",
          "inspection_date": "2025-05-18",
          "valid_until": "2026-05-17",
          "certificate_number": "YLB-Y-H1-ZX1-2025051801-L230822750",
          "range_min": 0,
          "range_max": 1.6,
          "range_unit": "MPa"
        },
        "conflictFields": [
          {
            "field": "inspection_date",
            "label": "检验日期",
            "systemValue": "2025-05-18",
            "importValue": "2026-05-18"
          },
          {
            "field": "valid_until",
            "label": "有效日期",
            "systemValue": "2026-05-17",
            "importValue": "2027-05-17"
          },
          {
            "field": "certificate_number",
            "label": "证书编号",
            "systemValue": "YLB-Y-H1-ZX1-2025051801-L230822750",
            "importValue": "YLB-Y-H1-ZX1-2026051801-L230822750"
          }
        ]
      }
    ],
    "conflictFileData": {
      "fileName": "台账总表_2026.07.xlsx",
      "filePath": "uploads/xxx.xlsx",
      "sheetMappings": [...]
    }
  }
}
```

**关键字段说明**：
- `conflictFields`：仅列出**值不一致**的字段，完全相同的不列
- `conflictFileData`：保留所有导入上下文数据，以供冲突解决 API 使用
- `needsResolution`：前端据此决定是否进入冲突处理界面

### 4.2 新增 `POST /api/instruments/import/resolve-conflicts`

处理用户选择的冲突解决策略。

**Request:**
```json
{
  "filePath": "uploads/xxx.xlsx",
  "fileName": "台账总表_2026.07.xlsx",
  "sheetMappings": [...],
  "resolutions": [
    {
      "index": 0,
      "action": "update",      // "update" | "skip" | "keep" | "create_new"
      "importData": { ... },
      "existingId": 88,
      "updateFields": ["inspection_date", "valid_until", "certificate_number"]
    },
    {
      "index": 1,
      "action": "skip"
    },
    {
      "index": 2,
      "action": "keep"
    },
    {
      "index": 3,
      "action": "create_new",
      "importData": { ... }
    }
  ]
}
```

**actions 说明：**

| action | 含义 | 后端操作 |
|--------|------|---------|
| `update` | 以台账为准 — 更新已有记录 | `updateWithHistory(id, importData, { source: 'excel_import_overwrite' })` |
| `skip` | 跳过 — 不导入该行 | 不做任何操作 |
| `keep` | 以系统为准 — 保留已有记录不变 | 不做任何操作（仅在前端确认后返回计数） |
| `create_new` | 强制新建 — 允许重复编号 | `createWithHistory(importData, { source: 'excel_import' })` |

> 注：`skip` 和 `keep` 在后端层面行为相同（不做操作），但在前端 UI 上语义不同：skip 表示"这行数据先不处理"，keep 表示"在对比后决定保留系统数据"。

**Response:**
```json
{
  "code": 200,
  "data": {
    "updated": 8,
    "skipped": 3,
    "kept": 2,
    "created": 2,
    "totalProcessed": 15,
    "errors": []
  },
  "message": "冲突处理完成：更新 8 条，跳过 3 条，保留 2 条，新建 2 条"
}
```

### 4.3 新增 `POST /api/instruments/import/check-conflicts`

可选：允许用户在 Step 2（字段映射完成后）提前检测冲突，而不是等到 Step 4 才看到。

**Request:**
```json
{
  "filePath": "uploads/xxx.xlsx",
  "sheetMappings": [ { "sheetName": "压力表", "category": "普通压力表", "mapping": {...} } ]
}
```

**Response:** 与 4.1 的冲突检测结构相同，但不执行导入。

> 这是可选的增强。优先实现 4.1 + 4.2 的完整流程。

---

## 5. 后端实现细节

### 5.1 `server/routes/instruments.js` 修改

#### 5.1.1 `handleMultiSheetImport` 改造

当前逻辑：`逐行 applyMapping → createWithHistory → 计数`

改造为两阶段：

```js
async function handleMultiSheetImport(req, res, filePath, fileName, sheetMappings) {
  // ... 前面的表格解析逻辑不变 ...

  // === 阶段一：收集所有待导入数据 + 冲突检测 ===
  const allRows = [];      // { data, sheetName, rowNum }
  const conflicts = [];

  for (const sm of sheetMappings) {
    // ... 解析 Sheet、检测表头 ...

    for (let i = 0; i < dataRows.length; i++) {
      const { data, errors } = excelService.applyMapping(row, headers, sm.mapping, ...);
      // ... 过滤错误 ...

      if (!data.serial_number) {
        // 无编号的行照常导入（不参与冲突检测）
        allRows.push({ data, sheetName: sm.sheetName, rowNum: i, hasConflict: false });
        continue;
      }

      // 冲突检测
      const existing = await Instrument.findBySerialNo(String(data.serial_number));
      if (existing) {
        const conflictFields = buildConflictFields(data, existing);
        conflicts.push({
          index: conflicts.length,
          sourceSheet: sm.sheetName,
          sourceRow: headerRowIdx + i + 2,
          importData: data,
          existingRecord: sanitizeForResponse(existing),
          conflictFields
        });
      } else {
        allRows.push({ data, sheetName: sm.sheetName, rowNum: i, hasConflict: false });
      }
    }
  }

  // === 阶段二：处理 ===
  if (conflicts.length === 0) {
    // 无冲突：直接全部导入
    return importAllAndRespond(req, res, allRows, fileName, filePath);
  }

  // 有冲突：先导入无冲突的，返回冲突列表
  const result = await importRows(/* allRows only */);
  result.needsResolution = true;
  result.conflictCount = conflicts.length;
  result.conflicts = conflicts;
  result.conflictFileData = { fileName, filePath, sheetMappings };

  // ⚠️ 不删除临时 Excel 文件 — 冲突解决时需要重新读取
  // 记录导入日志（部分成功 + 待处理冲突）
  res.json({ code: 200, data: result });
}
```

#### 5.1.2 `handleResolveConflicts` 新增函数

```js
async function handleResolveConflicts(req, res) {
  const { filePath, fileName, sheetMappings, resolutions } = req.body;

  // 验证路径
  // ... (复用现有路径穿越校验)

  let updated = 0, skipped = 0, kept = 0, created = 0;
  const errors = [];

  for (const resolution of resolutions) {
    try {
      switch (resolution.action) {
        case 'update': {
          const updateData = { ...resolution.importData };
          delete updateData.serial_number; // 不更新编号（与系统保持一致）
          await Instrument.updateWithHistory(resolution.existingId, updateData, {
            source: 'excel_import_overwrite',
            operatorId: req.userId
          });
          updated++;
          break;
        }
        case 'create_new': {
          const data = { ...resolution.importData };
          await Instrument.createWithHistory(data, {
            source: 'excel_import',
            operatorId: req.userId
          });
          created++;
          break;
        }
        case 'skip':
          skipped++;
          break;
        case 'keep':
          kept++;
          break;
      }
    } catch (err) {
      errors.push({ index: resolution.index, error: err.message });
    }
  }

  // 清理临时文件（所有冲突处理完毕后）
  try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }

  res.json({
    code: 200,
    data: { updated, skipped, kept, created, totalProcessed: resolutions.length, errors }
  });
}
```

#### 5.1.3 `buildConflictFields` 辅助函数

```js
function buildConflictFields(importData, existingRecord) {
  const comparableFields = [
    { field: 'category', label: '类别' },
    { field: 'model', label: '型号' },
    { field: 'manufacturer', label: '生产厂家' },
    { field: 'installation_location', label: '安装位置' },
    { field: 'inspection_date', label: '检验日期' },
    { field: 'valid_until', label: '有效日期' },
    { field: 'certificate_number', label: '证书编号' },
    { field: 'range_min', label: '量程下限' },
    { field: 'range_max', label: '量程上限' },
    { field: 'range_unit', label: '量程单位' },
    { field: 'accuracy_class', label: '准确度' },
    { field: 'inspection_unit', label: '检定单位' },
    { field: 'department', label: '部门' },
    { field: 'status', label: '状态' },
  ];

  const conflicts = [];
  for (const { field, label } of comparableFields) {
    const sysVal = existingRecord[field];
    const impVal = importData[field];
    if (normalizeForCompare(sysVal) !== normalizeForCompare(impVal)) {
      conflicts.push({
        field, label,
        systemValue: sysVal ?? '',
        importValue: impVal ?? ''
      });
    }
  }
  return conflicts;
}

function normalizeForCompare(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return String(val);
  return String(val).trim();
}
```

#### 5.1.4 路由注册

在 `server/routes/instruments.js` 中注册（必须在 `/:id` 之前）：

```js
router.post('/import/resolve-conflicts', async (req, res) => {
  try {
    return handleResolveConflicts(req, res);
  } catch (err) {
    res.status(500).json({ code: 500, message: '冲突处理失败: ' + err.message });
  }
});

// 可选：提前检测
router.post('/import/check-conflicts', async (req, res) => {
  try {
    const { filePath, sheetMappings } = req.body;
    // 只做冲突检测，不导入
    const conflicts = await detectConflictsOnly(filePath, sheetMappings);
    res.json({ code: 200, data: { conflicts, conflictCount: conflicts.length } });
  } catch (err) {
    res.status(500).json({ code: 500, message: '冲突检测失败: ' + err.message });
  }
});
```

### 5.2 `server/models/instrument.js` 修改

`findBySerialNo` 已存在（返回单条），无需修改。但需要确认 `update` 方法支持 `certificate_file` 字段：

当前 `update()` 方法的 `fields` 数组不包含 `certificate_file`。需要在 update 的字段列表中添加：

```js
// instrument.js update() fields 数组添加：
'certificate_file'
```

### 5.3 `server/services/instrumentHistory.js` 修改

```js
// SOURCE_LABELS 新增：
'excel_import_overwrite': '台账导入覆盖',
```

---

## 6. 前端设计

### 6.1 导入流程改造（`ImportPage.vue`）

#### Step 4（导入完成）新增冲突处理界面

当 `importResult.needsResolution === true` 时，Step 4 不再是简单的"成功/失败"结果，而是**冲突处理界面**：

```vue
<!-- Step 4 分支 -->
<div v-if="importResult.needsResolution" class="conflict-resolution">
  <el-alert type="warning" :closable="false" show-icon style="margin-bottom:20px">
    <template #title>
      导入成功 {{ importResult.successRows }} 条，但有
      <strong>{{ importResult.conflictCount }} 条</strong> 数据的出厂编号与系统现有记录冲突
    </template>
    请逐条选择处理策略后点击"应用处理"。
  </el-alert>

  <!-- 批量操作工具栏 -->
  <div class="conflict-toolbar">
    <span style="font-size:14px;color:#606266;margin-right:12px">批量设置未处理的记录：</span>
    <el-button size="small" @click="batchSetAction('update')">
      全部 → 以台账为准
    </el-button>
    <el-button size="small" @click="batchSetAction('keep')">
      全部 → 以系统为准
    </el-button>
    <el-button size="small" @click="batchSetAction('skip')">
      全部 → 跳过
    </el-button>
    <el-tag type="info" size="small" style="margin-left:12px">
      已处理 {{ resolvedCount }} / {{ importResult.conflictCount }}
    </el-tag>
  </div>

  <!-- 冲突对比列表 -->
  <div class="conflict-list">
    <div v-for="(conflict, idx) in importResult.conflicts" :key="idx"
      class="conflict-card" :class="{ resolved: conflict._action }">
      <div class="conflict-card-header">
        <span class="conflict-index">#{{ idx + 1 }}</span>
        <el-tag size="small" type="warning">
          {{ conflict.sourceSheet }} / 第{{ conflict.sourceRow }}行
        </el-tag>
        <span class="conflict-serial">
          出厂编号：<code>{{ conflict.importData.serial_number }}</code>
        </span>
        <span class="conflict-existing-id" v-if="conflict.existingRecord">
          对应系统记录：<el-tag size="small" type="info">#{{ conflict.existingRecord.id }}</el-tag>
        </span>
      </div>

      <!-- 对比视图 -->
      <div class="conflict-compare">
        <div class="compare-side import-side">
          <div class="compare-label">
            <el-tag type="primary" size="small">📥 台账数据（导入）</el-tag>
          </div>
          <table class="compare-table">
            <tr v-for="field in conflict.conflictFields" :key="field.field">
              <td class="field-label">{{ field.label }}</td>
              <td class="field-value import-value">{{ field.importValue || '(空)' }}</td>
            </tr>
            <tr v-if="conflict.conflictFields.length === 0">
              <td colspan="2" style="color:#909399;text-align:center">
                所有字段与系统一致（仅创建时间等元数据不同）
              </td>
            </tr>
          </table>
        </div>

        <div class="compare-divider">
          <el-icon :size="20"><Right /></el-icon>
          <el-icon :size="20"><Left /></el-icon>
        </div>

        <div class="compare-side system-side">
          <div class="compare-label">
            <el-tag type="success" size="small">💾 系统记录（已有）</el-tag>
          </div>
          <table class="compare-table">
            <tr v-for="field in conflict.conflictFields" :key="field.field">
              <td class="field-label">{{ field.label }}</td>
              <td class="field-value system-value">{{ field.systemValue || '(空)' }}</td>
            </tr>
            <tr v-if="conflict.conflictFields.length === 0">
              <td colspan="2" style="color:#909399;text-align:center">
                所有字段与台账一致
              </td>
            </tr>
          </table>
        </div>
      </div>

      <!-- 处理策略选择 -->
      <div class="conflict-actions">
        <span class="action-label">处理策略：</span>
        <el-radio-group v-model="conflict._action" size="small">
          <el-radio-button value="update">
            <el-icon><Edit /></el-icon> 以台账为准（更新系统记录）
          </el-radio-button>
          <el-radio-button value="keep">
            <el-icon><Lock /></el-icon> 以系统为准（保留不变）
          </el-radio-button>
          <el-radio-button value="create_new">
            <el-icon><Plus /></el-icon> 强制新建（允许重复编号）
          </el-radio-button>
          <el-radio-button value="skip">
            <el-icon><Close /></el-icon> 跳过此行
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>
  </div>

  <!-- 操作按钮 -->
  <div style="text-align:center;margin-top:24px">
    <el-button @click="resetImport">取消导入</el-button>
    <el-button type="primary" size="large" :loading="resolvingConflicts"
      :disabled="resolvedCount < importResult.conflictCount"
      @click="resolveConflicts">
      应用处理（{{ resolvedCount }}/{{ importResult.conflictCount }}）
    </el-button>
  </div>
</div>

<!-- 正常完成界面（无冲突） -->
<div v-else class="result-area">
  <!-- ... 现有成功/失败结果展示 ... -->
</div>
```

#### 6.2 冲突处理脚本逻辑

```js
// 冲突列表（在现有 importResult 基础上扩展）
const conflictResolutions = ref([])

// 已处理的冲突计数
const resolvedCount = computed(() => {
  if (!importResult.value?.conflicts) return 0
  return importResult.value.conflicts.filter(c => c._action).length
})

// 批量设置处理策略
function batchSetAction(action) {
  if (!importResult.value?.conflicts) return
  importResult.value.conflicts.forEach(c => {
    if (!c._action) c._action = action
  })
}

// 提交冲突处理
const resolvingConflicts = ref(false)
async function resolveConflicts() {
  if (!importResult.value?.conflicts) return

  const unresolved = importResult.value.conflicts.filter(c => !c._action)
  if (unresolved.length > 0) {
    ElMessage.warning(`还有 ${unresolved.length} 条冲突未选择处理策略`)
    return
  }

  resolvingConflicts.value = true
  try {
    const resolutions = importResult.value.conflicts.map(c => ({
      index: c.index,
      action: c._action,
      importData: c.importData,
      existingId: c.existingRecord?.id,
      // 仅传递有差异的字段（减少网络开销）
      updateFields: c._action === 'update' ? c.conflictFields.map(f => f.field) : []
    }))

    const fileData = importResult.value.conflictFileData
    const res = await resolveImportConflicts({
      filePath: fileData.filePath,
      fileName: fileData.fileName,
      sheetMappings: fileData.sheetMappings,
      resolutions
    })

    // 更新结果
    importResult.value.needsResolution = false
    importResult.value.successRows += (res.data.updated + res.data.created)
    importResult.value.failRows += res.data.errors.length

    ElMessage.success(
      `冲突处理完成：更新 ${res.data.updated} 条，跳过 ${res.data.skipped} 条，` +
      `保留 ${res.data.kept} 条，新建 ${res.data.created} 条`
    )
    fetchList() // 刷新台账列表
  } catch (err) {
    ElMessage.error('冲突处理失败：' + (err.response?.data?.message || err.message))
  } finally {
    resolvingConflicts.value = false
  }
}
```

#### 6.3 前端 API 封装（`client/src/api/instruments.js`）

```js
// 解决导入冲突
export function resolveImportConflicts(data) {
  return request.post('/api/instruments/import/resolve-conflicts', data)
}

// 可选：提前检测冲突
export function checkImportConflicts(data) {
  return request.post('/api/instruments/import/check-conflicts', data)
}
```

---

## 7. 冲突对比 UI 样式

```css
.conflict-resolution {
  /* 冲突处理区域 */
}

.conflict-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background: #fff;
  transition: border-color 0.3s;
}

.conflict-card.resolved {
  border-color: #67c23a;
}

.conflict-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #ebeef5;
}

.conflict-compare {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.compare-side {
  flex: 1;
  min-width: 0;
}

.compare-side.import-side .field-value {
  background: #ecf5ff;
  color: #409eff;
}

.compare-side.system-side .field-value {
  background: #f0f9eb;
  color: #67c23a;
}

.compare-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  width: 40px;
  flex-shrink: 0;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
}

.compare-table td {
  padding: 4px 8px;
  border-bottom: 1px solid #f2f3f5;
  font-size: 13px;
}

.compare-table .field-label {
  color: #909399;
  width: 80px;
  white-space: nowrap;
}

.compare-table .field-value {
  border-radius: 3px;
  padding: 2px 6px;
  font-family: monospace;
}

.conflict-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #ebeef5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.conflict-toolbar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 6px;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
```

---

## 8. 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/instruments.js` | 修改 | `handleMultiSheetImport` 增加冲突检测；新增 `handleResolveConflicts`；注册 1-2 个新路由；新增 `buildConflictFields` 辅助函数 |
| `server/models/instrument.js` | 修改 | `update()` 字段列表增加 `certificate_file` |
| `server/services/instrumentHistory.js` | 修改 | `SOURCE_LABELS` 新增 `excel_import_overwrite` |
| `client/src/views/ImportPage.vue` | 修改 | Step 4 增加冲突处理分支 + 冲突对比卡片 + 策略选择 + 批量操作工具栏 |
| `client/src/api/instruments.js` | 修改 | 新增 `resolveImportConflicts`、`checkImportConflicts` |
| `client/src/utils/instrumentHistory.js` | 修改 | 新增 `excel_import_overwrite` 来源标签 |

共 **6 个文件**（0 新增）。

---

## 9. 边界情况

| 场景 | 处理 |
|------|------|
| 导入数据中同一编号出现多次（台账内重复） | 在冲突检测前先做台账内去重检查，重复的行合并提示 |
| 导入的 serial_number 为空 | 不参与冲突检测，照常创建新记录（当前行为不变） |
| 冲突处理时临时 Excel 文件已被删除 | 返回错误"上传文件已过期，请重新上传并导入" |
| 用户分批处理冲突（处理一部分后关闭页面） | 冲突数据保存在 `importResult.conflicts` 中（前端内存），页面刷新后丢失。建议：对大型导入，优先完成冲突处理 |
| 以台账为准更新后，系统记录的 serial_number 被覆盖 | **不会**：update 模式下不传 `serial_number`，系统编号保持不变。台账和系统的编号是一致的（冲突的前提就是编号相同） |
| conflictFields 为空（所有字段一致） | 这种情况理论上不存在（完全相同的数据不会触发冲突），但若出现则默认推荐"以系统为准（保留不变）" |
| 旧版导入（`handleLegacyImport`） | 同样加入冲突检测，与多 Sheet 版共享 buildConflictFields 和 handleResolveConflicts |

---

## 10. 对抗性审查结果

| # | 严重度 | 问题 | 修复 |
|---|--------|------|------|
| 1 | 高 | 冲突检测后先导入无冲突行、再让用户处理冲突行，若用户在此时取消操作，无冲突的行已经入库且无法回滚 | 在响应中明确列出已导入的行数，前端展示"已导入 35 条，还有 15 条待处理"。若用户选择取消，已导入的不回滚（符合用户预期：有用的数据不应该因为部分冲突而被丢弃） |
| 2 | 中 | 如果用户在冲突处理期间，另一个用户（或同一个用户的另一个标签页）修改了系统记录，`updateWithHistory` 会基于旧 `before` 快照计算 diff | 利用现有的 `updateWithHistory` 逻辑（先查 before，update 后再查 after），冲突处理时已是用户在查看对比后的手动操作，时间窗口内的并发修改概率极低 |
| 3 | 中 | `conflictFileData` 中包含 `filePath`（服务器路径），可能泄露服务器目录结构 | 对 filePath 做相对化处理，仅返回 `relativePath`（相对于 uploads/ 的路径），resolve 时在服务端拼接完整路径 |
| 4 | 低 | 大批量导入（500+ 条）+ 大量冲突（200+ 条）时，`conflicts` 数组和 `conflictFileData` 可能很大 | 冲突超过 100 条时分页返回（同 `page/pageSize`），前端分页处理 |
| 5 | 低 | `force新建` 会创建重复编号 | 新建时在 `createWithHistory` 之前不做唯一性校验（这是用户明确选择的行为），但记录 warning 日志 |
