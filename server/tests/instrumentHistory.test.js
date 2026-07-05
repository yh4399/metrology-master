const test = require('node:test');
const assert = require('node:assert/strict');
const { buildDiff, buildSummary, normalizeValue } = require('../services/instrumentHistory');

test('buildDiff returns readable business field changes', () => {
  const diff = buildDiff(
    { certificate_number: 'OLD', updated_at: '2026-01-01' },
    { certificate_number: 'NEW', updated_at: '2026-01-02' }
  );
  assert.deepEqual(diff, [{ field: 'certificate_number', label: '证书编号', before: 'OLD', after: 'NEW' }]);
  assert.equal(buildSummary(diff), '证书编号');
});

test('extra_fields comparison is stable and ignores JSON key order', () => {
  const before = { extra_fields: '{"b":2,"a":1}' };
  const after = { extra_fields: { a: 1, b: 2 } };
  assert.deepEqual(buildDiff(before, after), []);
  assert.equal(normalizeValue('extra_fields', ''), '');
});
