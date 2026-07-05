# 有效日期规则配置 — 设计文档

## 1. 概述

将有效日期计算规则从硬编码改为**数据库可配置**，提供管理界面让用户自主增删改规则。`calculateValidUntil` 从 `validity_rules` 表读取规则动态匹配计算。

规则变更后，以下功能**即时生效**：
- 批量上传证书匹配（`POST /api/certificate/batch-upload`）
- 证书日期校验（`GET /api/certificate/check-dates`）
- 批量更新日期（`POST /api/certificate/batch-update-dates`）

## 2. 规则模型

### 2.1 规则表 `validity_rules`

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | INTEGER PK | 自增主键 |
| `category` | TEXT NOT NULL | 器具类别，`*` = 匹配所有（兜底） |
| `classification` | TEXT | 分类：`A`/`B`/`C`，`NULL` = 匹配所有分类 |
| `period_value` | INTEGER | 有效期数值 |
| `period_unit` | TEXT | 单位：`month` / `year` |
| `priority` | INTEGER | 优先级（越大越优先） |

### 2.2 匹配逻辑

`ValidityRules.calculateValidUntil(inspectionDate, category, classification)` 按 `priority DESC` 遍历所有规则，**首个匹配生效**：

```
catMatch = rule.category === '*' || rule.category === category
clsMatch = rule.classification === null || rule.classification === classification
若 catMatch && clsMatch → 命中，按规则计算
```

所有规则都不匹配时，硬编码兜底：`+1年−1天`。

### 2.3 默认规则

首次初始化时调用 `ValidityRules.init()` → `seedDefaults()`，仅当表为空时插入：

```js
const DEFAULT_RULES = [
  { category: '普通压力表', classification: 'C', period_value: 3, period_unit: 'year',  priority: 15 },
  { category: '耐震压力表', classification: 'C', period_value: 3, period_unit: 'year',  priority: 15 },
  { category: '压力表',     classification: 'C', period_value: 3, period_unit: 'year',  priority: 10 },
  { category: '压力表',     classification: null, period_value: 6, period_unit: 'month', priority: 5 },
  { category: '普通压力表', classification: null, period_value: 6, period_unit: 'month', priority: 5 },
  { category: '耐震压力表', classification: null, period_value: 6, period_unit: 'month', priority: 5 },
  { category: '*',          classification: null, period_value: 1, period_unit: 'year',  priority: 0 },
];
```

> 注意：`classification IS NULL` 匹配所有分类（A/B/C/无分类），而 `classification = 'C'` 仅匹配 C 类。

## 3. API

所有路由挂载在 `/api/certificate` 下，需要 JWT 认证。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/validity-rules` | 获取所有规则（按 priority DESC） |
| POST | `/validity-rules` | 新增规则 |
| PUT | `/validity-rules/:id` | 修改规则 |
| DELETE | `/validity-rules/:id` | 删除规则 |
| POST | `/validity-rules/reset` | 重置为默认规则 |

## 4. 后端实现

### 4.1 `server/models/validityRules.js`（新增）

模块导出 `ValidityRules` 对象：

```js
const ValidityRules = {
  init()              // 建表 + 种子数据（幂等）
  list()              // 查询全部规则
  create(data)        // 新增
  update(id, data)    // 修改
  delete(id)          // 删除
  resetDefaults()     // 清空 + 重插默认规则
  calculateValidUntil(inspectionDate, category, classification)  // 核心计算
}
```

**初始化时机**：`server/app.js` 的 `start()` 中，`await getDb()` 之后调用 `ValidityRules.init()`。不在 `certificate.js` 顶层调用，因为此时数据库尚未初始化。

### 4.2 `server/routes/certificate.js`

`calculateValidUntil` 改为薄封装：

```js
function calculateValidUntil(inspectionDate, category, classification) {
  return ValidityRules.calculateValidUntil(inspectionDate, category, classification);
}
```

新增 5 个路由处理函数（GET/POST/PUT/DELETE validity-rules + POST validity-rules/reset）。

### 4.3 分类值兼容处理

`getClassification()` 函数从 `extra_fields.classification` 读取，数据库存储值为 `"A类"`/`"B类"`/`"C类"`（带后缀），函数会去掉"类"后缀返回 `"A"`/`"B"`/`"C"`，确保与规则表中的分类值精确匹配。

## 5. 前端

### 5.1 入口

工具栏按钮：`<el-button plain>⚙ 有效期规则</el-button>`

### 5.2 规则列表对话框（750px）

- 表格列：优先级 | 类别 | 分类 | 有效期 | 操作
- `*` 类别显示为 "* (默认)" 标签
- 分类为空显示 "全部"
- 有效期显示 `N 年` 或 `N 月`
- 兜底规则（`category='*'` 且 `classification=null`）不可删除

### 5.3 新增/编辑弹窗（420px）

表单字段：
- 器具类别（下拉选择，支持 `filterable` + `allow-create` 手动输入）
- 分类管理（下拉：A/B/C，可清空 = 全部）
- 有效期（InputNumber 1-99 + 月/年下拉）
- 优先级（InputNumber 0-99）

### 5.4 交互

1. 打开对话框 → `GET /validity-rules` 加载规则
2. 新增 → 弹出子表单 → `POST /validity-rules`
3. 编辑 → 预填当前值 → `PUT /validity-rules/:id`
4. 删除 → 确认弹窗 → `DELETE /validity-rules/:id`
5. 重置 → 确认弹窗 → `POST /validity-rules/reset`
6. 所有操作后自动刷新列表，规则变更即时生效

## 6. 文件变更清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `server/models/validityRules.js` | **新增** | 规则表 CRUD + calculateValidUntil |
| `server/routes/certificate.js` | 修改 | `calculateValidUntil` 改为查规则表；+5 个规则 API |
| `server/app.js` | 修改 | `start()` 中调用 `ValidityRules.init()` |
| `client/src/views/InstrumentList.vue` | 修改 | +有效期规则按钮 + 规则列表对话框 + 新增/编辑弹窗 |
| `client/src/api/instruments.js` | 修改 | +5 个规则 API 函数 |

共 **5 个文件**（1 新增）。
