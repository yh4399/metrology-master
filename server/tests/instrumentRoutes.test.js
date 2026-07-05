const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbPath = path.join(os.tmpdir(), `metrology-routes-${process.pid}.db`);
process.env.METROLOGY_DB_PATH = dbPath;
const db = require('../models/db');
const Instrument = require('../models/instrument');

let router;
async function request(routePath, method, { params = {}, body = {}, query = {} } = {}) {
  const layer = router.stack.find(item => item.route && item.route.path === routePath && item.route.methods[method.toLowerCase()]);
  if (!layer) return { status: 404, body: {} };
  const req = { params, body, query, userId: 1 };
  return new Promise((resolve, reject) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { resolve({ status: this.statusCode, body: payload }); } };
    Promise.resolve(layer.route.stack.at(-1).handle(req, response, reject)).catch(reject);
  });
}

test.before(async () => {
  await db.getDb();
  router = require('../routes/instruments');
});
test.after(() => { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

test('history, version restore and recycle-bin routes enforce ownership and state', async () => {
  const created = await request('/', 'post', { body: { category: '压力表', serial_number: 'ROUTE', certificate_number: 'OLD' } });
  assert.equal(created.status, 200);
  const id = created.body.data.id;
  const other = Instrument.createWithHistory({ category: '温度计', serial_number: 'OTHER' }, { source: 'test' });

  const updated = await request('/:id', 'put', { params: { id: String(id) }, body: { certificate_number: 'NEW' } });
  assert.equal(updated.body.data.summary, '证书编号');
  const history = await request('/:id/history', 'get', { params: { id: String(id) } });
  assert.equal(history.status, 200);
  assert.equal(history.body.data[0].action, 'update');

  const otherVersion = Instrument.listHistory(other.id)[0];
  const rejected = await request('/:id/history/:versionId/restore', 'post', { params: { id: String(id), versionId: String(otherVersion.id) } });
  assert.equal(rejected.status, 400);

  assert.equal((await request('/:id', 'delete', { params: { id: String(id) } })).status, 200);
  const recycle = await request('/recycle-bin/list', 'get');
  assert.equal(recycle.status, 200);
  assert.equal(recycle.body.data.list[0].id, id);
  assert.equal((await request('/:id/history/:versionId/restore', 'post', { params: { id: String(id), versionId: String(history.body.data[1].id) } })).status, 404);
  assert.equal((await request('/recycle-bin/:id/restore', 'post', { params: { id: String(id) } })).status, 200);
  assert.equal((await request('/:id', 'get', { params: { id: String(id) } })).status, 200);
  await request('/:id', 'delete', { params: { id: String(id) } });
  assert.equal((await request('/recycle-bin/:id/purge', 'delete', { params: { id: String(id) } })).status, 200);
  assert.equal((await request('/recycle-bin/list', 'get')).body.data.total, 0);
});
