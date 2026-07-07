# 台账总表存储 & 查看 — 设计文档

## 1. 问题

当前"保存台账"按钮调用 `GET /api/instruments/export/ledger` 导出全部数据为 Excel。但用户的本意不是导出，而是：**把定期维护的总台账 Excel 文件存放在系统里，随时可以打开查看**。

用户的工作流是：
- 在本地用 Excel 维护一份完整的台账总表（多 Sheet，每 Sheet 一个类别）
- 定期更新后，上传到系统作为"存档"
- 需要时在系统里打开查看（下载后用本地 Excel 打开）

## 2. 方案

### 2.1 存储

```
server/uploads/ledger/
└── 台账总表.xlsx        ← 固定文件名，覆盖式上传
```

单文件覆盖模式 — 同一时间只有一份台账总表。不需要版本管理或多文件支持。

### 2.2 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/instruments/ledger/upload` | 上传台账总表 Excel，保存到固定路径 |
| `GET` | `/api/instruments/ledger` | 下载台账总表文件（浏览器触发下载/打开） |
| `GET` | `/api/instruments/ledger/info` | 获取台账文件信息（是否存在、文件名、大小、上传时间） |

#### POST /api/instruments/ledger/upload

multer 单文件上传，`.xlsx/.xls` 限制，保存为 `server/uploads/ledger/台账总表.xlsx`。

**Response:**
```json
{
  "code": 200,
  "data": {
    "fileName": "台账总表.xlsx",
    "size": 311138,
    "uploadedAt": "2026-07-07 15:30:00"
  },
  "message": "台账总表已保存"
}
```

#### GET /api/instruments/ledger

直接返回文件流，`Content-Disposition: attachment`，浏览器下载后用本地 Excel 打开。

#### GET /api/instruments/ledger/info

**Response:**
```json
{
  "code": 200,
  "data": {
    "exists": true,
    "fileName": "台账总表.xlsx",
    "size": 311138,
    "uploadedAt": "2026-07-07 15:30:00"
  }
}
```

### 2.3 前端

工具栏按钮改造：

```html
<!-- 原来：导出按钮 -->
<el-button plain @click="exportLedger">保存台账</el-button>

<!-- 改为：台账总表管理 -->
<el-button plain @click="openLedger">
  <el-icon><FolderOpened /></el-icon> 查看台账总表
</el-button>
<el-button plain @click="uploadLedgerDialog = true">
  <el-icon><Upload /></el-icon> 上传台账总表
</el-button>
```

**查看台账总表**：
- 如果有文件 → 下载（`window.open('/api/instruments/ledger?token=...')`）
- 如果无文件 → 提示"尚未上传台账总表，请先上传"

**上传台账总表**：
- 弹出对话框，el-upload 选择文件
- 确认上传 → `POST /api/instruments/ledger/upload`
- 上传成功后显示文件信息

### 2.4 删除原"保存台账"功能

`GET /api/instruments/export/ledger` 端点保留（可能其他地方用到），但前端 `exportLedger` 函数和按钮改为台账总表管理。

## 3. 文件变更

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/routes/instruments.js` | 修改 | 新增 `POST /ledger/upload`、`GET /ledger`、`GET /ledger/info` 三个端点；注册在 `/:id` 之前 |
| `server/app.js` | 修改 | 启动时创建 `uploads/ledger/` 目录 |
| `client/src/views/InstrumentList.vue` | 修改 | "保存台账"按钮改为"查看台账总表"+"上传台账总表"；新增上传对话框 |
| `client/src/api/instruments.js` | 修改 | 新增 `uploadLedger`、`getLedgerInfo` |

共 **4 个文件**（0 新增）。
