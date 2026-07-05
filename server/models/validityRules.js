const { queryAll, queryOne, run, transaction } = require('./db');

const DEFAULT_RULES = [
  { category: '压力表',     classification: 'C', period_value: 3,  period_unit: 'year',  priority: 10 },
  { category: '普通压力表', classification: 'C', period_value: 3,  period_unit: 'year',  priority: 10 },
  { category: '耐震压力表', classification: 'C', period_value: 3,  period_unit: 'year',  priority: 10 },
  { category: '压力表',     classification: null, period_value: 6,  period_unit: 'month', priority: 5 },
  { category: '普通压力表', classification: null, period_value: 6,  period_unit: 'month', priority: 5 },
  { category: '耐震压力表', classification: null, period_value: 6,  period_unit: 'month', priority: 5 },
  { category: '*',          classification: null, period_value: 1,  period_unit: 'year',  priority: 0 },
];

function ensureTable() {
  run(`CREATE TABLE IF NOT EXISTS validity_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    classification TEXT,
    period_value INTEGER NOT NULL DEFAULT 1,
    period_unit TEXT NOT NULL DEFAULT 'year',
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  )`);
}

function seedDefaults() {
  const count = queryOne('SELECT COUNT(*) as cnt FROM validity_rules');
  if (count && count.cnt === 0) {
    for (const rule of DEFAULT_RULES) {
      run(
        'INSERT INTO validity_rules (category, classification, period_value, period_unit, priority) VALUES (?, ?, ?, ?, ?)',
        [rule.category, rule.classification, rule.period_value, rule.period_unit, rule.priority]
      );
    }
  }
}

const ValidityRules = {
  // 初始化（幂等）
  init() {
    ensureTable();
    seedDefaults();
  },

  // 获取所有规则（按优先级降序）
  list() {
    return queryAll('SELECT * FROM validity_rules ORDER BY priority DESC, id ASC');
  },

  // 新增
  create(data) {
    const result = run(
      'INSERT INTO validity_rules (category, classification, period_value, period_unit, priority) VALUES (?, ?, ?, ?, ?)',
      [data.category, data.classification || null, data.period_value, data.period_unit || 'year', data.priority || 0]
    );
    return queryOne('SELECT * FROM validity_rules WHERE id = ?', [result.lastInsertId]);
  },

  // 更新
  update(id, data) {
    const existing = queryOne('SELECT * FROM validity_rules WHERE id = ?', [id]);
    if (!existing) return null;
    const sets = [];
    const vals = [];
    if (data.category !== undefined) { sets.push('category = ?'); vals.push(data.category); }
    if (data.classification !== undefined) { sets.push('classification = ?'); vals.push(data.classification || null); }
    if (data.period_value !== undefined) { sets.push('period_value = ?'); vals.push(data.period_value); }
    if (data.period_unit !== undefined) { sets.push('period_unit = ?'); vals.push(data.period_unit); }
    if (data.priority !== undefined) { sets.push('priority = ?'); vals.push(data.priority); }
    if (sets.length === 0) return existing;
    sets.push("updated_at = datetime('now','localtime')");
    vals.push(id);
    run(`UPDATE validity_rules SET ${sets.join(', ')} WHERE id = ?`, vals);
    return queryOne('SELECT * FROM validity_rules WHERE id = ?', [id]);
  },

  // 删除
  delete(id) {
    const existing = queryOne('SELECT * FROM validity_rules WHERE id = ?', [id]);
    if (!existing) return 0;
    return run('DELETE FROM validity_rules WHERE id = ?', [id]).changes;
  },

  // 重置为默认规则
  resetDefaults() {
    run('DELETE FROM validity_rules');
    for (const rule of DEFAULT_RULES) {
      run(
        'INSERT INTO validity_rules (category, classification, period_value, period_unit, priority) VALUES (?, ?, ?, ?, ?)',
        [rule.category, rule.classification, rule.period_value, rule.period_unit, rule.priority]
      );
    }
    return this.list();
  },

  // ============ 核心：根据规则计算有效日期 ============
  // 按优先级从高到低匹配，首个命中生效；无命中则 +1年−1天
  calculateValidUntil(inspectionDate, category, classification) {
    try {
      const d = new Date(inspectionDate + 'T00:00:00');
      if (isNaN(d.getTime())) return null;

      const rules = this.list();

      for (const rule of rules) {
        // 类别匹配：精确匹配 或 兜底 '*'
        const catMatch = rule.category === '*' || rule.category === (category || '');
        // 分类匹配：rule.classification 为 null 匹配所有，否则需精确匹配
        const clsMatch = rule.classification === null || rule.classification === (classification || '');

        if (catMatch && clsMatch) {
          // 命中：按规则计算
          if (rule.period_unit === 'year') {
            d.setFullYear(d.getFullYear() + rule.period_value);
          } else {
            d.setMonth(d.getMonth() + rule.period_value);
          }
          d.setDate(d.getDate() - 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        }
      }

      // 兜底：+1年−1天
      d.setFullYear(d.getFullYear() + 1);
      d.setDate(d.getDate() - 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (_) { return null; }
  },

  // ============ 从证书编号提取检验日期 ============
  extractInspectionDate(certNo) {
    try {
      // 策略1：H1-ZX1 标准格式
      const h1zx1Idx = certNo.indexOf('-H1-ZX1-');
      if (h1zx1Idx !== -1) {
        const afterMarker = certNo.substring(h1zx1Idx + '-H1-ZX1-'.length);
        const firstSegment = afterMarker.split('-')[0];
        if (/^\d{10}$/.test(firstSegment)) {
          const datePart = firstSegment.substring(0, 8);
          const y = parseInt(datePart.substring(0, 4));
          const m = parseInt(datePart.substring(4, 6));
          const d = parseInt(datePart.substring(6, 8));
          if (y >= 2020 && y <= 2027 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          }
        }
      }
      // 策略2：正则提取首个合理的 20YYMMDD
      const matches = certNo.match(/\d{8}/g);
      if (matches) {
        for (const m of matches) {
          const y = parseInt(m.substring(0, 4));
          const mo = parseInt(m.substring(4, 6));
          const d = parseInt(m.substring(6, 8));
          if (y >= 2020 && y <= 2027 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          }
        }
      }
    } catch (_) { /* ignore */ }
    return null;
  }
};

module.exports = ValidityRules;
