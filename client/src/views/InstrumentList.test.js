import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./InstrumentList.vue', import.meta.url), 'utf8')

test('renders change status in a separate change-info column', () => {
  const certificateStart = source.indexOf('label="证书编号"')
  const changeInfoStart = source.indexOf('label="变更信息"')
  const inspectionStart = source.indexOf('prop="inspection_date"')

  assert.ok(certificateStart >= 0)
  assert.ok(changeInfoStart > certificateStart)
  assert.ok(inspectionStart > changeInfoStart)

  const certificateColumn = source.slice(certificateStart, changeInfoStart)
  const changeInfoColumn = source.slice(changeInfoStart, inspectionStart)
  assert.doesNotMatch(certificateColumn, /latest_change_at|已更新|change-meta/)
  assert.match(changeInfoColumn, /latest_change_at/)
  assert.match(changeInfoColumn, /已更新/)
  assert.match(changeInfoColumn, /latest_change_summary/)
  assert.match(changeInfoColumn, /openHistory\(row\)/)
})
