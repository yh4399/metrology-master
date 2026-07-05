# 附件手动上传 & 台账保存 & 智能检验日期 — 设计文档

## 概述

四个功能：
1. **附件手动上传** — 最后一列新增"+"按钮，允许为单个器具手动上传证书 PDF
2. **批量上传自动关联附件** — 批量上传证书时自动保存 PDF 到对应器具的附件列（已实现，本文档仅确认）
3. **保存台账** — 按原有台账模板格式导出全部器具数据为多 Sheet Excel
4. **智能检验日期匹配** — 导入台账时，若证书提取日期比台账检验日期更接近现在，则用证书日期；否则保留台账日期

---

## 功能一：附件手动上传

### 1.1 问题

部分器具的证书 PDF 是单独获取的（非批量上传），或者需要替换旧证书。目前只能通过批量上传对话框操作，缺少针对单个器具的上传入口。

### 1.2 API

#### `POST /api/instruments/:id/certificate` — 为单个器具上传证书 PDF

使用 `multer` 单文件上传（`.pdf` 限制），保存到 `uploads/certificates/{id}/`。

**Request**: `multipart/form-data`，字段 `file`

**Response**:
```json
{
  "code": 200,
  "data": {
    "certificate_file": "/uploads/certificates/4114/YB-H1-ZX1-20250712106-7037589.pdf",
    "certificate_number": "YB-H1-ZX1-20250712106-7037589"
  },
  "message": "证书上传成功"
}
```

**处理逻辑**：
1. 接收 PDF 文件，验证格式和大小（50MB 以内）
2. 文件名作为 `certificate_number`（去掉 `.pdf` 后缀）
3. 保存到 `uploads/certificates/{id}/`（覆盖已有文件），目录不存在则创建
4. 更新数据库：`certificate_file`、`certificate_number`
5. 尝试提取检验日期 → 计算有效日期 → 同步更新 `inspection_date`、`valid_until`（与批量上传逻辑一致）
6. 记录变更历史（source: `manual_cert_upload`）

### 1.3 前端

**器具列表附件列改造**（width: 85）：

```
┌──────┐
│ 附件 │
├──────┤
│ 📄 + │  ← 有证书：PDF图标（点击查看）+ 添加/替换按钮
│  +   │  ← 无证书：仅添加按钮
└──────┘
```

改为：

```html
<el-table-column label="附件" width="85" align="center">
  <template #default="{ row }">
    <!-- 有证书：查看 + 替换 -->
    <template v-if="row.certificate_file">
      <el-button link type="primary" size="small" @click="viewCertificate(row)">
        <el-icon :size="16"><Document /></el-icon>
      </el-button>
    </template>
    <!-- 上传按钮（始终可见） -->
    <el-upload
      :show-file-list="false"
      :accept="'.pdf'"
      :before-upload="(f) => handleSingleCertUpload(row, f)"
      style="display:inline-block"
    >
      <el-button link size="small" :type="row.certificate_file ? 'default' : 'primary'">
        <el-icon :size="14"><Plus /></el-icon>
      </el-button>
    </el-upload>
  </template>
</el-table-column>
```

**上传处理函数**：

```js
async function handleSingleCertUpload(row, file) {
  try {
    await uploadCertificateForInstrument(row.id, file)
    ElMessage.success('证书已上传')
    // 刷新当前页 + 更新行数据
    fetchList()
  } catch (err) {
    ElMessage.error('上传失败：' + (err.response?.data?.message || err.message))
  }
  return false  // 阻止 el-upload 的默认上传
}
```

**交互细节**：
- 选择文件后自动上传，无需确认
- 上传期间按钮显示 loading
- 成功后刷新列表，附件列显示 PDF 图标
- 失败弹出错误提示，文件不保留

---

## 功能二：批量上传自动关联附件

**已实现**，无需额外开发。

`POST /api/certificate/batch-upload` 匹配成功后：
1. 创建目录 `uploads/certificates/{instrument_id}/`
2. 复制 PDF 到 `{证书编号}.pdf`
3. 写入 `certificate_file` 字段
4. 前端附件列显示 PDF 图标，点击可查看原件

---

## 功能三：保存台账（多 Sheet 导出）

### 3.1 需求

将当前数据库中的全部器具数据导出为多 Sheet Excel 文件，格式匹配原始 `data/台账总表.xlsx` 的结构：
- 每种器具类别一个 Sheet
- 列顺序与原始台账模板一致
- 包含所有字段（含证书编号、检验日期、有效日期等最新数据）

### 3.2 API

#### `GET /api/instruments/export/ledger` — 导出完整台账

**Query**: 无参数（导出全量数据，不受筛选条件限制）

**Response**: Excel 文件下载（`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`）

### 3.3 Sheet 与列定义

根据 `data/台账总表.xlsx` 的分析结果，每个 Sheet 使用与该类别匹配的列结构：

**通用列**（所有 Sheet 共用）：

| 列名 | 字段 | 宽度 |
|------|------|------|
| 序号 | (自增) | 5 |
| 安装位置 | installation_location | 20 |
| 规格型号 | model | 16 |
| 生产厂家 | manufacturer | 14 |
| 出厂编号 | serial_number | 13 |
| 检验时间 | inspection_date | 13 |
| 有效期 | valid_until | 13 |
| 证书编号 | certificate_number | 22 |
| 分类管理 | classification | 8 |
| 检验单位 | inspection_unit | 18 |
| 状态 | status | 8 |

**类别特有列**（根据原始台账模板的列结构动态适配）：

| 类别 Sheet | 额外列 |
|------------|--------|
| 压变 | 量程(MPa)、出厂日期 |
| 温变 | 量程(℃)、出厂日期 |
| 压力表 | 安装后编号、量程(MPa)、精度、厂家、压力表类别 |
| 温度表 | 量程(℃)、精度、厂家 |
| 电磁流量计 | … |
| … | 依原始模板 |

### 3.4 后端实现

复用 `excelService`（`server/services/excel.js`）和 `ExcelJS`：
- 按 `category` 分组查询全部器具
- 每个类别创建独立 Sheet
- 使用该类别的列映射写入表头和数据行
- 合并标题行等格式处理

### 3.5 前端

工具栏新增按钮：

```html
<el-button plain @click="exportLedger">
  <el-icon><Download /></el-icon> 保存台账
</el-button>
```

```js
function exportLedger() {
  window.open('/api/instruments/export/ledger?token=' + authStore.token, '_blank')
}
```

---

## 功能四：智能检验日期匹配

### 4.1 问题

现有 Excel 导入流程（`POST /api/instruments/import/confirm`）直接使用台账上的检验日期。但实际场景中：
- 台账上的检验日期可能是旧数据
- 证书编号中包含了更新的检验日期
- 需要智能选择更接近现在的那一个

### 4.2 规则

当导入数据中同时存在 `certificate_number` 和 `inspection_date` 时：

```
1. 从 certificate_number 提取检验日期 → certDate
2. 台账上的检验日期 → ledgerDate
3. 比较两者距离 today 的天数：
   - certDate 更近（天数差更小）→ 使用 certDate
   - ledgerDate 更近或相等 → 使用 ledgerDate
   - certDate 无法提取 → 使用 ledgerDate
   - 只有 certDate → 使用 certDate
4. 根据选定的检验日期 + 类别 + 分类 → 计算 valid_until
5. 写入 inspection_date 和 valid_until
```

### 4.3 后端修改

在 `server/routes/instruments.js` 的 `handleMultiSheetImport` 和 `handleLegacyImport` 中，`Instrument.createWithHistory(data, ...)` 之前增加日期选择逻辑：

```js
// === 智能检验日期匹配 ===
const certDate = extractInspectionDate(data.certificate_number);
if (certDate && data.inspection_date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const certDiff = Math.abs(new Date(certDate) - today);
  const ledgerDate = new Date(data.inspection_date);
  const ledgerDiff = isNaN(ledgerDate.getTime())
    ? Infinity
    : Math.abs(ledgerDate - today);
  
  if (certDiff < ledgerDiff) {
    // 证书日期更接近现在 → 使用证书日期
    data.inspection_date = certDate;
  }
  // 否则保留台账日期
}
// 计算有效日期
if (data.inspection_date) {
  const cls = /* 从 extra_fields 或 mapping 中提取 classification */;
  const calculateValidUntil = require('../models/validityRules').calculateValidUntil;
  data.valid_until = calculateValidUntil(data.inspection_date, data.category, cls);
}
```

> `extractInspectionDate` 在 `certificate.js` 中是模块作用域函数，需要抽取为公共函数或复用。最佳方案是将其移到 `server/services/certificate.js`（新建）或直接在 `validityRules.js` 中添加。

### 4.4 函数抽取

将 `extractInspectionDate` 从 `certificate.js` 移至 `server/models/validityRules.js`（该模块在 db 初始化后才加载，且与 `calculateValidUntil` 逻辑相关）：

```js
// server/models/validityRules.js 新增
extractInspectionDate(certNo) {
  // ... 现有逻辑
}
```

`certificate.js` 中的 `extractInspectionDate` 改为：

```js
function extractInspectionDate(certNo) {
  return ValidityRules.extractInspectionDate(certNo);
}
```

这样 `instruments.js` 也可以引用：`ValidityRules.extractInspectionDate(...)`。

---

## 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/instruments.js` | 修改 | +`POST /:id/certificate` 单个证书上传；+`GET /export/ledger` 台账导出；导入流程智能日期匹配 |
| `server/models/validityRules.js` | 修改 | +`extractInspectionDate()` 公共函数 |
| `server/routes/certificate.js` | 修改 | `extractInspectionDate` 改为调用 ValidityRules 版本 |
| `server/middleware/uploadsAuth.js` | 确认 | 确保证书 PDF 可通过 token 认证访问（已有） |
| `client/src/views/InstrumentList.vue` | 修改 | 附件列改为上传按钮；+保存台账按钮；+`Plus` 图标 |
| `client/src/api/instruments.js` | 修改 | +`uploadCertificateForInstrument()`；+`exportLedger()` |
| `client/src/utils/instrumentHistory.js` | 修改 | +`manual_cert_upload` 来源标签 |

共 **6 个文件**（0 新增），约 **250 行**代码。

---

## 对抗性审查结果

### 发现并修复的问题

| # | 严重度 | 问题 | 修复 |
|---|--------|------|------|
| 1 | **中** | `getClassification` 在 `certificate.js`、`instruments.js`（两处）中使用 `/类$/` 正则清洗分类值，但该正则在"类"后紧跟空格时失效（如 `"A类 "`） | 改为 `.replace(/类/g, '').trim()`，三处统一修复 |
| 2 | 低 | `extractInspectionDate` 逻辑在 `certificate.js` 和 `validityRules.js` 中重复 | 重构：只保留 validityRules.js 中的版本，certificate.js 改为一行委托 |
| 3 | 无 | `POST /:id/certificate` 与 `GET /:id` 路由可能冲突 | 确认无冲突：HTTP 方法不同（POST vs GET），Express 按 method+path 匹配 |
| 4 | 无 | `FolderAdd` 图标是否存在于 `@element-plus/icons-vue` | 确认存在，构建通过 |
| 5 | 低 | 附件列 `certInputRefs` 使用函数 ref 模式 | 确认 Vue 3 模板中 ref 自动解包，`?.` 可选链防止未挂载时调用 |

### 验证通过项

| 检查项 | 结果 |
|--------|------|
| 前端构建无错误 | ✓ |
| 后端启动正常 | ✓ |
| 路由无 method+path 冲突 | ✓ |
| `Instrument.findAll` 可用 | ✓ |
| `valid_until` 在 TRACKED_FIELDS 中 | ✓ |
| 分类值 `A类`/`B类`/`C类` 清洗为 `A`/`B`/`C` | ✓ |
| 空分类 / 空 extra_fields 安全处理 | ✓ |
