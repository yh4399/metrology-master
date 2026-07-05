import test from 'node:test'
import assert from 'node:assert/strict'
import { formatHistoryValue, parseHistoryDiff, sourceLabel } from './instrumentHistory.js'

test('parseHistoryDiff accepts stored JSON and invalid values safely', () => {
  assert.deepEqual(parseHistoryDiff('[{"label":"证书编号","before":"A","after":"B"}]'), [
    { label: '证书编号', before: 'A', after: 'B' }
  ])
  assert.deepEqual(parseHistoryDiff('invalid-json'), [])
  assert.deepEqual(parseHistoryDiff(null), [])
})

test('formatHistoryValue makes empty and structured values readable', () => {
  assert.equal(formatHistoryValue(''), '空')
  assert.equal(formatHistoryValue(null), '空')
  assert.equal(formatHistoryValue({ classification: 'A' }), '{"classification":"A"}')
})

test('sourceLabel translates known sources and preserves unknown sources', () => {
  assert.equal(sourceLabel('certificate_upload'), '批量上传证书')
  assert.equal(sourceLabel('certificate_save'), '证书信息保存')
  assert.equal(sourceLabel('version_restore'), '恢复历史版本')
  assert.equal(sourceLabel('recycle_restore'), '从回收站恢复')
  assert.equal(sourceLabel('future_source'), 'future_source')
})
