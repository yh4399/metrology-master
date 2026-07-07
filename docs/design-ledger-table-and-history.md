# 台账总表表格美化 & 上传历史 — 设计文档

## 1. 表格美化

### 1.1 现状

当前台账查看对话框使用纯 HTML `<table>`，所有单元格左对齐、等宽、无冻结列。

### 1.2 目标

| 改进 | 方案 |
|------|------|
| 列宽自适应 | 遍历每列所有行，取最长内容计算像素宽度，作为最小宽度 |
| 内容居中 | `text-align: center`（序号和数字天然居中，文字也可接受） |
| 序号列冻结 | 第一列（序号）`position: sticky; left: 0` + 背景色 + 右侧阴影 |
| 表头行冻结 | 保持现有 `position: sticky; top: 0` |
| 斑马纹 | 数据行间隔背景色，提升可读性 |

### 1.3 实现

前端计算列宽：

```js
function computeColumnWidths(sheet) {
  const widths = []
  for (const row of sheet.rows) {
    for (let i = 0; i < row.length; i++) {
      const len = String(row[i] || '').length
      const w = Math.max(40, Math.min(len * 14 + 20, 300)) // 40px~300px
      widths[i] = Math.max(widths[i] || 0, w)
    }
  }
  return widths
}
```

CSS 冻结第一列：

```css
.ledger-table td:first-child,
.ledger-table th:first-child {
  position: sticky;
  left: 0;
  background: inherit;
  z-index: 2;
  box-shadow: 2px 0 4px rgba(0,0,0,0.06);
}
.ledger-table .header-row td:first-child {
  z-index: 4; /* 表头+冻结交叠处 */
}
```

### 1.4 文件变更

仅 `client/src/views/InstrumentList.vue` — 新增 `computeColumnWidths` + 修改 CSS + 模板中应用 `:style`。

---

## 2. 上传历史

### 2.1 存储方案

```
server/uploads/ledger/
├── 台账总表_20260701_143000.xlsx    ← 历史版本
├── 台账总表_20260705_091500.xlsx    ← 历史版本
└── 台账总表_20260707_153000.xlsx    ← 当前版本（最新）
```

每次上传以时间戳命名保存，不再覆盖。**查看/下载始终用最新文件**。

### 2.2 API 调整

| 方法 | 路径 | 变更 |
|------|------|------|
| `POST` | `/ledger/upload` | 不再覆盖，改为时间戳命名保存 |
| `GET` | `/ledger/view` | 不变，始终读取最新文件 |
| `GET` | `/ledger` | 改为 `?file=xxx` 下载指定版本，无参数下载最新 |
| `GET` | `/ledger/info` | 新增 `history` 字段返回全部历史列表 |
| `DELETE` | `/ledger` | 删除指定版本 `?file=xxx`（不能删除当前） |

### 2.3 前端交互

查看台账总表对话框顶部新增"历史版本"下拉或按钮：

```
┌──────────────────────────────────────────────┐
│ 📋 台账总表              [历史版本 ▾] [下载]  │
│                          │ 2026-07-07 15:30  │
│                          │ 2026-07-05 09:15  │
│                          │ 2026-07-01 14:30  │
├──────────────────────────────────────────────┤
│ [压变] [温变] [压力表] …                      │
│ …（表格内容）…                                │
└──────────────────────────────────────────────┘
```

点击历史版本 → 加载对应文件展示 + 下载按钮变为下载该版本。

### 2.4 API 详情

#### GET /ledger/info

```json
{
  "code": 200,
  "data": {
    "exists": true,
    "current": { "fileName": "台账总表_20260707_153000.xlsx", "size": 311138, "uploadedAt": "..." },
    "history": [
      { "fileName": "台账总表_20260707_153000.xlsx", "size": 311138, "uploadedAt": "..." },
      { "fileName": "台账总表_20260705_091500.xlsx", "size": 308421, "uploadedAt": "..." },
      { "fileName": "台账总表_20260701_143000.xlsx", "size": 305100, "uploadedAt": "..." }
    ]
  }
}
```

### 2.5 注意事项

- **不删除旧文件**：每次上传保留历史，不计上限（台账总表通常每月更新，文件量很小）
- **CRUD 始终操作当前版本**：增删改只对最新文件生效
- **历史版本只读**：查看和下载，不可编辑
- **查看时标题显示版本时间**：提醒用户当前看的是哪个版本

### 2.6 文件变更

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/instruments.js` | 修改 | `POST /ledger/upload` 改为时间戳保存；`GET /ledger/info` 返回历史列表；`GET /ledger` 支持 `?file=`；新增 `DELETE /ledger`（删历史版本） |
| `client/src/views/InstrumentList.vue` | 修改 | 表格美化（自适应列宽+居中+冻结）+ 历史版本切换 UI |
| `client/src/api/instruments.js` | 修改 | 新增 `deleteLedgerFile`；调整 `getLedgerInfo` 解析 |

共 **3 个文件**。
