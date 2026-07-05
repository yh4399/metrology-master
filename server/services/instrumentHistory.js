const { queryAll, queryOne, run } = require('../models/db');

const FIELD_LABELS = {
  category: '器具类别', serial_number: '出厂编号', model: '型号', manufacturer: '生产厂家',
  range_min: '量程下限', range_max: '量程上限', range_unit: '量程单位', accuracy_class: '准确度等级',
  installation_location: '安装位置', department: '所属部门', certificate_number: '证书编号',
  inspection_date: '检验日期', valid_until: '有效日期', inspection_result: '检验结果',
  inspection_unit: '检验单位', status: '状态', remark: '备注', extra_fields: '扩展信息', photo_url: '照片',
  certificate_file: '证书附件'
};
const TRACKED_FIELDS = Object.freeze(Object.keys(FIELD_LABELS));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])]));
  return value;
}

function normalizeValue(field, value) {
  if (value === undefined || value === null) return value;
  if (field !== 'extra_fields') return value;
  if (value === '') return '';
  try { return JSON.stringify(stable(typeof value === 'string' ? JSON.parse(value) : value)); }
  catch { return value; }
}

function buildDiff(before = {}, after = {}) {
  return TRACKED_FIELDS.flatMap(field => {
    const oldValue = normalizeValue(field, before[field]);
    const newValue = normalizeValue(field, after[field]);
    return JSON.stringify(oldValue) === JSON.stringify(newValue)
      ? [] : [{ field, label: FIELD_LABELS[field], before: oldValue, after: newValue }];
  });
}

function buildSummary(diff) { return diff.map(item => item.label).join('、'); }

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function recordVersion({ instrumentId, action, source, before, after, operatorId }) {
  const diff = buildDiff(before || {}, after || {});
  if (action === 'update' && diff.length === 0) return null;
  const actionSummary = { create: '新建器具', delete: '删除器具', restore_deleted: '从回收站恢复' }[action];
  const summary = actionSummary || buildSummary(diff) || (action === 'restore_version' ? '恢复历史版本' : action);
  const result = run(
    `INSERT INTO instrument_versions
      (instrument_id, action, source, operator_id, before_data, after_data, diff_data, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [instrumentId, action, source || '', operatorId || null, JSON.stringify(before || null), JSON.stringify(after || null), JSON.stringify(diff), summary]
  );
  if (action !== 'create') {
    run("UPDATE instruments SET latest_change_at = datetime('now','localtime'), latest_change_summary = ? WHERE id = ?", [summary, instrumentId]);
  }
  return { id: result.lastInsertId, diff, summary };
}

function listVersions(instrumentId) {
  return queryAll('SELECT * FROM instrument_versions WHERE instrument_id = ? ORDER BY created_at DESC, id DESC', [instrumentId]).map(row => ({
    ...row,
    before_data: parseJson(row.before_data, null), after_data: parseJson(row.after_data, null), diff_data: parseJson(row.diff_data, [])
  }));
}

function findVersion(id) {
  const row = queryOne('SELECT * FROM instrument_versions WHERE id = ?', [id]);
  return row ? { ...row, before_data: parseJson(row.before_data, null), after_data: parseJson(row.after_data, null), diff_data: parseJson(row.diff_data, []) } : null;
}

module.exports = { FIELD_LABELS, TRACKED_FIELDS, normalizeValue, buildDiff, buildSummary, recordVersion, listVersions, findVersion };
