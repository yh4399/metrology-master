# Instrument Change History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为每台计量器具记录完整修改历史，支持版本恢复，并通过软删除回收站恢复误删数据。

**Architecture:** 在 sql.js 中增加器具版本表和软删除元数据，由独立历史服务计算字段差异、保存前后快照。器具模型提供带历史语义的原子业务方法，路由只负责来源与用户上下文；前端通过历史抽屉和回收站对话框展示及执行恢复。

**Tech Stack:** Node.js、Express、sql.js、Node `node:test`、Vue 3、Element Plus、Axios。

---

### Task 1: 数据库迁移与差异计算服务

**Files:**
- Modify: `server/models/db.js`
- Create: `server/services/instrumentHistory.js`
- Create: `server/tests/instrumentHistory.test.js`

- [ ] **Step 1: 编写差异计算失败测试**

测试导出的 `buildDiff(before, after)`：忽略系统字段、识别证书编号变化、将 `extra_fields` JSON 规范化；测试 `buildSummary(diff)` 返回中文字段摘要。

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiff, buildSummary } = require('../services/instrumentHistory');

test('buildDiff returns readable business field changes', () => {
  const diff = buildDiff(
    { certificate_number: 'OLD', updated_at: '2026-01-01' },
    { certificate_number: 'NEW', updated_at: '2026-01-02' }
  );
  assert.deepEqual(diff, [{ field: 'certificate_number', label: '证书编号', before: 'OLD', after: 'NEW' }]);
  assert.equal(buildSummary(diff), '证书编号');
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node --test server/tests/instrumentHistory.test.js`

Expected: FAIL，提示找不到 `instrumentHistory` 模块。

- [ ] **Step 3: 实现最小差异服务**

导出 `FIELD_LABELS`、`TRACKED_FIELDS`、`normalizeValue`、`buildDiff`、`buildSummary`。仅比较器具业务字段；`extra_fields` 解析后稳定序列化，`null`、`undefined` 和空字符串按明确值处理，不把 `updated_at` 计入差异。

- [ ] **Step 4: 添加数据库幂等迁移**

在 `createAllTables()` 中创建 `instrument_versions`；通过 `PRAGMA table_info(instruments)` 检查并执行以下迁移：

```sql
ALTER TABLE instruments ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE instruments ADD COLUMN deleted_at TEXT;
ALTER TABLE instruments ADD COLUMN latest_change_at TEXT;
ALTER TABLE instruments ADD COLUMN latest_change_summary TEXT;
```

创建 `idx_versions_instrument`、`idx_versions_created`、`idx_ins_deleted`。

- [ ] **Step 5: 运行测试与语法检查并确认 GREEN**

Run: `node --test server/tests/instrumentHistory.test.js && node --check server/models/db.js && node --check server/services/instrumentHistory.js`

Expected: PASS，无语法错误。

### Task 2: 带历史的器具模型与恢复逻辑

**Files:**
- Modify: `server/models/instrument.js`
- Modify: `server/services/instrumentHistory.js`
- Create: `server/tests/instrumentVersionModel.test.js`

- [ ] **Step 1: 编写模型行为失败测试**

覆盖以下顺序：创建器具产生 `create` 版本；更新证书产生字段差异；无变化更新不产生版本；恢复旧版本产生 `restore_version`；软删除后普通查询不可见；回收站恢复后重新可见；彻底删除后历史一并消失。

测试使用临时数据库路径环境变量 `METROLOGY_DB_PATH`，因此 `db.js` 的 `DB_PATH` 需允许该变量覆盖默认路径。

- [ ] **Step 2: 运行模型测试并确认 RED**

Run: `node --test server/tests/instrumentVersionModel.test.js`

Expected: FAIL，提示 `createWithHistory` 或版本表接口不存在。

- [ ] **Step 3: 实现历史写入原语**

在历史服务中新增：

```js
recordVersion({ instrumentId, action, source, before, after, operatorId })
listVersions(instrumentId)
```

`recordVersion` 计算 `diff_data`，写版本记录，并更新 `latest_change_at/latest_change_summary`；`create/delete/restore_deleted` 即使字段 diff 为空也写动作记录。

- [ ] **Step 4: 实现模型业务方法**

新增 `createWithHistory`、`updateWithHistory`、`softDelete`、`listHistory`、`restoreVersion`、`listDeleted`、`restoreDeleted`、`purgeDeleted`。恢复时只回写 `TRACKED_FIELDS`，不覆盖 ID、创建时间和系统删除元数据；每个恢复动作都创建新版本。

- [ ] **Step 5: 默认排除回收站数据**

为 `categories/stats/list/findAll/findById/findBySerialNo/findBySerialNoAndCategory/findByIds/findExpiring/findExpired` 加上 `is_deleted = 0` 条件。`listDeleted` 是唯一默认查询 `is_deleted = 1` 的入口。

- [ ] **Step 6: 运行模型测试并确认 GREEN**

Run: `node --test server/tests/instrumentHistory.test.js server/tests/instrumentVersionModel.test.js`

Expected: 全部 PASS。

### Task 3: 历史、恢复与回收站 API

**Files:**
- Modify: `server/routes/instruments.js`
- Modify: `server/models/instrument.js`
- Create: `server/tests/instrumentRoutes.test.js`

- [ ] **Step 1: 编写路由失败测试**

使用临时数据库启动 Express，登录取得 token 后验证：`PUT /:id` 返回变化摘要；`GET /:id/history` 返回时间倒序历史；恢复端点拒绝不属于该器具的版本；删除后回收站可见；恢复和彻底删除状态正确。

- [ ] **Step 2: 运行路由测试并确认 RED**

Run: `node --test server/tests/instrumentRoutes.test.js`

Expected: FAIL，历史或回收站端点返回 404。

- [ ] **Step 3: 接入普通增删改历史**

路由使用：

```js
Instrument.createWithHistory(data, { source: 'manual_create', operatorId: req.userId })
Instrument.updateWithHistory(id, data, { source: req.body._changeSource || 'manual_edit', operatorId: req.userId })
Instrument.softDelete(id, { source: 'manual_delete', operatorId: req.userId })
```

写入前删除 `_changeSource`，防止进入器具字段。

- [ ] **Step 4: 增加固定 API 路由**

在 `GET /:id` 之前注册 `GET /recycle-bin/list`、`POST /recycle-bin/:id/restore`、`DELETE /recycle-bin/:id/purge`；增加 `GET /:id/history` 和 `POST /:id/history/:versionId/restore`。

- [ ] **Step 5: 运行路由测试并确认 GREEN**

Run: `node --test server/tests/instrumentRoutes.test.js`

Expected: 全部 PASS。

### Task 4: 证书批量匹配和导入来源接入

**Files:**
- Modify: `server/routes/certificate.js`
- Modify: `server/routes/instruments.js`
- Modify: `server/models/instrument.js`
- Modify: `server/tests/instrumentVersionModel.test.js`

- [ ] **Step 1: 编写证书批量更新失败测试**

创建两个同类别同编号器具，调用按编号和类别的带历史证书更新，断言两条器具分别产生 `certificate_upload` 历史且差异包含 `certificate_number`。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `node --test server/tests/instrumentVersionModel.test.js`

Expected: FAIL，证书更新没有历史记录。

- [ ] **Step 3: 让证书更新逐 ID 记录历史**

将匹配结果逐条调用：

```js
await Instrument.updateWithHistory(instrument.id, {
  certificate_number: fileResult.certificateNumber
}, { source: 'certificate_upload', operatorId: req.userId });
```

响应增加 `updatedInstrumentIds`，重复记录返回所有实际更新 ID。

- [ ] **Step 4: 接入 Excel 导入来源**

两个导入创建位置改用 `createWithHistory(data, { source: 'excel_import', operatorId: req.userId })`。种子脚本可继续使用原 `create`，避免开发初始化生成大量业务历史。

- [ ] **Step 5: 运行全部后端测试并确认 GREEN**

Run: `node --test server/tests/*.test.js && node --check server/routes/certificate.js && node --check server/routes/instruments.js`

Expected: 全部 PASS。

### Task 5: 前端 API、历史抽屉与更新标记

**Files:**
- Modify: `client/src/api/instruments.js`
- Create: `client/src/components/InstrumentHistoryDrawer.vue`
- Modify: `client/src/views/InstrumentList.vue`

- [ ] **Step 1: 增加前端 API 封装**

新增 `getInstrumentHistory(id)`、`restoreInstrumentVersion(id, versionId)`、`getRecycleBin(params)`、`restoreDeletedInstrument(id)`、`purgeDeletedInstrument(id)`。

- [ ] **Step 2: 创建历史抽屉组件**

组件 props 为 `modelValue`、`instrument`，emits 为 `update:modelValue`、`restored`。打开时拉取历史；按时间线显示 `source`、`created_at` 和 `diff_data`，空值显示“空”；恢复按钮二次确认后调用 API。

- [ ] **Step 3: 在证书编号旁加入更新标记**

仅当 `row.latest_change_at` 存在时显示绿色可点击标签：

```vue
<el-tag type="success" size="small" @click="openHistory(row)">已更新</el-tag>
<small>{{ formatDateTime(row.latest_change_at) }} · {{ row.latest_change_summary }}</small>
```

点击打开历史抽屉；恢复成功后重新加载列表。

- [ ] **Step 4: 构建验证**

Run: `npm --prefix client run build`

Expected: Vite 构建成功，无 Vue 模板或导入错误。

### Task 6: 回收站界面与端到端回归

**Files:**
- Create: `client/src/components/InstrumentRecycleBin.vue`
- Modify: `client/src/views/InstrumentList.vue`
- Modify: `client/src/api/instruments.js`

- [ ] **Step 1: 创建回收站组件**

组件打开时分页加载已删除器具，展示类别、出厂编号、安装位置、删除时间；恢复使用普通确认，彻底删除使用危险确认并明确“不可恢复”。

- [ ] **Step 2: 增加工具栏入口**

在台账列表工具栏加入“回收站”按钮。恢复成功后刷新正常列表；彻底删除只刷新回收站。

- [ ] **Step 3: 完整自动验证**

Run: `node --test server/tests/*.test.js && npm --prefix client run build`

Expected: 后端测试全部 PASS，前端构建成功。

- [ ] **Step 4: 手动业务验证**

启动项目后依次验证：手动修改两个字段 → 查看中文差异 → 批量上传证书 → 查看证书来源历史 → 恢复旧版本 → 删除 → 回收站恢复 → 再次删除并彻底删除。确认正常列表、统计和导出均不包含回收站数据。

- [ ] **Step 5: 对抗性代码审查**

重点审查动态路由顺序、回收站数据泄漏、错误版本跨器具恢复、批量证书重复编号、无变化更新、JSON 字段差异、彻底删除的一致性；发现问题后补失败测试再修复。

