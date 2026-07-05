# 批量上传证书后同步更新检验日期和有效日期 — 设计文档

## 1. 概述

批量上传 PDF 证书并匹配器具后，自动从证书编号中提取**检验日期**，并根据可配置的有效日期规则计算**有效日期**，连同证书 PDF 附件一并写入数据库。

## 2. 业务规则

### 2.1 检验日期提取

从证书编号中提取 8 位日期 `YYYYMMDD`。实现函数：`extractInspectionDate(certNo)`，位于 `server/routes/certificate.js`。

**策略一：H1-ZX1 标准格式**（覆盖 95%+ 的新证书）

定位 `-H1-ZX1-` 标记，其后第一段 10 位日期码的前 8 位 = 检验日期。示例：
```
YB-H1-ZX1-20250712106-7037589
              ^^^^^^^^ → 2025-07-12
```

**策略二：正则提取**（紧凑格式兜底）

遍历证书编号中所有 8 位数字，取首个年份在 2020-2027 范围内且月日合法的作为检验日期。示例：
```
ZSYQJCYL20260323003 → 20260323 → 2026-03-23
```

**不提取的情况**：旧版格式 `YLB-ZX1-2020080745` 中的日期是首次检定日期（非当前检验），返回 `null`。

### 2.2 有效日期计算（可配置规则）

有效日期不再硬编码，改为从 `validity_rules` 表读取规则动态计算。实现函数：`calculateValidUntil(inspectionDate, category, classification)` → 委托给 `ValidityRules.calculateValidUntil()`。

> 规则表由 `server/models/validityRules.js` 管理，详见 [design-validity-rules-config.md](design-validity-rules-config.md)。

**默认规则**（首次初始化时自动插入）：

| 优先级 | 类别 | 分类 | 有效期 | 说明 |
|--------|------|------|--------|------|
| 15 | 普通压力表 | C | 3年 | |
| 15 | 耐震压力表 | C | 3年 | |
| 10 | 压力表 | C | 3年 | |
| 5 | 压力表 | NULL | 6月 | A/B/未知 |
| 5 | 普通压力表 | NULL | 6月 | |
| 5 | 耐震压力表 | NULL | 6月 | |
| 0 | *（默认） | NULL | 1年 | 兜底 |

**匹配逻辑**：按优先级从高到低，首个 `category` 匹配且 `classification` 匹配的规则生效。分类值已通过 `getClassification()` 去除"类"后缀（`A类→A`），与规则表中的 `A/B/C` 精确匹配。

**兜底**：未匹配到任何规则时，默认 +1年−1天。

### 2.3 分类提取

`classification` 存储在 `extra_fields` JSON 列中。实现函数：`getClassification(instrument)`，位于 `server/routes/certificate.js`。

**关键**：数据库存储值为 `"A类"`、`"B类"`、`"C类"`（带"类"后缀），函数会去掉后缀返回 `"A"`、`"B"`、`"C"`，确保与规则表匹配。

## 3. 修改范围

### 3.1 后端

#### `server/routes/certificate.js`

新增 4 个辅助函数（模块作用域）：

| 函数 | 说明 |
|------|------|
| `extractInspectionDate(certNo)` | 从证书编号提取 YYYY-MM-DD |
| `calculateValidUntil(date, category, classification)` | 委托 ValidityRules 计算有效日期 |
| `getClassification(instrument)` | 从 extra_fields JSON 提取分类（去"类"后缀） |
| `normalizeDate(dateStr)` | 标准化日期字符串用于对比（去分隔符） |

修改 `POST /api/certificate/batch-upload` 匹配逻辑：
- 单条匹配分支：提取检验日期 + 查分类 + 计算有效日期 → 一并更新 `certificate_number`、`inspection_date`、`valid_until`
- 多条匹配分支：同上
- 两个分支都增加了 PDF 文件持久化存储（复制到 `uploads/certificates/{id}/`）

响应结果新增字段：`extractedInspectionDate`、`classification`、`calculatedValidUntil`、`dateExtracted`、`savedCertificateFile`。

#### `server/models/validityRules.js`（新增）

规则 CRUD + `calculateValidUntil` 核心计算。`init()` 在 `server/app.js` 中数据库初始化后调用。

#### `server/models/instrument.js`

- `create()` / `update()` 列新增 `certificate_file`
- `updateCertificateBySerialNo()` / `updateCertificateBySerialNoAndCategory()` 新增 `certificate_file` 字段
- `purgeDeleted()` 永久删除时清理 `uploads/certificates/{id}/` 目录
- 引入 `fs` + `path` 模块

#### `server/models/db.js`

instruments 表迁移新增 `certificate_file TEXT` 列。

#### `server/app.js`

- 启动时创建 `uploads/certificates/` 目录
- `start()` 中调用 `ValidityRules.init()` 初始化规则表 + 种子数据

#### `server/services/instrumentHistory.js`

- `FIELD_LABELS` 新增 `certificate_file: '证书附件'`
- `SOURCE_LABELS`（客户端 `client/src/utils/instrumentHistory.js`）新增 `certificate_date_fix: '证书日期校验修正'`

### 3.2 前端

#### `client/src/views/InstrumentList.vue`

批量上传结果表格新增两列：
- **检验日期**（110px）— 显示 `extractedInspectionDate`
- **有效日期**（110px）— 显示 `calculatedValidUntil`

#### `client/src/api/instruments.js`

无需新增函数（`batchUploadCertificates` 返回的响应中已包含新字段）。

## 4. 边界情况

| 场景 | 处理 |
|------|------|
| 证书编号无法提取日期 | `inspectionDate=null`，仅更新证书编号 |
| 器具无分类 | `getClassification` 返回 `null`，规则匹配时走 `classification IS NULL` 的规则 |
| 同编号多条匹配 | 每条匹配器具独立计算有效日期 |
| 检验日期格式异常 | try-catch 保护，失败跳过日期更新 |
| 旧版证书（YLB-ZX1-YYYYMMDD##） | 策略一不匹配、策略二提取到的日期是旧日期，通常与检验日期不匹配 |
| PDF 保存失败 | 捕获异常记录 `certFileWarning`，不阻断匹配流程 |

## 5. 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/certificate.js` | 修改 | +4 辅助函数；匹配更新逻辑扩展；PDF 持久化 |
| `server/models/validityRules.js` | **新增** | 规则表 CRUD + calculateValidUntil |
| `server/models/instrument.js` | 修改 | +certificate_file 读写；删除时清理证书目录 |
| `server/models/db.js` | 修改 | +certificate_file 列迁移 |
| `server/app.js` | 修改 | +certificates 目录创建；+ValidityRules.init() |
| `server/services/instrumentHistory.js` | 修改 | +certificate_file 历史追踪 |
| `client/src/views/InstrumentList.vue` | 修改 | 结果表格 +检验日期 +有效日期列 |
| `client/src/utils/instrumentHistory.js` | 修改 | +certificate_date_fix 来源标签 |

共 **8 个文件**（1 新增）。
