# 证书日期校验工具 & 证书附件列 — 设计文档

## 概述

三个功能：
1. **证书日期双维度校验** — 扫描全部器具，同时校验「证书→检验日期」和「检验日期→有效日期」
2. **批量修正** — 勾选不匹配/缺失的记录，一键更新检验日期和有效日期
3. **证书附件列** — 器具列表新增"附件"列，上传的 PDF 持久保存并可点击查看

---

## 功能一：证书日期校验工具

### 1.1 业务场景

- 旧版证书编号提取的日期是首次检定日期（非当前检验），检验日期为空或不准确
- 手动录入的证书编号，检验日期可能不一致
- 有效日期计算规则变更后，旧数据的有效日期需要重新校验
- 从 Excel 导入的历史数据可能存在日期错误

### 1.2 校验规则（双维度）

#### 维度一：证书编号 → 检验日期（`cert_status`）

如果 `certificate_number` 非空，调用 `extractInspectionDate()` 提取日期并对比：

| 状态 | 条件 |
|------|------|
| `cert_match` | 提取日期 = 检验日期 |
| `cert_mismatch` | 提取日期 ≠ 检验日期 |
| `cert_missing` | 提取日期非空，但检验日期为空 |
| `cert_no_extract` | 无法从证书编号提取日期 |
| `no_cert` | 无证书编号 |

#### 维度二：检验日期 → 有效日期（`valid_status`）

如果 `inspection_date` 非空，调用 `calculateValidUntil(inspection_date, category, classification)` 计算预期有效日期并对比：

| 状态 | 条件 |
|------|------|
| `valid_match` | 预期有效日期 = 存储有效日期 |
| `valid_mismatch` | 预期有效日期 ≠ 存储有效日期 |
| `valid_missing` | 检验日期非空，但有效日期为空 |
| `no_inspection` | 无检验日期 |

> 预期有效日期使用 `ValidityRules.calculateValidUntil()` 计算，规则来自 `validity_rules` 表，详见 [design-validity-rules-config.md](design-validity-rules-config.md)。

#### 综合状态（`status`）

取两个维度中最严重的结果：

```
cert_mismatch / valid_mismatch → mismatch
cert_missing  / valid_missing  → missing
cert_match   + valid_match    → match
其他                            → skip
```

### 1.3 API

#### `GET /api/certificate/check-dates`

**Query**: `?onlyMismatch=1&page=1&pageSize=500`

**Response**:
```json
{
  "code": 200,
  "data": {
    "total": 400,
    "certMatch": 220, "certMismatch": 45, "certMissing": 35, "certNoExtract": 50,
    "validMatch": 200, "validMismatch": 80, "validMissing": 20,
    "match": 180, "mismatch": 100, "missing": 50, "skip": 70,
    "results": [
      {
        "id": 1, "category": "压力变送器", "serial_number": "7037589",
        "certificate_number": "YB-H1-ZX1-20250712106-7037589",
        "inspection_date": "2024-07-12", "valid_until": "2025-07-11",
        "classification": "B",
        "extracted_date": "2025-07-12",
        "cert_expected_valid_until": "2026-07-11",
        "cert_status": "cert_mismatch",
        "expected_valid_until": "2025-07-11",
        "valid_status": "valid_match",
        "status": "mismatch"
      }
    ]
  }
}
```

关键字段说明：

| 字段 | 说明 |
|------|------|
| `extracted_date` | 从证书编号提取的检验日期（维度一） |
| `cert_expected_valid_until` | 基于提取日期 + 类别 + 分类计算的预期有效日期（批量更新时使用） |
| `expected_valid_until` | 基于存储检验日期 + 类别 + 分类计算的预期有效日期（维度二） |
| `cert_status` / `valid_status` | 各维度状态 |
| `status` | 综合状态 |

#### `POST /api/certificate/batch-update-dates`

**Request**:
```json
{
  "items": [
    { "id": 1, "inspection_date": "2025-07-12", "valid_until": "2026-07-11" }
  ]
}
```

**Response**: `{ "code": 200, "data": { "updated": 1 }, "message": "成功更新 1 条记录" }`

更新逻辑：使用 `Instrument.updateWithHistory()` 逐条更新，source 标记为 `certificate_date_fix`。

### 1.4 前端

工具栏按钮：`<el-button type="warning" plain>⚠ 证书日期校验</el-button>`

打开对话框（1100px），自动调用 `GET /api/certificate/check-dates`：

- 两行统计摘要：证书维度（匹配/不匹配/缺失/无法提取）+ 有效期维度（匹配/不匹配/缺失）
- 仅看不匹配/缺失 复选框（默认勾选）
- 表格列：☐ | 类别 | 出厂编号 | 证书编号 | 证书→检验 | 检验→有效 | 综合
  - **证书→检验**：不匹配时显示 `~~旧日期~~ → 新日期`（红→绿）
  - **检验→有效**：不匹配时显示 `~~旧日期~~ → 预期日期`（红→蓝）
- 批量更新：勾选 → 确认弹窗 → 调用 `POST /api/certificate/batch-update-dates`
- 更新策略：优先使用维度一的提取日期 + 对应有效日期；若维度一无需更新但维度二需要，则用维度二的预期有效日期

---

## 功能二：证书附件列

### 2.1 存储方案

**文件系统 + 数据库路径**，与照片存储方案一致。

```
server/uploads/
├── photos/           ← 仪器照片（已有）
└── certificates/     ← 证书 PDF（新增）
    └── {id}/
        └── YB-H1-ZX1-20250712106-7037589.pdf
```

按 `instrument_id` 分子目录，重复上传时覆盖旧文件（同一器具只保留最新证书）。

### 2.2 数据库

`instruments` 表新增 `certificate_file TEXT` 列（迁移在 `server/models/db.js`）。

存储格式：`/uploads/certificates/{id}/{证书编号}.pdf`

### 2.3 后端

**批量上传时保存 PDF**（`POST /api/certificate/batch-upload`，两个匹配分支均含此逻辑）：

```js
// 创建目录 + 复制 PDF
const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(instrument.id));
fs.mkdirSync(certDir, { recursive: true });
fs.copyFileSync(file.path, destPath);
// 写入 updateData
updateData.certificate_file = `/uploads/certificates/${instrument.id}/${safeCertNo}.pdf`;
```

保存失败时记录 `certFileWarning`，不阻断匹配流程。

**删除器具时清理**（`Instrument.purgeDeleted()`）：

```js
const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(id));
if (fs.existsSync(certDir)) fs.rmSync(certDir, { recursive: true, force: true });
```

**访问控制**：`/uploads` 已挂载为静态目录，通过 `uploadsAuth` 中间件 JWT 认证。

### 2.4 前端

器具列表新增"附件"列（width: 65，位于"操作"列之前）：

- 有 `certificate_file` → PDF 图标按钮（Document 图标）
- 无 → 灰色 `-`
- 点击 → `photoUrlWithToken(url)` 拼接 token → `window.open(url, '_blank')` 浏览器原生 PDF 查看器打开

---

## 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/certificate.js` | 修改 | +`GET /check-dates`；+`POST /batch-update-dates`；+`normalizeDate`；批量上传 +PDF 保存 |
| `server/models/instrument.js` | 修改 | +`certificate_file` 读写；`purgeDeleted` +证书目录清理 |
| `server/models/db.js` | 修改 | +`certificate_file` 列迁移 |
| `server/app.js` | 修改 | +`uploads/certificates/` 目录创建 |
| `server/services/instrumentHistory.js` | 修改 | +`certificate_file` 历史字段；+`certificate_date_fix` 来源 |
| `client/src/views/InstrumentList.vue` | 修改 | +证书日期校验按钮/对话框；+附件列；+`Document`/`Setting` 图标 |
| `client/src/api/instruments.js` | 修改 | +`checkCertDates()`；+`batchUpdateCertDates()`；+5个规则 API |
| `client/src/utils/instrumentHistory.js` | 修改 | +`certificate_date_fix` 来源标签 |
| `docs/design-validity-rules-config.md` | **新增** | 有效日期规则配置设计文档 |

共 **9 个文件**（1 新增）。
