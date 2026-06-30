# 发现与决策

## 项目背景
- **计量器具台账管理系统 (Meterly)** — 用于管理企业计量器具的台账信息
- 支持器具分类、证书管理、到期预警、Excel 导入导出、PDF 证书生成
- 内嵌 Tesseract OCR 引擎，支持中英文文字识别

## 技术栈详情

### 后端 (server/)
- Express.js 5.2.1 — Web 框架
- sql.js 1.14.1 — SQLite 浏览器端实现（服务端使用）
- ExcelJS — Excel生成（已用于导出，支持精确样式控制）
- xlsx 0.18.5 — Excel读写
- pdf-parse 2.4.5 + pdfjs-dist 3.11.174 — PDF解析
- multer 2.1.1 — 文件上传
- jimp 1.6.1 — 图片处理

### 前端 (client/)
- Vue.js 3.x + Vite
- Element Plus UI 组件库
- Pinia 状态管理
- 单页应用 (SPA) 架构

## 研究发现

### 筛选逻辑分析 (2026-06-01)
- 前端filters对象包含 keyword, category, status, validDateRange
- 后端list()/findAll()使用SQL AND组合所有筛选条件
- 筛选条件已支持叠加，但缺少视觉反馈和URL持久化
- 新增：URL同步（router.replace）、筛选标签显示、URL恢复

### 导入多Sheet分析 (2026-06-01)
- 原系统只支持单Sheet选择（selectedSheetIdx单个整数）
- parseFile()已返回多Sheet概览但前端未利用
- Sheet卡片UI已存在，改为多选checkbox即可
- 后端需要循环处理多个Sheet并汇总结果

### Excel字段映射Bug分析 (2026-06-01)

**Bug 1: 证书编号误映射**
- `FIELD_PATTERNS`中serial_number关键词"仪表编号"匹配"仪表检定证书编号"的子串
- "编号"关键词过于宽泛，匹配所有含"编号"的列
- 修复：最长匹配优先算法 + 移除"编号"关键词 + certificate_number前置

**Bug 2: 分类管理存储路径不一致**
- 导入时classification存入remark（文本"分类:A;"）
- 显示时从extra_fields.classification读取（JSON路径）
- 修复：导入时统一存入extra_fields JSON

**Bug 3: FIELD_OPTIONS缺少选项**
- 下拉缺少classification和mfg_date，用户无法手动映射
- 修复：在constants.js的FIELD_OPTIONS中添加

### 清空数据功能分析 (2026-06-01)
- 原系统仅支持：DELETE /:id（单条）和DELETE /clear-all（全部）
- 新增：DELETE /clear-by-category（按类别），前端下拉菜单+对话框

## 技术决策
| 决策 | 理由 |
|------|------|
| 使用最长匹配优先算法 | 消除关键词顺序依赖，更准确映射 |
| 从serial_number移除"编号"关键词 | 太宽泛，误匹配证书编号等列 |
| classification存入extra_fields JSON | 与手动新增/编辑保持一致 |
| 前端使用reactive Set管理多选 | Set提供O(1)的has/delete/add操作 |
| 后端兼容sheetName/sheetNames | 向后兼容旧版API调用 |
| deleteByCategory注册在/:id之前 | Express路由匹配顺序要求 |

## 资源
- 参考文件：`data/ref_管理一览表.xlsx`, `data/ref_台账总表.xlsx`, `data/ref_certificate.pdf`
- 核心后端文件：`server/services/excel.js`, `server/models/instrument.js`, `server/routes/instruments.js`
- 核心前端文件：`client/src/views/ImportPage.vue`, `client/src/views/InstrumentList.vue`, `client/src/utils/constants.js`, `client/src/api/instruments.js`

## 三项新需求修复 (2026-06-01)

### 修复1：清空数据计数Bug
- **根因：** categoryDataCount() 用 `tableData.value.filter(r => r.category === cat).length` 只统计当前分页数据
- **修复：** loadCategoryCounts() → getInstrumentStats API → byCategory → 建立 categoryCounts Map
- **触发时机：** 打开按类别清空对话框时自动加载
- **文件：** client/src/views/InstrumentList.vue

### 修复2：检验日期筛选
- **新增：** 检验日期范围筛选器，与有效日期筛选独立并行
- **后端：** list()/findAll() 新增 inspectionFrom/inspectionTo → `date(inspection_date) >= date(?)` / `<= date(?)`
- **前端：** filters.inspectionDateRange、URL参数 inspectionFrom/inspectionTo、筛选标签、activeFilterCount、导出参数
- **文件：** server/models/instrument.js, client/src/views/InstrumentList.vue

### 修复3：导入时区分普通/耐震压力表
- **设计思路：** 参考文档"压力表"Sheet有"压力表类别"列（值：普通压力表/耐震压力表）和"分类管理"列（值：A类/B类/C类）
- **冲突：** 两列都匹配到 `classification` 关键词，后者覆盖前者
- **解决：** 新增 `pressure_gauge_type` 字段 + 关键词"压力表类别"，从 `classification` 关键词中移除"压力表类别"
- **applyMapping：** pressure_gauge_type 值为普通压力表/耐震压力表时 → data.category 覆盖为具体子类型
- **向后兼容：** 其他Sheet不受影响，压力表类别值同时存入 extra_fields.pressure_gauge_type
- **文件：** server/services/excel.js

## 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/services/excel.js` | 修改 | FIELD_PATTERNS新增pressure_gauge_type + applyMapping处理 |
| `server/models/instrument.js` | 修改 | list()/findAll()新增inspectionFrom/inspectionTo SQL条件 |
| `client/src/views/InstrumentList.vue` | 修改 | 检验日期筛选器 + 清空数据计数修复 + getInstrumentStats导入 |

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
*防止视觉信息丢失*

## 2026-06-27 当前源码盘点（阶段 1）

- 产品是单机/内网型「计量器具台账管理系统」，Vue 3 SPA + Express API，生产环境由 Express 直接托管 `client/dist`。
- 前端共 7 个主要页面：登录、仪表盘、台账列表、新增/编辑、批量导入、到期预警。
- 后端当前实际注册 API 仅有 `/api/auth`、`/api/instruments`、`/api/certificate`；仓库里的 `dashboard.js`、`import.js`、`export.js` 更可能是旧版 EJS 路由，需要进一步核验是否已废弃。
- 数据目录包含参考/测试 Excel、PDF 证书和大量上传文件，说明系统主要围绕 Excel 台账迁移和证书文件管理使用。
- 根目录和前后端 `package.json` 均未定义测试脚本；目前看不到自动化测试体系。
- `database/schema.sql` 是 MySQL 版本，但当前依赖和历史记录显示运行时使用 `sql.js`；存在双数据库设计资料不一致风险，需继续核验实际模型。
- Vue 路由只在客户端检查本地 token，真正的权限边界需要以后端中间件与路由挂载情况为准。

## 2026-06-27 前端能力初步核验

- 登录态：JWT 存在 `localStorage`，Axios 自动附加 Bearer Token；401 自动登出并跳转登录页。
- 台账：支持分页、关键词/类别/状态/检验日期/有效日期组合筛选，排序、勾选、单条删除、全部或按类别清空。
- 导出：普通台账、管理一览表、检定申请表，均有“选中/全部”语义。
- 证书：批量上传证书文件，按文件名解析类别与出厂编号后自动匹配台账。
- 图片：器具照片上传/删除，支持拍照或选择图片；OCR 可识别基础字段；列表还提供“拍照查仪表”。
- 导入：Excel 四步向导，支持多 Sheet 选择、逐 Sheet 字段映射、预览和逐行错误反馈。
- 预警：独立到期预警页和仪表盘即将到期列表，支持导出预警清单。
- 基础字典：17 个器具类别、4 种资产状态、3 种检验结果、多种量程单位；分类管理使用扩展字段承载。
- UI 中“个人信息”只有菜单项，没有点击处理/对应页面；属于明显的占位入口。
- `AppHeader.vue` 与 `App.vue` 存在两套顶部导航实现，目前主入口使用 `App.vue`，前者疑似遗留组件。
- 所有前端页面合计约 4,271 行，其中台账列表单文件达 1,617 行，后续维护风险较高。

## 2026-06-27 前端页面深度核验

- 仪表盘：总数、已过期、30 天内到期、分类排行、状态分布、到期明细及快捷新增。
- 器具表单字段：类别、分类管理、出厂编号、证书编号、型号、厂家、准确度、量程上下限/单位、安装位置、部门、检验/有效日期、检定单位、检验结果、状态、备注、照片。
- OCR 识别后只填充原本为空的字段，避免覆盖人工录入；可识别类别、编号、型号、厂家、量程、准确度、证书号、检定单位及可能的日期。
- Excel 导入会先把文件上传至服务端临时目录，再由确认请求按各 Sheet 的独立类别和映射执行；前端只校验“至少一个 Sheet 有映射”，没有要求每个选中 Sheet 都具备最小必填映射。
- 台账筛选状态会同步到 URL，可从仪表盘分类排行带条件跳转；搜索有 300ms 防抖。
- 台账支持当前页全选和“全部筛选结果”逻辑，但导出参数拼装在多个分支重复，部分分支遗漏 `classification`，容易造成“界面筛选结果”和“导出结果”不一致。
- 预警页“全部”模式没有传有效期范围，实际会列出所有器具，而不是全部预警器具；仪表盘“即将到期”只传 `validTo=未来30天`，也会混入已过期器具。这是现有功能正确性问题。
- 预警页“有效期内”统计用 `总数 - 已过期`，会把缺失有效日期的记录也算为有效，语义不准确。
- 登录页把默认账号密码 `admin/admin123` 直接预填在生产界面；“记住登录”复选框没有影响存储策略，JWT 始终写入 localStorage。
- 照片从表单移除只清空数据库字段，不删除服务器已上传文件；拍照查找上传的临时图片也没有清理，长期运行会累积孤儿文件。

## 2026-06-27 后端基础架构与权限核验

- 实际数据库是 `sql.js` 持久化到单个 `data/metrology.db` 文件；每次写操作都会完整 `export()` 并同步写盘。适合低并发单机使用，不适合多人高频并发或大数据量。
- 启动时自动建表并自动创建 `admin/admin123`；配置里的 JWT 密钥和 Session 密钥也有固定默认值。若未配置环境变量，部署后存在高风险默认凭据。
- API 同时启用了 JWT 和 Express Session，但当前业务只使用 JWT；Session 属于无效复杂度，默认 MemoryStore 也不适合生产。
- `/api/instruments` 全路由统一要求登录，证书路由也逐接口鉴权；但系统只有“已登录/未登录”，没有角色和操作权限。任意账号都能新增、修改、删除、清空全部数据、导入和导出。
- JWT 允许从 query string 读取，可能通过访问日志、浏览器历史或 Referer 泄露；现前端下载已使用 Authorization 头，因此这个兼容入口可以收紧。
- 数据模型没有出厂编号唯一约束，也没有版本/乐观锁；重复记录可能导致证书按出厂编号更新多条，且多人同时编辑会静默覆盖。
- 删除器具只删数据库行，不级联清理照片或证书文件；清空全部/按类别清空同样不处理关联文件。
- `import_logs` 有写入能力但没有查询 API 和前端页面，导入历史目前不可追踪、不可审计。
- `sql.js` 写入没有显式事务与原子替换策略；批量导入中断或进程异常时，恢复和一致性保障较弱。
- `findAll()` 的关键词范围比列表 `list()` 少了 `department`，会导致按部门关键词筛选后，列表与导出结果不一致。

## 2026-06-27 器具 API、导入与 OCR 深度核验

- 台账导出共三套：标准台账、按类别拆 Sheet 的管理一览表、检定申请表；均支持按 ID 或当前筛选条件导出，Excel 有表头样式、列宽、冻结窗格与打印布局。
- 管理一览表标题把“中心一号B生产二层平台”硬编码进文件，不可配置；检定申请表的“单位(盖章)”也是空白固定模板。
- 检定申请表把现有 `inspection_result`（如“合格”）放入“检定要求”列，业务语义可能不对，应改成用户填写的检定类型/要求。
- Excel 导入逐行直接落库，没有事务、预检、重复检测、覆盖/跳过策略，也无法在确认前给出新增/更新/重复统计；部分行成功后无法一键回滚。
- 导入确认阶段没有使用上传接口返回的 `_filePath` 或安全 token，而是从共享上传目录选择“最新 Excel 文件”。多用户或并发导入时可能导错别人的文件，是高优先级正确性与数据隔离问题。
- 客户端提交的 `fileName` 只用于日志显示，无法定位真实文件；服务端也未校验 sheetMappings 是否属于该次上传。
- 导入解析失败、用户上传后放弃、进程中断时临时 Excel 不会清理。
- `/uploads` 整个目录由 Express 无鉴权静态暴露，其中包含照片和导入 Excel；只要知道 URL 即可绕过登录下载。
- OCR 的 `photo_url` 被直接拼接成本地路径，未强制限制在 `uploads/photos` 目录内，存在路径穿越读取/处理服务器文件的风险。
- OCR 采用本地 Tesseract 中英识别、图片尺寸自适应、两种页面分割模式回退与 30 秒超时；字段解析为基于正则/关键词的启发式提取，不是真正的模型式“AI”。
- 上传校验主要依赖扩展名，不校验 MIME 和文件签名；图片/Excel/PDF 均应补充内容验证与恶意文件防护。

## 2026-06-27 Excel 映射与证书能力核验

- Excel 自动识别包括：表头行探测、Sheet 名推测类别、最长关键词匹配、数据样本纠错、压力表子类型识别、量程/日期/状态标准化。
- 前端手动映射提供 `rangeMin/rangeMax/rangeUnit`，但后端 `applyMapping()` 没有对应 case，会落入“未知字段写备注”；这三项手动映射实际上不可用。
- `FIELD_PATTERNS.serial_number` 仍保留过宽的“编号”关键词，虽然最长匹配能覆盖常见证书表头，但遇到未列入词典的其他“编号”字段仍可能误映射。
- 导入只强制类别必填，没有校验出厂编号、日期合法性、量程上下限、状态枚举、重复编号等业务规则；错误数据很容易进入台账。
- PDF 证书有单份解析接口（提取证书号、器具名、型号、出厂号、厂家、日期、单位等）和批量文件名匹配接口。
- `/api/certificate/save` 仍调用旧版多表模型签名，并引用不存在的 `CATEGORY_TABLES`/`updateByCertificate`，当前统一单表架构下基本不可用；前端目前也没有调用该接口。
- 单份 PDF 解析响应会返回服务器绝对 `filePath`，泄露内部目录；解析完成后文件也未清理。
- 批量证书上传只把“PDF 文件名”写入 `certificate_number`，没有把 PDF 路径关联到器具，也没有在线查看/下载证书功能。所谓“证书管理”目前更准确地说是“证书编号自动回填”。
- 批量匹配虽然解析了文件名前缀和类别，但实际查找只按出厂编号，不验证类别；不同类别存在相同出厂编号时可能匹配/更新错误记录。
- 批量上传 PDF 保留在根 `uploads/` 中但无业务引用和清理策略，会持续占用磁盘。
- 仓库里还有 dashboard/import/export 三套未挂载的旧 EJS/API 路由，和当前 SPA 代码并存，增加误读与维护成本。

## 2026-06-27 文档、安装与版本管理核验

- 当前目录没有 `.git`，无法追踪改动历史、回滚和分支；更像是源码拷贝/交付包，而非完整仓库。
- 根目录没有 README；`client/README.md` 仍是 Vite 默认模板，没有产品说明、架构、配置、备份恢复、部署或运维文档。
- 只提供 Windows 的 setup/start/autostart 脚本；无 macOS/Linux、Docker、服务守护、日志轮转、健康检查或升级脚本。
- 启动脚本持续明文展示默认账号密码，并直接对局域网开放 3000 端口，未配置 HTTPS、反向代理或网络访问控制。
- `.gitignore` 只忽略根 `uploads/*`，没有覆盖 `server/uploads/`、`data/metrology.db`、OCR 语言包和前端构建产物的实际布局；若恢复 Git，容易误提交业务数据和大文件。
- 没有 `.env.example` 或配置校验，部署人员很容易在不知道的情况下沿用默认密钥。

## 2026-06-27 运行验证结果

- 已用最小复现调用 `excelService.applyMapping()`：将“下限/上限/单位”手动映射为前端提供的 `rangeMin/rangeMax/rangeUnit` 后，结果全部进入 remark，证实手动量程拆列映射失效。
- 所有后端 JavaScript 文件通过 `node --check` 语法检查。
- 前端生产构建成功（输出到 `/tmp`，未改项目构建产物），但主入口 chunk 为约 1.15 MB、gzip 约 365 KB，构建器提示超过 500 KB；Element Plus 当前为整体引入，可做按需加载和拆包。
- 构建还出现 `@vueuse/core` PURE annotation 警告，来自依赖/构建器兼容，不阻止构建。
- 项目没有单元测试、接口测试或端到端测试脚本，因此“可构建”不能证明导入、预警、证书匹配等核心业务正确。

## 2026-06-27 当前数据与存储现状（只读检查）

- 当前数据库约 220 KB，含 210 条器具；全部状态均为 `active`，类别只有普通压力表 88 条、耐震压力表 122 条。
- 当前 210 条记录都有出厂编号和有效日期，但数据库中存在大量重复出厂编号：至少多个编号重复 2 次，两个编号重复 3 次。这直接证实“按出厂编号更新证书”会发生多记录更新/错误关联风险。
- 当前数据库 `photo_url` 非空记录为 0，但 `server/uploads` 已有 31 个文件（约 11 MB），根 `uploads` 有 101 个文件（约 29 MB），说明孤儿上传文件问题已经实际发生，而非理论风险。
- 导入日志仅 1 条，记录一次 210 条全成功导入；目前无法从 UI 查询该日志。
- 数据库本身很小，当前性能尚可；文件存储体积已远大于业务数据，优先需要生命周期管理和备份边界定义。

## 2026-06-27 工程质量与运维能力核验

- 核心前后端源码约 7,783 行；`InstrumentList.vue` 和 `server/routes/instruments.js` 都是超大单文件，职责混杂、重复逻辑多。
- 除 Excel 样例文件外没有任何 test/spec 文件；没有 lint、format、type-check、test 或 CI 配置。
- `express-validator`、`mysql2`、`morgan`、`cors`、`ejs` 等依赖当前主流程未使用；Express Session 只挂载但无业务用途，应清理或明确规划。
- 没有 Helmet/安全响应头、登录限流、统一错误中间件、结构化访问日志、运行健康检查、指标监控或未捕获异常处理。
- OCR 会在日志中输出原始识别文字和大量调试信息，可能包含设备编号/证书信息，且日志无级别、脱敏和轮转。
- 没有用户管理、修改密码、角色权限、操作审计、数据备份/恢复、变更历史、通知渠道或系统配置页面。
- 系统当前具备”到期预警看板”，但没有自动邮件/短信/企业微信通知，也没有提醒责任人、确认处理、延期/复检闭环。

---

## 2026-06-30 已修复缺陷记录

以下缺陷已在 2026-06-30 会话中修复（四智能体并行 + 对抗性审查）：

### P0-2 手动量程字段映射失效 ✅
- **原问题：** 前端手动映射 rangeMin/rangeMax/rangeUnit，后端 applyMapping() 无对应 case，落入 remark
- **修复：** `server/services/excel.js` applyMapping() 新增三个 case，使用 `== null` 守卫保持 range_info 优先级
- **审查结果：** ✅ 通过

### P0-3 /uploads 目录无鉴权暴露 ✅
- **原问题：** `app.use('/uploads', express.static(...))` 无认证，任何人可绕过登录访问
- **修复：** 新建 `server/middleware/uploadsAuth.js`（Bearer + query token），前端 photo URL 自动追加 token
- **审查结果：** ⚠️ 发现 blob URL 裂图 bug → 已修复：跳过 blob URL + 优先服务器 URL

### P0-1 并发导入文件串扰 ✅
- **原问题：** /import/confirm 通过 findUploadedFile() 找最新文件，多用户并发串扰
- **修复：** 新增 filePath 参数，path.resolve + startsWith 路径穿越校验，前端回传 _filePath
- **审查结果：** ✅ 通过

### P1-6 证书批量匹配不验证类别 ✅
- **原问题：** batch-upload 只按 serial_number 查找/更新，跨类别误匹配
- **修复：** 新增 findBySerialNoAndCategory / updateCertificateBySerialNoAndCategory，双重匹配
- **审查结果：** ⚠️ 警告文本不准确 + category=null 多条匹配风险 → 已修复：修正警告文本 + category=null 多条时标记 unmatched
