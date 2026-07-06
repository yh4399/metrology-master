# 证书上传未匹配处理 & 以证书为准修正 — 设计文档

## 1. 概述

当前批量上传证书（`POST /api/certificate/batch-upload`）和单个证书上传（`POST /api/instruments/:id/certificate`）在出厂编号无法匹配到系统器具时，仅标记 `status: 'unmatched'` 并在前端显示"⚠ 未找到对应器具"，**不提供任何修正手段**。

本次增强的核心原则：**一切以证书为准。** 证书上的出厂编号是检定机构官方确认的，权威性高于系统台账。当匹配不上时，应引导用户以证书编号修正系统数据，而非丢弃证书信息。

## 2. 问题分析

### 2.1 当前匹配失败的根本原因

| 原因 | 场景示例 | 发生概率 |
|------|---------|---------|
| 台账出厂编号录入错误 | 证书编号 `4190286`，台账录入为 `4190288`（录入时手误） | 高 |
| 台账出厂编号格式不一致 | 证书编号 `1807P-21621-11537`，台账录入为 `1807P2162111537`（缺少连字符） | 中 |
| 台账中缺失该器具 | 新到货器具已检定，证书在手但没有录入台账 | 中 |
| 证书类型无法识别 | 证书文件名不遵循标准格式 | 低 |

### 2.2 用户痛点

1. 看到"未匹配"提示后，不知道该去哪里修正
2. 即使手动在台账编辑页改了编号，证书已经上传的临时文件也丢失了
3. 批量几十个证书时，逐个手动匹配效率极低

## 3. 解决方案

### 3.1 整体流程

```
证书上传 → 文件名解析 → 编号匹配
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             精确匹配   模糊匹配     完全未匹配
           (1条命中)  (多条同号)  (0条命中)
                │           │           │
                ▼           ▼           ▼
            直接更新   现有逻辑    展示修正界面
                                    │
                        ┌───────────┼───────────┐
                        ▼           ▼           ▼
                    模糊搜索    新建器具    修改已有器具
                   (按位置/型号 (用证书信息   (用户选择一个
                    找相似器具)  创建新记录)   已有器具，修改
                                             其出厂编号匹配
                                             证书)
```

### 3.2 核心原则

- **证书编号为准，不修改证书信息** — 证书编号、证书日期都是从证书文件本身提取的，不应被修改
- **修正的是系统台账** — 当证书与台账不一致时，修正台账上的 `serial_number` 以匹配证书
- **所有修正操作记录历史** — 修改 `serial_number` 需通过 `updateWithHistory`，source 标记为 `certificate_correction`

---

## 4. 功能一：批量上传未匹配处理

### 4.1 后端增强

#### 4.1.1 新增 API：`POST /api/certificate/unmatched-search`

对未匹配的证书，允许用户在前端搜索可能的匹配目标。

**Request:**
```json
{
  "serialNumber": "4190286",
  "certificateNumber": "WB-H1-ZX1-2026062801-4190286",
  "category": "温度变送器",
  "keyword": ""  // 可选：额外搜索关键词（安装位置/型号等）
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "candidates": [
      {
        "id": 42,
        "category": "温度变送器",
        "serial_number": "4190288",
        "installation_location": "中心一号B平台二层",
        "model": "WTZ-288",
        "manufacturer": "昆山圣科仪器",
        "similarity": 0.92  // 相似度评分
      }
    ]
  }
}
```

**搜索策略**（按优先级）：
1. 同类别 + 模糊匹配出厂编号（Levenshtein 距离 ≤ 2）
2. 同类别 + 模糊匹配证书编号中的日期码
3. 全库模糊匹配出厂编号
4. 全库模糊匹配证书编号

#### 4.1.2 新增 API：`POST /api/certificate/force-match`

将证书信息更新到用户指定的器具（以证书为准修正台账）。

**Request:**
```json
{
  "certificateSerialNumber": "4190286",
  "certificateNumber": "WB-H1-ZX1-2026062801-4190286",
  "category": "温度变送器",
  "targetInstrumentId": 42,
  "updateSerialNumber": true,  // 是否同时修正出厂编号
  "certificateFile": "uploads/temp/xxx.pdf"  // 服务端临时文件路径
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "id": 42,
    "oldSerialNumber": "4190288",
    "newSerialNumber": "4190286",
    "certificateNumber": "WB-H1-ZX1-2026062801-4190286",
    "inspectionDate": "2026-06-28",
    "validUntil": "2027-06-27",
    "historyId": 128
  },
  "message": "已修正器具 #42 的出厂编号并关联证书"
}
```

**处理逻辑**：
1. 通过 `findById` 获取目标器具当前数据
2. 如果 `updateSerialNumber === true`：覆盖 `serial_number` 为证书提取的编号
3. 更新 `certificate_number`、`inspection_date`、`valid_until`
4. 保存 PDF 到 `uploads/certificates/{id}/`
5. 通过 `updateWithHistory` 记录变更（source: `certificate_correction`）
6. 返回变更详情

#### 4.1.3 新增 API：`POST /api/certificate/create-from-cert`

当证书对应的器具在系统中完全不存在时，用证书信息创建新器具。

**Request:**
```json
{
  "serialNumber": "4190286",
  "certificateNumber": "WB-H1-ZX1-2026062801-4190286",
  "category": "温度变送器",
  "inspectionDate": "2026-06-28",
  "validUntil": "2027-06-27",
  "certificateFile": "uploads/temp/xxx.pdf"
}
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "id": 99,
    "serial_number": "4190286",
    "certificate_number": "WB-H1-ZX1-2026062801-4190286"
  },
  "message": "已根据证书信息创建新器具"
}
```

#### 4.1.4 修改 `batch-upload` 响应

在现有 `fileResult` 中新增字段，让前端知道未匹配情况下的处理选项：

```js
// 在 status === 'unmatched' 时追加
fileResult.suggestions = {
  fuzzyMatchCandidates: [],   // 模糊匹配候选列表（最多5条）
  canCreateNew: true          // 是否可以创建新器具
};
```

同时修改 `batch-upload` 的流程，**对于未匹配的证书，保留其临时 PDF 文件**（不依赖 multer 自动清理），以便后续 force-match 时使用。在响应中返回临时文件路径：

```js
fileResult.tempFilePath = file.path; // 保留供后续修正使用
```

> ⚠️ **临时文件生命周期**：force-match / create-from-cert 执行成功后删除临时文件。未被处理的临时文件在服务重启时由启动清理逻辑统一删除（超过 24h 的 `/uploads/temp_certs/` 内文件）。

#### 4.1.5 `certificate.js` 修改汇总

| 修改点 | 说明 |
|--------|------|
| multer 存储路径改为 `uploads/temp_certs/` | 便于统一管理临时文件生命周期 |
| `batch-upload` 未匹配时增加 `fuzzyMatchCandidates` | 在响应中返回模糊匹配候选 |
| 新增 `POST /unmatched-search` | 模糊搜索匹配目标 |
| 新增 `POST /force-match` | 以证书为准修正器具 |
| 新增 `POST /create-from-cert` | 用证书信息创建新器具 |
| 新增 `DELETE /temp-cert/:filename` | 清理指定临时文件（修正完成后调用） |

### 4.2 前端增强

#### 4.2.1 批量上传结果表格改造

当前未匹配行只显示 `⚠ 未找到对应器具` 标签。改造为：

```vue
<template v-else-if="row.status === 'unmatched'">
  <div class="unmatched-actions">
    <el-tag size="small" type="warning">⚠ 未匹配</el-tag>
    <el-dropdown trigger="click" style="margin-left:4px">
      <el-button link size="small" type="primary">
        处理 <el-icon><ArrowDown /></el-icon>
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="searchFuzzyMatch(row)">
            <el-icon><Search /></el-icon> 模糊搜索匹配
          </el-dropdown-item>
          <el-dropdown-item @click="showManualMatch(row)">
            <el-icon><Edit /></el-icon> 手动选择器具
          </el-dropdown-item>
          <el-dropdown-item @click="createFromCert(row)" divided>
            <el-icon><Plus /></el-icon> 用证书信息新建器具
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>
```

#### 4.2.2 模糊搜索匹配弹窗

```vue
<el-dialog v-model="fuzzyMatchVisible" title="🔍 查找匹配器具" width="700px">
  <el-alert type="info" :closable="false" show-icon style="margin-bottom:16px">
    证书出厂编号：<code>{{ activeUnmatched?.serialNumber }}</code>，
    证书类别：<el-tag size="small">{{ activeUnmatched?.category || '未知' }}</el-tag>
  </el-alert>

  <el-input v-model="fuzzySearchKeyword" placeholder="输入安装位置、型号等辅助搜索…" clearable
    @input="onFuzzySearchDebounce" style="margin-bottom:12px">
    <template #prefix><el-icon><Search /></el-icon></template>
  </el-input>

  <el-table :data="fuzzyCandidates" @row-dblclick="confirmFuzzyMatch"
    highlight-current-row max-height="350" size="small">
    <el-table-column label="操作" width="70" align="center">
      <template #default="{ row: candidate }">
        <el-button size="small" type="primary" @click="confirmFuzzyMatch(candidate)">
          匹配
        </el-button>
      </template>
    </el-table-column>
    <el-table-column prop="category" label="类别" width="130" />
    <el-table-column prop="serial_number" label="出厂编号" width="160">
      <template #default="{ row: candidate }">
        <span :style="{ color: candidate.similarity < 1 ? '#e6a23c' : '' }">
          {{ candidate.serial_number }}
        </span>
      </template>
    </el-table-column>
    <el-table-column prop="installation_location" label="安装位置" min-width="160" />
    <el-table-column prop="model" label="型号" width="120" />
    <el-table-column label="相似度" width="90" align="center">
      <template #default="{ row: candidate }">
        <el-progress :percentage="Math.round(candidate.similarity * 100)"
          :status="candidate.similarity >= 0.9 ? 'success' : ''"
          :stroke-width="8" :show-text="false" />
        <small>{{ Math.round(candidate.similarity * 100) }}%</small>
      </template>
    </el-table-column>
  </el-table>

  <div v-if="fuzzyCandidates.length === 0 && fuzzySearched" style="text-align:center;padding:40px;color:#909399">
    未找到匹配的器具，建议<a @click="createFromCert(activeUnmatched)" style="color:#409EFF;cursor:pointer">用证书信息新建器具</a>
  </div>

  <template #footer>
    <el-button @click="fuzzyMatchVisible = false">取消</el-button>
    <el-button type="success" @click="createFromCert(activeUnmatched)">
      用证书信息新建器具
    </el-button>
  </template>
</el-dialog>
```

#### 4.2.3 确认匹配弹窗

当用户双击或点击"匹配"后，弹出确认对话框：

```vue
<el-dialog v-model="confirmMatchVisible" title="⚠ 确认以证书为准修正" width="480px"
  :close-on-click-modal="false">
  <div style="line-height:2">
    <p>即将将以下器具的 <strong>出厂编号</strong> 修改为证书上的值：</p>

    <table style="width:100%;border-collapse:collapse;margin:12px 0">
      <tr>
        <td style="color:#909399;padding:4px 8px">证书出厂编号</td>
        <td style="font-weight:bold;color:#409EFF;padding:4px 8px">
          {{ activeUnmatched?.serialNumber }}
        </td>
      </tr>
      <tr>
        <td style="color:#909399;padding:4px 8px">证书编号</td>
        <td style="padding:4px 8px">{{ activeUnmatched?.certificateNumber }}</td>
      </tr>
      <tr style="background:#fef0f0">
        <td style="color:#909399;padding:4px 8px">系统当前出厂编号</td>
        <td style="font-weight:bold;color:#e6a23c;padding:4px 8px">
          {{ confirmMatchTarget?.serial_number }}
        </td>
      </tr>
      <tr>
        <td style="color:#909399;padding:4px 8px">器具类别</td>
        <td style="padding:4px 8px">{{ confirmMatchTarget?.category }}</td>
      </tr>
      <tr>
        <td style="color:#909399;padding:4px 8px">安装位置</td>
        <td style="padding:4px 8px">{{ confirmMatchTarget?.installation_location }}</td>
      </tr>
    </table>

    <el-checkbox v-model="confirmUpdateSerial">
      同时将出厂编号修改为 <code>{{ activeUnmatched?.serialNumber }}</code>（以证书为准）
    </el-checkbox>

    <el-alert type="warning" :closable="false" show-icon style="margin-top:12px">
      此操作将修改台账中的出厂编号及证书信息，修改记录会写入变更历史。
    </el-alert>
  </div>

  <template #footer>
    <el-button @click="confirmMatchVisible = false">取消</el-button>
    <el-button type="primary" :loading="forceMatching" @click="executeForceMatch">
      确认修正
    </el-button>
  </template>
</el-dialog>
```

#### 4.2.4 手动选择器具弹窗

用于证书与某些器具可能不是同一出厂编号、但确实是同一个物理设备的场景（如编号格式差异太大、模糊匹配找不到）。

```vue
<el-dialog v-model="manualMatchVisible" title="📋 手动选择目标器具" width="800px">
  <el-alert type="warning" :closable="false" show-icon style="margin-bottom:16px">
    证书出厂编号：<code>{{ activeUnmatched?.serialNumber }}</code>，
    请在下方选择要关联的器具。选择后将以证书编号更新该器具信息。
  </el-alert>

  <!-- 复用 InstrumentList 的筛选 + 表格，简化为选择模式 -->
  <el-input v-model="manualSearchKeyword" placeholder="搜索出厂编号/型号/位置…" clearable
    @input="onManualSearch" style="margin-bottom:12px" />

  <el-table :data="manualCandidates" @row-click="selectManualTarget"
    highlight-current-row max-height="400" size="small">
    <el-table-column label="选择" width="60" align="center">
      <template #default="{ row }">
        <el-radio :model-value="manualTarget?.id" :value="row.id" @change="selectManualTarget(row)" />
      </template>
    </el-table-column>
    <el-table-column prop="category" label="类别" width="130" />
    <el-table-column prop="serial_number" label="出厂编号" width="160" />
    <el-table-column prop="installation_location" label="安装位置" min-width="160" />
    <el-table-column prop="model" label="型号" width="120" />
    <el-table-column prop="manufacturer" label="厂家" width="120" />
  </el-table>

  <template #footer>
    <el-button @click="manualMatchVisible = false">取消</el-button>
    <el-button type="primary" :disabled="!manualTarget" @click="confirmManualMatch">
      确认选择并关联证书
    </el-button>
  </template>
</el-dialog>
```

#### 4.2.5 新建器具弹窗

当证书对应的器具在系统中完全不存在时，快速创建：

```vue
<el-dialog v-model="createFromCertVisible" title="📝 用证书信息新建器具" width="520px">
  <el-form :model="newFromCertForm" label-width="100px" size="default">
    <el-form-item label="器具类别">
      <el-select v-model="newFromCertForm.category" filterable allow-create style="width:100%">
        <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
      </el-select>
    </el-form-item>
    <el-form-item label="出厂编号">
      <el-input v-model="newFromCertForm.serialNumber" disabled>
        <template #suffix><el-tag size="small" type="info">来自证书</el-tag></template>
      </el-input>
    </el-form-item>
    <el-form-item label="证书编号">
      <el-input v-model="newFromCertForm.certificateNumber" disabled />
    </el-form-item>
    <el-form-item label="检验日期">
      <el-input v-model="newFromCertForm.inspectionDate" disabled />
    </el-form-item>
    <el-form-item label="有效日期">
      <el-input v-model="newFromCertForm.validUntil" disabled />
    </el-form-item>
    <el-form-item label="分类管理">
      <el-select v-model="newFromCertForm.classification" clearable style="width:100%">
        <el-option label="A 类" value="A类" />
        <el-option label="B 类" value="B类" />
        <el-option label="C 类" value="C类" />
      </el-select>
    </el-form-item>
    <el-form-item label="安装位置">
      <el-input v-model="newFromCertForm.location" placeholder="选填" />
    </el-form-item>
  </el-form>

  <template #footer>
    <el-button @click="createFromCertVisible = false">取消</el-button>
    <el-button type="primary" :loading="creatingFromCert" @click="executeCreateFromCert">
      创建器具并关联证书
    </el-button>
  </template>
</el-dialog>
```

### 4.3 前端 API 封装（`client/src/api/instruments.js`）

```js
// 搜索未匹配证书的可能匹配目标
export function searchUnmatchedCert(params) {
  return request.post('/api/certificate/unmatched-search', params)
}

// 强制匹配：以证书为准修正器具
export function forceMatchCert(data) {
  return request.post('/api/certificate/force-match', data)
}

// 用证书信息创建新器具
export function createInstrumentFromCert(data) {
  return request.post('/api/certificate/create-from-cert', data)
}
```

### 4.4 数据流总结

```
用户上传证书
    │
    ▼
batch-upload API → 返回匹配结果
    │
    ├── matched → 直接更新 ✅
    │
    └── unmatched → 前端展示【处理】下拉菜单
                        │
                        ├── "模糊搜索匹配" → unmatched-search API → 候选列表
                        │       │
                        │       └── 用户确认 → force-match API
                        │              (source: certificate_correction)
                        │
                        ├── "手动选择器具" → Instrument.list API → 列表选择
                        │       │
                        │       └── 用户确认 → force-match API
                        │              (source: certificate_correction)
                        │
                        └── "新建器具" → create-from-cert API
                               (source: certificate_create)
```

---

## 5. 功能二：单个证书上传未匹配处理

`POST /api/instruments/:id/certificate` 接口是给已确定目标器具用的，不涉及匹配问题。但若用户在选择器具前就上传了证书，当前流程不支持。

**建议**：已有的"查看证书"链接已经是针对已匹配场景的。单个上传的改进不在本次范围（用户可以通过批量上传+未匹配处理流程覆盖该场景）。

---

## 6. 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/certificate.js` | 修改 | multer 路径改为 `temp_certs/`；batch-upload 未匹配时返回 `fuzzyMatchCandidates` + `tempFilePath`；新增 3 个端点 |
| `server/models/instrument.js` | 修改 | 新增 `fuzzySearchBySerialNo(serialNo, category)` 模糊搜索方法；新增 `findWithKeyword(keyword, pageSize)` |
| `server/services/instrumentHistory.js` | 修改 | `SOURCE_LABELS` 新增 `certificate_correction`、`certificate_create` |
| `client/src/views/InstrumentList.vue` | 修改 | 批量上传结果表格改造：未匹配行 +"处理"下拉菜单；新增 4 个弹窗（模糊匹配/确认修正/手动选择/新建器具） |
| `client/src/api/instruments.js` | 修改 | 新增 `searchUnmatchedCert`、`forceMatchCert`、`createInstrumentFromCert` |
| `client/src/utils/instrumentHistory.js` | 修改 | 新增 `certificate_correction`、`certificate_create` 来源标签 |
| `server/app.js` | 修改 | 启动时创建 `uploads/temp_certs/` 目录；增加临时文件清理逻辑（>24h 自动删除） |

共 **7 个文件**（0 新增）。

---

## 7. 边界情况

| 场景 | 处理 |
|------|------|
| 证书编号格式不标准（无法提取类别前缀） | `category` 为 null，模糊搜索不限类别 |
| 模糊匹配返回 0 条 | 提示用户使用手动选择或新建 |
| 用户修正了一个器具后又上传同一批证书 | force-match 前再次校验目标器具的 serial_number 是否已有相同证书编号（幂等） |
| 同一证书被 force-match 到两个不同器具 | 临时文件只能被 force-match 使用一次，第二次调用时文件已不存在返回错误 |
| 器具已有其他证书 | 覆盖旧证书信息（证书编号、日期、PDF），保留变更历史 |
| 证书提取的检验日期无效 | 仅更新证书编号和 PDF，不更新日期字段 |
| 用户放弃处理（关闭弹窗） | 临时文件保留，24h 后由清理逻辑删除 |

---

## 8. 对抗性审查结果

| # | 严重度 | 问题 | 修复 |
|---|--------|------|------|
| 1 | 高 | force-match 更新 serial_number 后，如果修改后的编号与另一器具重复，会导致后续证书匹配时多条命中 | force-match 前校验新编号是否已存在（同类别下），存在则警告用户但仍允许执行（记录 warning） |
| 2 | 中 | 模糊搜索的 Levenshtein 距离对长编号（如 `1807P-21621-11537`）计算开销大 | 限制参与模糊匹配的候选范围：先按类别筛，再按编号长度差 ≤ 3 筛 |
| 3 | 中 | 临时文件 `temp_certs/` 与正常证书目录 `certificates/` 分离，force-match 后需要移动文件 | 使用 `fs.rename`（原子操作）而非 copy+delete |
| 4 | 低 | batch-upload 的未匹配返回带 `tempFilePath`，若前端未调用 force-match 直接关掉页面，文件泄漏 | 启动清理逻辑兜底（>24h 删除） |
