# 进度日志

## 会话：2026-05-31（导出+批量证书任务）

### 阶段 1：需求与发现
- **状态：** complete
- 执行的操作：
  - 复制参考文件到项目目录
  - 分析参考Excel文档的精确格式
  - 分析PDF证书命名规则和前缀映射
  - 分析现有导出和证书代码
- 创建/修改的文件：
  - task_plan.md（重写为新任务）
  - findings.md（重写为新发现）

### 阶段 2：实现导出格式匹配
- **状态：** complete
- 执行的操作：
  - 后端新增 `/api/instruments/export/management-summary` 端点
  - 后端修改 `/api/instruments/export` 支持 ids 参数
  - 新增 Model 方法: `findByIds`, `findBySerialNo`, `updateCertificateBySerialNo`
  - 前端添加表格选择列、导出下拉菜单
  - 前端新增 `exportManagementSummary` API 函数
- 创建/修改的文件：
  - server/models/instrument.js（修改）
  - server/routes/instruments.js（修改）
  - client/src/api/instruments.js（修改）
  - client/src/views/InstrumentList.vue（修改）

### 阶段 3：实现批量上传证书
- **状态：** complete
- 执行的操作：
  - 后端新增 `/api/certificate/batch-upload` 端点
  - 实现文件名解析（前缀→类别、提取出厂编号）
  - 实现自动匹配+自动填入证书编号
  - 前端添加批量上传证书对话框
  - 前端新增 `batchUploadCertificates` API 函数
- 创建/修改的文件：
  - server/routes/certificate.js（修改）
  - client/src/api/instruments.js（修改）
  - client/src/views/InstrumentList.vue（修改）

### 阶段 4：测试与验证
- **状态：** complete
- 执行的操作：
  - 4个关键文件语法检查全部通过
  - 服务器启动成功，代码加载正常
  - 批量上传证书失败Bug修复（2026-05-31）
- 创建/修改的文件：
  - task_plan.md（更新）
  - progress.md（更新）
  - client/src/api/instruments.js（修复Content-Type头）

### 阶段 4.1：Bug修复 — 批量上传证书失败（Content-Type）
- **状态：** complete
- **根本原因：** `batchUploadCertificates` API函数手动设置 `Content-Type: multipart/form-data`，导致浏览器不添加 `boundary` 参数，multer 无法解析请求体
- **修复：** 删除手动 Content-Type 头，让 axios 自动生成
- **影响文件：** `client/src/api/instruments.js` 第62-65行

### 阶段 4.2：Bug修复 — 批量上传404错误（路由未注册）
- **状态：** complete
- **根本原因：** `server/app.js` 中未注册 `/api/certificate` 路由，虽然 `server/routes/certificate.js` 定义了端点但 Express 不知道它的存在
- **修复：** 添加 `app.use('/api/certificate', require('./routes/certificate'))`
- **影响文件：** `server/app.js` 第43行（新增）

### 阶段 4.3：增强 — 支持含连字符的出厂编号（如 1807P-21621-11537）
- **状态：** complete
- **需求：** `YLB-Y-H1-ZX1-2026051806-1807P-21621-11537` 类型的证书，出厂编号为 `1807P-21621-11537`
- **修复：** 检测 `-H1-ZX1-` 标记，跳过日期码后将剩余段全部拼接为出厂编号
- **逻辑：** 含 `-H1-ZX1-` → 跳过首段(日期码) → 剩余 join('-') = 出厂编号；不含 → 回退取末段
- **影响文件：** `server/routes/certificate.js` 第119-143行

## 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/models/instrument.js` | 修改 | 新增 findBySerialNo, findByIds, updateCertificateBySerialNo |
| `server/routes/instruments.js` | 修改 | 新增 /export/management-summary 端点，/export 支持 ids |
| `server/routes/certificate.js` | 修改 | 新增 /batch-upload 批量上传证书端点 |
| `client/src/api/instruments.js` | 修改 | 新增 exportManagementSummary, batchUploadCertificates |
| `client/src/views/InstrumentList.vue` | 修改 | 选择列、导出下拉菜单、批量上传证书对话框 |

---

---

## 会话：2026-06-01（六项功能完善）

### 阶段 1：需求与发现
- **状态：** complete
- 分析了参考模板、现有筛选逻辑、表格列定义、类别系统

### 阶段 2：修复日期筛选
- **状态：** complete
- **根本原因：** SQL中日期比较使用纯字符串比较，对于不同格式的日期值可能产生错误结果
- **修复：** 使用 `date(valid_until)` 函数进行日期比较，并添加 `IS NOT NULL` 条件
- **影响文件：** `server/models/instrument.js` — list() 和 findAll() 方法

### 阶段 3：前端表格列调整
- **状态：** complete
- 添加"分类管理"列（A类=红/B类=黄/C类=蓝），数据存储在 extra_fields.classification
- 压力表细分为普通压力表和耐震压力表
- 16种类别实现颜色区分（自定义背景+文字颜色方案）
- 新增/编辑表单添加分类管理下拉选择
- 修复 handleSubmit 中 extra_fields 被覆盖的bug
- 影响文件：
  - `client/src/utils/constants.js`
  - `client/src/views/InstrumentList.vue`
  - `client/src/views/InstrumentForm.vue`
  - `server/routes/instruments.js`
  - `server/routes/certificate.js`

### 阶段 4：新增导出检定申请表
- **状态：** complete
- 前端新增 `exportWarningApply` API 函数
- 后端 `/export/warning-apply` 新增 `ids` 参数支持
- 导出下拉菜单新增2个选项：检定申请表（选中/全部）
- 影响文件：
  - `client/src/api/instruments.js`
  - `client/src/views/InstrumentList.vue`
  - `server/routes/instruments.js`

### 阶段 5：验证与修复
- **状态：** complete
- JS模块语法检查通过
- Vue模板标签平衡验证通过
- 模块加载测试通过
- 修复 handleSubmit extra_fields 覆盖bug

---

## 历史会话：2026-05-31（OCR识别任务）- 已完成 ✅

### 阶段 3：实现
- 修改文件：server/routes/instruments.js, client/src/views/InstrumentForm.vue

### 阶段 4：测试与验证
- **状态：** complete

### 阶段 5：交付
- **状态：** complete

## 历史错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 2026-05-31 | Jimp 1.x API不兼容 | 1 | 解构导入+插件方法传参 |
| 2026-05-31 | 图片预处理降低OCR质量 | 1 | 回滚预处理，仅保留尺寸调整 |
| 2026-05-31 | 准确度检测误判数字0 | 1 | 移除字符类中的数字0 |
| 2026-05-31 | Jimp resize ZodError | 1 | 改为直接传参 |

---
## 会话：2026-06-01（五项新需求完善）

### 阶段 1：修复excel.js映射逻辑（Changes 4+3）
- **状态：** complete
- buildAutoMapping() 改为最长匹配优先算法
- 移除serial_number中过于宽泛的"编号"关键词
- certificate_number移至serial_number之前
- classification存储到extra_fields.classification
- FIELD_OPTIONS新增classification和mfg_date
- 影响文件：server/services/excel.js, client/src/utils/constants.js

### 阶段 2：多Sheet导入（Change 2）
- **状态：** complete
- ImportPage.vue支持多选Sheet（reactive Set + checkbox + 全选）
- 映射预览使用第一个选中Sheet
- handleImport发送sheetNames数组
- 后端import/confirm循环处理多Sheet
- 结果页显示各Sheet汇总表
- 影响文件：client/src/views/ImportPage.vue, server/routes/instruments.js

### 阶段 3：筛选叠加逻辑（Change 1）
- **状态：** complete
- activeFilterCount计算属性
- 筛选标签（keyword/category/status/date range）可单独关闭
- fetchList()中router.replace同步URL
- onMounted从route.query恢复所有筛选条件
- 影响文件：client/src/views/InstrumentList.vue

### 阶段 4：按类别清空数据（Change 5）
- **状态：** complete
- Instrument.deleteByCategory()模型方法
- DELETE /clear-by-category路由（注册在:id之前）
- clearByCategory() API函数
- 前端下拉菜单→对话框→类别选择器（含计数）
- ElMessageBox确认清空全部
- 影响文件：server/models/instrument.js, server/routes/instruments.js, client/src/api/instruments.js, client/src/views/InstrumentList.vue

### 阶段 5：验证
- **状态：** complete
- 所有JS模块语法检查通过
- 服务器模块加载验证通过
- 路由注册顺序验证通过
- 路由注册顺序已确认

## 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/services/excel.js` | 修改 | 最长匹配优先+证书编号修复+分类存extra_fields |
| `client/src/utils/constants.js` | 修改 | FIELD_OPTIONS新增classification和mfg_date |
| `client/src/views/ImportPage.vue` | 修改 | 多Sheet选择+全选控制+结果汇总 |
| `server/routes/instruments.js` | 修改 | import/confirm支持sheetNames数组+clear-by-category路由 |
| `server/models/instrument.js` | 修改 | 新增deleteByCategory方法 |
| `client/src/api/instruments.js` | 修改 | 新增clearByCategory函数 |
| `client/src/views/InstrumentList.vue` | 修改 | URL同步筛选+筛选标签+按类别清空对话框 |

## 历史错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 2026-06-01 | fetchList中query构建后未调用router.replace | 1 | 补回router.replace({ path: '/instruments', query }) |

---
*每个阶段完成后或遇到错误时更新此文件*

## 会话：2026-06-27（项目功能全量盘点）

- 已读取既有 `task_plan.md`、`findings.md`、`progress.md`，作为历史功能线索。
- 自动恢复脚本路径不存在，改为从当前源码重新核验。
- 当前阶段：目录、技术栈、入口和文档盘点。
- 已完成前端路由、API 封装、状态管理、基础字典和页面功能入口的第一轮核验。
- 已逐页核验仪表盘、预警、台账、表单、OCR、证书批量上传与 Excel 多 Sheet 导入逻辑；发现预警范围、导出筛选一致性和孤儿上传文件等问题。
- 已核验 JWT、默认账号/密钥、sql.js 持久化和器具模型，确认缺少角色权限、唯一约束、文件生命周期与审计查询。
- 已核验器具 CRUD、三套 Excel 导出、Excel 导入确认和 OCR；发现并发导入串文件、上传目录未鉴权及 OCR 路径穿越等高优先级问题。
- 已核验 Excel 映射和 PDF 证书流程，确认手动量程映射失效、证书保存旧接口失效、PDF 未真正关联台账等问题。
- 已检查安装脚本、忽略规则与文档；当前不是 Git 仓库，项目缺少正式 README、环境模板、跨平台部署和备份恢复说明。
- 使用系统化调试做了最小复现：确认手动量程字段映射失效；后端语法检查和前端临时目录生产构建均通过，构建存在大 chunk 警告。
- 只读检查当前数据库和上传目录：210 条器具存在大量重复出厂编号；0 条照片关联却已有约 40 MB、132 个上传文件，证实孤儿文件累积。
- 已完成工程与运维能力盘点：约 7,783 行核心源码，无自动化测试/CI/日志监控/备份恢复/角色审计，存在多项未使用依赖。
- 已完成全量功能地图、现状判断和按 P0/P1/P2 分级的完善建议，准备交付。

## 会话：2026-06-01（三项新需求完善）

### 阶段 6：修复清空数据计数Bug
- **状态：** complete
- **根因：** categoryDataCount() 仅统计 tableData（当前页），未获取全量数据
- **修复：** 新增 loadCategoryCounts() 调用 getInstrumentStats API，从 byCategory 获取真实计数
- **影响文件：** `client/src/views/InstrumentList.vue`

### 阶段 7：完善筛选功能（检验日期）
- **状态：** complete
- **新增：** 检验日期范围筛选器（el-date-picker），与有效日期筛选并列
- **后端：** Instrument.list()/findAll() 新增 inspectionFrom/inspectionTo SQL条件
- **前端：** URL同步、筛选标签、activeFilterCount计数、导出参数传递
- **影响文件：**
  - `server/models/instrument.js`
  - `client/src/views/InstrumentList.vue`

### 阶段 8：导入时区分普通/耐震压力表
- **状态：** complete
- **设计：** 新增 pressure_gauge_type 内部字段，"压力表类别"关键词映射
- **从 classification 中移除"压力表类别"关键词，避免与"分类管理"列冲突**
- **applyMapping 新增 pressure_gauge_type case：值为普通压力表/耐震压力表时覆盖 data.category**
- **同时存入 extra_fields.pressure_gauge_type 便于后续查阅**
- **影响文件：** `server/services/excel.js`

### 阶段 9：验证
- **状态：** complete
- 所有JS模块语法检查通过
- 服务器模块加载验证通过
- Client build 成功

## 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/services/excel.js` | 修改 | 新增pressure_gauge_type字段+applyMapping处理 |
| `server/models/instrument.js` | 修改 | list()/findAll()新增inspectionFrom/inspectionTo |
| `client/src/views/InstrumentList.vue` | 修改 | 检验日期筛选器+清空数据计数修复 |

## 历史错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 2026-06-01 | categoryDataCount只统计当前页 | 1 | 改用stats API的byCategory全量计数 |
| 2026-06-01 | "压力表类别"与"分类管理"冲突覆盖 | 1 | 分离为pressure_gauge_type独立字段 |

---

## 会话：2026-06-30（四智能体并行修复 P0/P1 缺陷）

### 阶段 1：修复 P0-2 手动量程字段映射失效
- **状态：** complete
- **根因：** applyMapping() 的 switch 语句无 rangeMin/rangeMax/rangeUnit case，前端手动映射量程字段时落入 default 分支写入 remark
- **修复：** 在 range_info 处理之后、default 之前新增三个 case，使用 `== null` 守卫确保 range_info 优先
- **影响文件：** `server/services/excel.js`

### 阶段 2：修复 P0-3 /uploads 目录无鉴权暴露
- **状态：** complete
- **根因：** `app.use('/uploads', express.static(...))` 无认证中间件，任何人可直接访问上传文件
- **修复：** 新建 `uploadsAuth.js` 中间件（支持 Bearer header 和 query string token），前端照片 URL 自动追加 token
- **影响文件：** `server/middleware/uploadsAuth.js`（新建）, `server/app.js`, `client/src/views/InstrumentForm.vue`, `client/src/views/InstrumentList.vue`

### 阶段 3：修复 P0-1 并发导入文件串扰
- **状态：** complete
- **根因：** `/import/confirm` 通过 findUploadedFile() 找最新文件，多用户并发时可能导入别人的文件
- **修复：** confirm 端点新增 filePath 参数 + path.resolve 路径穿越校验；前端保存 upload 返回的 _filePath 并回传
- **影响文件：** `server/routes/instruments.js`, `client/src/views/ImportPage.vue`

### 阶段 4：修复 P1-6 证书批量匹配不验证类别
- **状态：** complete
- **根因：** batch-upload 只按 serial_number 查找/更新，忽略文件名前缀解析出的类别
- **修复：** 新增 findBySerialNoAndCategory / updateCertificateBySerialNoAndCategory 方法；batch-upload 使用双重匹配
- **影响文件：** `server/models/instrument.js`, `server/routes/certificate.js`

### 阶段 5：交叉对抗性审查
- **状态：** complete
- 4 个修复由不同智能体进行对抗性审查，发现：
  - 量程映射：✅（理论 Infinity 边界，非阻塞）
  - 上传鉴权：⚠️ 2 个 blob URL bug + JWT URL 泄露风险
  - 导入隔离：✅
  - 证书匹配：⚠️ 警告文本不准确 + category=null 多条匹配风险

### 阶段 6：修复审查发现的问题
- **状态：** complete
- InstrumentForm.vue：photoDisplayUrl 优先取服务器 URL，blob URL 跳过 token，修正 blob 裂图
- InstrumentList.vue：photoUrlWithToken 跳过 blob URL
- certificate.js：警告文本改为"全部已更新"，category=null + 多条匹配时标记 unmatched 避免跨类别误写
- **影响文件：** `client/src/views/InstrumentForm.vue`, `client/src/views/InstrumentList.vue`, `server/routes/certificate.js`

### 阶段 7：验证
- **状态：** complete
- 所有后端 JS 文件语法检查通过
- 前端 Vite build 成功（289ms）

## 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/services/excel.js` | 修改 | applyMapping() 新增 rangeMin/rangeMax/rangeUnit case |
| `server/middleware/uploadsAuth.js` | **新建** | 上传文件鉴权中间件（Bearer + query token） |
| `server/app.js` | 修改 | /uploads 路由插入 uploadsAuth |
| `server/routes/instruments.js` | 修改 | confirm 端点支持 filePath 参数 + 路径穿越校验 |
| `server/models/instrument.js` | 修改 | 新增 findBySerialNoAndCategory / updateCertificateBySerialNoAndCategory |
| `server/routes/certificate.js` | 修改 | batch-upload 类别+编号双重匹配 + 安全分支 |
| `client/src/views/ImportPage.vue` | 修改 | 保存/回传 uploadedFilePath |
| `client/src/views/InstrumentForm.vue` | 修改 | photoDisplayUrl blob 判断 + 优先级修正 |
| `client/src/views/InstrumentList.vue` | 修改 | photoUrlWithToken blob 判断 |

## 历史错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 2026-06-30 | Workflow 脚本模板字面量导致解析错误 | 1 | 改用字符串拼接避免反引号 |
| 2026-06-30 | 审查发现 blob URL 被追加 token 导致裂图 | 1 | url.startsWith('blob:') 跳过 |
| 2026-06-30 | 审查发现证书警告文本与实际行为不一致 | 1 | 拆分分支 + 修正文本 |
