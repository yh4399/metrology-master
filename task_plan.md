# 任务计划：功能完善（三次需求迭代）

## 目标
1. **完善筛选叠加逻辑**：类别+状态+时间筛选条件叠加，URL同步，筛选标签显示 ✅
2. **多Sheet同时导入**：导入Excel时支持选择多个工作表同时导入 ✅
3. **完善字段映射**：分类/分类管理列映射到extra_fields.classification，添加FIELD_OPTIONS ✅
4. **修复证书编号映射**：仪表检定证书编号正确映射到certificate_number而非serial_number ✅
5. **按类别清空数据**：可选择清空某一类别计量器具的数据 ✅
6. **区分普通/耐震压力表**：导入时根据"压力表类别"列自动区分 ✅
7. **检验日期筛选**：新增检验日期范围筛选器 ✅
8. **修复清空数据计数Bug**：categoryDataCount从stats API获取全量计数 ✅

## 当前阶段
全部阶段已完成 ✅

## 第三次迭代：三项新需求 (2026-06-01)

### 阶段 6：修复清空数据计数Bug ✅
- [x] categoryDataCount改为从stats API获取全量计数
- [x] handleClearCommand打开对话框时加载计数
- [x] 导入getInstrumentStats
- **状态：** complete

### 阶段 7：完善筛选功能（检验日期） ✅
- [x] Instrument.list()/findAll()新增inspectionFrom/inspectionTo参数
- [x] 前端添加检验日期范围选择器
- [x] URL同步（inspectionFrom/inspectionTo）
- [x] 筛选标签显示
- [x] activeFilterCount计数
- [x] 导出函数同步传递参数
- **状态：** complete

### 阶段 8：导入时区分普通/耐震压力表 ✅
- [x] FIELD_PATTERNS新增pressure_gauge_type字段，关键词"压力表类别"
- [x] 从classification中分离"压力表类别"关键词
- [x] applyMapping新增pressure_gauge_type处理case
- [x] 值为"普通压力表"/"耐震压力表"时覆盖data.category
- [x] 避免与"分类管理"列冲突（各自独立映射）
- **状态：** complete

### 阶段 9：验证 ✅
- [x] 所有JS模块语法检查通过
- [x] 服务器模块加载验证通过
- [x] Client build成功
- **状态：** complete

## 各阶段

### 阶段 1：修复excel.js映射逻辑 ✅ (Changes 4+3)
- [x] buildAutoMapping() 改用最长匹配优先算法
- [x] 移除serial_number中过于宽泛的"编号"关键词
- [x] certificate_number移至serial_number之前（双重保险）
- [x] classification存储到extra_fields.classification代替remark
- [x] FIELD_OPTIONS新增classification和mfg_date选项
- **状态：** complete

### 阶段 2：多Sheet导入 ✅ (Change 2)
- [x] ImportPage.vue支持多选Sheet（checkbox+全选控制）
- [x] 后端import/confirm支持sheetNames数组
- [x] 多Sheet结果汇总显示
- **状态：** complete

### 阶段 3：筛选叠加逻辑 ✅ (Change 1)
- [x] 筛选条件URL同步（router.replace）
- [x] URL恢复筛选（onMounted读route.query）
- [x] 激活筛选标签显示（可单独关闭）
- [x] activeFilterCount计算属性
- **状态：** complete

### 阶段 4：按类别清空数据 ✅ (Change 5)
- [x] Instrument.deleteByCategory()模型方法
- [x] DELETE /clear-by-category路由（:id之前注册）
- [x] clearByCategory() API函数
- [x] 前端下拉菜单+对话框（类别选择器含计数）
- **状态：** complete

### 阶段 5：验证 ✅
- [x] 所有JS模块语法检查通过
- [x] 服务器模块加载验证通过
- [x] 路由注册顺序验证通过
- [x] Vue模板标签平衡验证通过
- **状态：** complete

## 历史错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 2026-05-31 | 批量上传证书Content-Type缺少boundary | 1 | 删除手动Content-Type头 |
| 2026-05-31 | 批量上传404路由未注册 | 1 | app.js注册certificate路由 |
| 2026-05-31 | 含连字符出厂编号解析错误 | 1 | 检测-H1-ZX1-标记后拼接剩余段 |
| 2026-06-01 | handleSubmit覆盖已有extra_fields | 1 | 先解析已有extra_fields再合并 |
| 2026-06-01 | fetchList缺少router.replace调用 | 1 | 构建query后补充router.replace |

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

---
*每个阶段完成后或遇到错误时更新此文件*

## 会话：2026-06-27（项目功能全量盘点与完善建议）

### 目标
- 以当前源码为准，梳理项目面向用户的全部功能与底层支撑能力
- 识别已实现但不完整、潜在缺陷及产品能力空白
- 输出按优先级和实施价值排序的改进建议

### 阶段
- [x] 阶段 1：盘点目录结构、技术栈、入口和文档（完成）
- [x] 阶段 2：核验前端页面、交互与 API 能力（完成）
- [x] 阶段 3：核验后端路由、数据模型、导入导出与证书能力（完成）
- [x] 阶段 4：检查测试、部署、安全性与可维护性（完成）
- [x] 阶段 5：汇总功能地图和分级改进建议（完成）

### 本次错误日志
| 错误 | 尝试次数 | 处理 |
|------|---------|------|
| 项目内不存在 `.continue/.../session-catchup.py`，且无 `python` 命令 | 1 | 保留既有规划文件，直接基于仓库现状继续分析 |
| 当前目录不是 Git 仓库，无法检查提交历史与工作区差异 | 1 | 改查文件时间、目录内容和现有文档，不再重复 Git 命令 |

---

## 会话：2026-06-30（四智能体并行修复 + 对抗性审查）

### 目标
- 从 2026-06-27 盘点报告中选取 4 个高优先级独立缺陷，并行修复
- 每个修复由独立智能体执行，完成后进行交叉对抗性审查
- 修复审查中发现的残留问题

### 选定的 4 个问题（触碰不同文件，避免冲突）

| # | 优先级 | 问题 | 目标文件 |
|---|--------|------|----------|
| 1 | P0-2 | 手动量程字段映射失效（rangeMin/rangeMax/rangeUnit） | `server/services/excel.js` |
| 2 | P0-3 | /uploads 目录无鉴权暴露 | `server/app.js` + 新建中间件 |
| 3 | P0-1 | 并发导入文件串扰（findUploadedFile 找最新文件） | `server/routes/instruments.js` + `ImportPage.vue` |
| 4 | P1-6 | 证书批量匹配不验证类别 | `server/models/instrument.js` + `server/routes/certificate.js` |

### 阶段 1：并行修复 ✅
- [x] Agent #1: applyMapping() 新增 rangeMin/rangeMax/rangeUnit 三个 case
- [x] Agent #2: 新建 uploadsAuth 中间件 + app.js 鉴权 + 前端 photo URL token 追加
- [x] Agent #3: confirm 端点支持 filePath 参数 + 路径穿越校验 + 前端回传 _filePath
- [x] Agent #4: 新增 findBySerialNoAndCategory / updateCertificateBySerialNoAndCategory
- **状态：** complete

### 阶段 2：交叉对抗性审查 ✅
- [x] 审查 #1（量程映射）：✅ 通过（仅有理论 Infinity 边界）
- [x] 审查 #2（上传鉴权）：⚠️ 发现 2 个 blob URL bug + JWT query string 泄露风险
- [x] 审查 #3（导入隔离）：✅ 通过
- [x] 审查 #4（证书匹配）：⚠️ 发现警告文本与实际行为不一致 + category=null 跨类别误写
- **状态：** complete

### 阶段 3：修复审查发现的残留问题 ✅
- [x] InstrumentForm.vue: photoDisplayUrl blob URL 跳过 token + 优先服务器 URL
- [x] InstrumentList.vue: photoUrlWithToken blob URL 跳过 token
- [x] certificate.js: 警告文本修正为"全部已更新" + category=null 多条匹配时标记 unmatched
- **状态：** complete

### 阶段 4：验证 ✅
- [x] 所有后端 JS 文件语法检查通过
- [x] 前端 Vite build 成功（289ms）

### 修改文件清单
| 文件 | 操作 | 说明 |
|------|------|------|
| `server/services/excel.js` | 修改 | applyMapping() 新增 rangeMin/rangeMax/rangeUnit case |
| `server/middleware/uploadsAuth.js` | **新建** | 上传文件鉴权中间件（Bearer + query string token） |
| `server/app.js` | 修改 | /uploads 路由前插入 uploadsAuth 中间件 |
| `server/routes/instruments.js` | 修改 | confirm 端点支持 filePath 参数 + 路径穿越防护 |
| `server/models/instrument.js` | 修改 | 新增 findBySerialNoAndCategory / updateCertificateBySerialNoAndCategory |
| `server/routes/certificate.js` | 修改 | batch-upload 使用类别+编号双重匹配 + 安全分支 |
| `client/src/views/ImportPage.vue` | 修改 | 保存/回传 uploadedFilePath |
| `client/src/views/InstrumentForm.vue` | 修改 | photoDisplayUrl blob URL 判断 + 优先级修正 |
| `client/src/views/InstrumentList.vue` | 修改 | photoUrlWithToken blob URL 判断 |

### 本次错误日志
| 错误 | 尝试次数 | 处理 |
|------|---------|------|
| Workflow 脚本模板字面量导致解析错误 | 1 | 改用字符串拼接避免反引号冲突 |
| 审查发现 blob URL 被追加 token 导致裂图 | 1 | 增加 `url.startsWith('blob:')` 判断 |
| 审查发现证书匹配警告与实际行为不一致 | 1 | 拆分为两个分支 + 修正警告文本 |
