# 证书附件自动关联 & 重复编号处理 — 设计文档

## 1. 问题

### 1.1 附件未关联

批量上传证书匹配成功后，证书 PDF 应该自动保存到对应器具的附件列。当前代码已经部分实现了这个逻辑（`savedCertificateFile`），但前端没有在表格中展示，用户无法点击查看。

### 1.2 重复编号静默处理

当同一出厂编号在系统中有多条记录时（例如同编号的压变和温变，或同类别下两条重复记录），当前逻辑：

| 场景 | 当前行为 | 问题 |
|------|---------|------|
| 同编号同类别多条 | 全部更新，提示警告 | 用户可能只想更新其中一条 |
| 同编号不同类别 | 按类别精确匹配 | 如果类别识别不准确（文件名前缀解析错误），匹配到错误的记录 |
| 同编号无类别信息 | 标记 unmatched | 不提供手动选择入口 |

用户需要：弹窗展示所有匹配到的器具，**让用户自己选择**对应哪一条。

## 2. 方案

### 2.1 附件列展示

在台账列表的"附件"列，有 `certificate_file` 时显示 PDF 图标，点击在新标签页打开。

当前前端已实现附件列（显示 PDF 图标按钮），只需确认后端保存逻辑正确。

**后端确认**：batch-upload 匹配成功后的 PDF 保存逻辑已存在（`server/routes/certificate.js` 第 236-246 行），但路径在 `uploads/certificates/{instrument_id}/` 下，通过 `uploadsAuth` 鉴权访问。

**需要改动**：确保 `updateData` 中的 `certificate_file` 被传给 `updateCertificateWithHistoryBySerialNoAndCategory`，该函数内部调用 `updateWithHistory`，而 `update()` 的字段列表已包含 `certificate_file`（上次修改已添加）。

### 2.2 重复编号弹窗处理

#### 触发条件

batch-upload 中，`instruments.length > 1`（同编号多条匹配）时。

#### 新行为

不再全部静默更新，而是：

1. 后端在匹配结果中返回**所有匹配到的器具详情**
2. 前端展示弹窗，列出每条器具的完整信息
3. 用户选择一条或多条
4. 确认后仅更新选中的器具

#### 后端改动

`server/routes/certificate.js` 的 batch-upload 中：

```js
// 当前：多条匹配时取 instruments[0]
// 改为：标记为 multi_match 状态，返回所有匹配项

if (instruments.length > 1) {
  fileResult.status = 'multi_match';
  fileResult.matchedInstruments = instruments.map(inst => ({
    id: inst.id,
    category: inst.category,
    serial_number: inst.serial_number,
    installation_location: inst.installation_location,
    model: inst.model,
    manufacturer: inst.manufacturer,
    certificate_number: inst.certificate_number,
    inspection_date: inst.inspection_date,
    valid_until: inst.valid_until
  }));
  fileResult.tempFilePath = file.path;
  multiMatchCount++;
}
```

#### 新增 API

**`POST /api/certificate/confirm-match`** — 用户选择后确认匹配

```json
// Request
{
  "tempFilePath": "uploads/temp_certs/xxx.pdf",
  "certificateNumber": "YB-H1-ZX1-20250712106-7037589",
  "serialNumber": "7037589",
  "category": "压力变送器",
  "selectedInstrumentIds": [42, 43],
  "updateAll": true
}
```

与 `force-match` 类似，但支持批量选择多个目标器具。

### 2.3 前端弹窗设计

```
┌──────────────────────────────────────────────────────┐
│  ⚠ 出厂编号 "7037589" 匹配到 3 条器具               │
│                                                     │
│  证书：YB-H1-ZX1-20250712106-7037589.pdf            │
│  类别：压力变送器  出厂编号：7037589                 │
│  检验日期：2025-07-12  有效日期：2026-07-11          │
│                                                     │
│  请选择要关联此证书的器具（可多选）：                 │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ ☑ #42 │ 压力变送器 │ B生产二层平台            │   │
│  │       │ 型号: EJA430A │ 厂家: 横河           │   │
│  │       │ 当前证书: YB-...-20240712106         │   │
│  │       │ 检验日期: 2024-07-12                │   │
│  ├──────────────────────────────────────────────┤   │
│  │ ☐ #88 │ 压力变送器 │ A生产一层平台            │   │
│  │       │ 型号: EJA430A │ 厂家: 横河           │   │
│  │       │ 当前证书: (空)                       │   │
│  │       │ 检验日期: (空)                       │   │
│  ├──────────────────────────────────────────────┤   │
│  │ ☐ #105│ 温度变送器 │ B生产二层平台            │   │
│  │       │ 型号: WTZ-288 │ 厂家: 昆山圣科       │   │
│  │       │ ⚠ 类别不一致                         │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [全部跳过]              [确认所选（1条）]           │
└──────────────────────────────────────────────────────┘
```

每条器具卡片展示：
- 基本信息：类别、出厂编号、安装位置、型号、厂家
- 证书信息：当前证书编号、检验日期、有效日期
- 如果类别与证书不一致 → 黄色警告标记

**交互**：
- 默认勾选所有同类别、同编号的器具
- 跨类别的器具默认不勾选，标记"类别不一致"
- 可多选
- "全部跳过" → 该证书保持 unmatched
- "确认所选" → 调用 `POST /api/certificate/confirm-match`

### 2.4 编号列表界面改造

在批量上传结果表格中，"multi_match" 状态的行显示为：

```
⚠ 多条匹配（3条）  [处理]
```

点击"处理" → 弹出上述选择弹窗。

## 3. 文件变更

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/certificate.js` | 修改 | batch-upload 中多条匹配改为 `multi_match` 状态，返回所有匹配项详情 |
| `server/routes/certificate.js` | 修改 | 新增 `POST /confirm-match` 端点（批量选择确认匹配） |
| `client/src/views/InstrumentList.vue` | 修改 | 批量上传结果表中增加 `multi_match` 状态展示 + 选择弹窗 |
| `client/src/api/instruments.js` | 修改 | 新增 `confirmCertMatch` API 函数 |

共 **3 个文件**（0 新增）。

## 4. 边界情况

| 场景 | 处理 |
|------|------|
| 所有候选器具都被用户跳过 | 证书保持 unmatched，tempFile 保留供后续使用 |
| 用户选择跨类别的器具 | 允许但记录 warning |
| 同一证书被确认到多个器具 | 允许（同一编号确实可能对应多个物理器具），全部更新 |
| multi_match 但无可选项（数据异常） | 回退到 unmatched 状态 |
