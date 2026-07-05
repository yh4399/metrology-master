# 计量器具修改历史、版本恢复与回收站设计

## 目标

为个人使用的计量器具台账增加轻量、可靠的变更追踪：任何器具数据变化都能看到修改时间、来源和具体字段差异；可恢复到任意历史版本；删除的器具进入回收站并可恢复。

## 范围

### 包含

- 手动新增、编辑器具时记录历史。
- 批量上传证书匹配成功后，对每条实际更新的器具记录历史。
- Excel 导入新增器具时记录创建来源。
- 每次记录修改前、修改后的完整快照以及字段差异。
- 列表中在证书编号旁显示“已更新”标记和最近更新时间。
- 点击标记查看该器具完整历史。
- 从任意历史版本恢复；恢复本身生成新的历史记录，不删除原历史。
- 单条删除改为软删除；回收站支持恢复和彻底删除。
- 按类别清空和清空全部仍保留现有明确语义，不批量写入回收站，避免个人工具产生大量误导性的回收记录；执行前仍使用现有确认框。

### 不包含

- 多用户审批、复杂权限、电子签名。
- 文件附件的版本恢复。
- 将整次 Excel 导入作为一个事务整体撤销。
- 自动恢复已被物理删除的旧数据。

## 数据设计

### instruments 表扩展

- `is_deleted INTEGER DEFAULT 0`：是否进入回收站。
- `deleted_at TEXT`：删除时间。
- `latest_change_at TEXT`：最近一次被历史系统记录的变化时间。
- `latest_change_summary TEXT`：最近一次变化摘要，例如“证书编号、有效期”。

启动时通过幂等迁移检查并补充字段，兼容现有数据库。

### instrument_versions 表

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `instrument_id INTEGER NOT NULL`
- `action TEXT NOT NULL`：`create`、`update`、`certificate_upload`、`restore_version`、`delete`、`restore_deleted`
- `source TEXT NOT NULL`：中文展示来源或稳定来源代码
- `before_data TEXT`：修改前完整 JSON 快照
- `after_data TEXT`：修改后完整 JSON 快照
- `diff_data TEXT`：字段差异 JSON 数组，每项包含 `field`、`label`、`before`、`after`
- `operator_id INTEGER`：当前登录用户 ID，可为空
- `created_at TEXT DEFAULT (datetime('now','localtime'))`

索引覆盖 `instrument_id` 和 `created_at`。

## 后端结构

新增 `server/services/instrumentHistory.js`，集中负责：

- 业务字段白名单和中文标签。
- 规范化 JSON 字段，忽略 `updated_at` 等系统字段。
- 计算真实字段差异；没有差异时不创建无意义版本。
- 写入版本快照并更新器具的最近变化摘要。

器具模型提供带历史语义的方法：

- `createWithHistory(data, context)`
- `updateWithHistory(id, data, context)`
- `softDelete(id, context)`
- `listHistory(id)`
- `restoreVersion(id, versionId, context)`
- `listDeleted(params)`
- `restoreDeleted(id, context)`
- `purgeDeleted(id)`

正常列表、详情、统计、导出、证书匹配默认排除 `is_deleted = 1`。证书批量上传按匹配到的每个器具 ID 分别调用历史更新，重复记录也各自留下准确记录。

## API

- `GET /api/instruments/:id/history`：返回完整历史，时间倒序。
- `POST /api/instruments/:id/history/:versionId/restore`：恢复到该版本的 `after_data`；若该版本是删除记录，则使用其 `before_data`。
- `GET /api/instruments/recycle-bin/list`：分页返回已删除器具。
- `POST /api/instruments/recycle-bin/:id/restore`：从回收站恢复。
- `DELETE /api/instruments/recycle-bin/:id/purge`：彻底删除器具及其版本历史。

以上固定路由必须注册在 `/:id` 动态路由之前。

## 前端交互

### 台账列表

- 证书编号保持现有展示。
- 有 `latest_change_at` 的记录在证书编号旁显示绿色“已更新”标签。
- 标签下显示最近更新时间；悬停或旁边显示最近变化摘要。
- 点击标签打开历史抽屉，不增加主表列宽负担。

### 历史抽屉

- 顶部显示器具类别和出厂编号。
- 时间线按新到旧显示来源、时间和字段变化。
- 字段变化显示为“字段：旧值 → 新值”，空值统一显示“空”。
- 每个可恢复版本提供“恢复到此版本”按钮，二次确认后执行恢复并刷新列表和历史。

### 回收站

- 台账工具栏增加“回收站”入口。
- 对话框展示类别、出厂编号、安装位置、删除时间。
- 支持“恢复”和“彻底删除”；彻底删除需要二次危险确认。

## 错误与边界处理

- 提交内容与现有值相同时不创建版本，只返回“未发生变化”。
- 恢复版本前验证版本属于当前器具。
- 已删除器具不能通过普通详情、编辑、导出和证书匹配访问。
- 恢复被删除器具时保留原 ID 和全部历史。
- 彻底删除同时删除版本历史，且不可恢复。
- 旧数据库首次升级只新增字段和表，不为既有历史虚构版本。
- `extra_fields` 以对象进行字段级比较，历史界面使用可读 JSON；其他字段使用中文名称。

## 测试策略

- 使用 Node 内置 `node:test`，不新增测试框架依赖。
- 单元测试覆盖差异计算、空差异、JSON 规范化和中文摘要。
- 模型测试使用临时数据库覆盖创建、编辑、历史恢复、软删除、回收站恢复和彻底删除。
- 路由关键行为通过模型/服务测试与语法检查覆盖。
- 前端通过生产构建验证模板、API 引用和组件编译。
- 最后手动验证：编辑字段、证书上传、历史查看、版本恢复、删除、回收站恢复。

## 验收标准

1. 修改任意业务字段后，列表立即出现“已更新”和时间。
2. 历史中准确显示本次变化的中文字段名、旧值和新值。
3. 批量证书上传成功后，每条实际更新的器具都有独立记录。
4. 恢复旧版本后器具数据正确，且新增一条“版本恢复”历史。
5. 单条删除后器具不出现在正常列表，但出现在回收站。
6. 从回收站恢复后器具重新出现在正常列表，历史仍完整。
7. 彻底删除后器具和历史均不可查询。
8. 现有筛选、统计、导出和证书匹配不包含回收站数据。
