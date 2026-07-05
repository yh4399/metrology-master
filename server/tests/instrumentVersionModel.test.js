const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.tmpdir(), `metrology-history-${process.pid}.db`);
process.env.METROLOGY_DB_PATH = dbPath;
const db = require('../models/db');
const Instrument = require('../models/instrument');

test.before(async () => { await db.getDb(); });
test.after(() => { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

test('model records versions, restores versions, and manages recycle bin', () => {
  const created = Instrument.createWithHistory({ category: '压力表', serial_number: 'SN-1', certificate_number: 'OLD' }, { source: 'manual_create', operatorId: 1 });
  const id = created.id;
  assert.equal(Instrument.findById(id).latest_change_at, null);
  let history = Instrument.listHistory(id);
  assert.equal(history.length, 1);
  assert.equal(history[0].action, 'create');

  const updated = Instrument.updateWithHistory(id, { certificate_number: 'NEW' }, { source: 'manual_edit', operatorId: 1 });
  assert.equal(updated.summary, '证书编号');
  assert.equal(Instrument.listHistory(id).length, 2);
  db.run("UPDATE instruments SET updated_at = '2000-01-01 00:00:00' WHERE id = ?", [id]);
  Instrument.updateWithHistory(id, { certificate_number: 'NEW' }, { source: 'manual_edit' });
  assert.equal(Instrument.listHistory(id).length, 2);
  assert.equal(Instrument.findById(id).updated_at, '2000-01-01 00:00:00');

  const createVersion = Instrument.listHistory(id).find(v => v.action === 'create');
  Instrument.restoreVersion(id, createVersion.id, { operatorId: 1 });
  assert.equal(Instrument.findById(id).certificate_number, 'OLD');
  assert.equal(Instrument.listHistory(id)[0].action, 'restore_version');

  Instrument.softDelete(id, { operatorId: 1 });
  assert.equal(Instrument.findById(id), null);
  assert.equal(Instrument.listDeleted().list[0].id, id);
  Instrument.restoreDeleted(id, { operatorId: 1 });
  assert.equal(Instrument.findById(id).id, id);
  Instrument.softDelete(id, { operatorId: 1 });
  Instrument.purgeDeleted(id);
  assert.equal(Instrument.listDeleted().total, 0);
  assert.equal(Instrument.listHistory(id).length, 0);
});

test('database transaction rolls back every write when a later step fails', () => {
  assert.throws(() => db.transaction(() => {
    db.run("INSERT INTO instruments (category, serial_number) VALUES ('压力表', 'ROLLBACK-ME')");
    throw new Error('forced failure');
  }), /forced failure/);
  assert.equal(db.queryOne("SELECT id FROM instruments WHERE serial_number = 'ROLLBACK-ME'"), null);
});

test('certificate update records history for every duplicate match', () => {
  const one = Instrument.createWithHistory({ category: '流量计', serial_number: 'DUP' }, { source: 'manual_create' }).id;
  const two = Instrument.createWithHistory({ category: '流量计', serial_number: 'DUP' }, { source: 'manual_create' }).id;
  const ids = Instrument.updateCertificateWithHistoryBySerialNoAndCategory('DUP', '流量计', { certificate_number: 'CERT' }, { source: 'certificate_upload' });
  assert.deepEqual(ids.sort((a, b) => a - b), [one, two]);
  for (const id of ids) {
    const latest = Instrument.listHistory(id)[0];
    assert.equal(latest.source, 'certificate_upload');
    assert.ok(latest.diff_data.some(d => d.field === 'certificate_number'));
  }
});
