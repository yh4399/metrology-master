const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.METROLOGY_DB_PATH || path.join(__dirname, '..', '..', 'data', 'metrology.db');

let db = null;
let transactionDepth = 0;

function createAllTables(database) {
  // 用户表
  database.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nickname TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // 导入日志表
  database.run(`CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT,
    total_rows INTEGER,
    success_rows INTEGER,
    fail_rows INTEGER,
    error_detail TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // 统一计量器具表
  database.run(`CREATE TABLE IF NOT EXISTS instruments (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    category              TEXT    NOT NULL,
    serial_number         TEXT,
    model                 TEXT,
    manufacturer          TEXT,
    range_min             REAL,
    range_max             REAL,
    range_unit            TEXT,
    accuracy_class        TEXT,
    installation_location TEXT,
    department            TEXT,
    certificate_number    TEXT,
    inspection_date       TEXT,
    valid_until           TEXT,
    inspection_result     TEXT,
    inspection_unit       TEXT,
    status                TEXT    DEFAULT 'active',
    remark                TEXT,
    extra_fields          TEXT,
    photo_url             TEXT,
    created_at            TEXT    DEFAULT (datetime('now','localtime')),
    updated_at            TEXT    DEFAULT (datetime('now','localtime'))
  )`);

  const instrumentColumns = new Set(queryTableColumns(database, 'instruments'));
  const migrations = [
    ['is_deleted', 'INTEGER DEFAULT 0'], ['deleted_at', 'TEXT'],
    ['latest_change_at', 'TEXT'], ['latest_change_summary', 'TEXT']
  ];
  for (const [column, definition] of migrations) {
    if (!instrumentColumns.has(column)) database.run(`ALTER TABLE instruments ADD COLUMN ${column} ${definition}`);
  }

  database.run(`CREATE TABLE IF NOT EXISTS instrument_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instrument_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    source TEXT,
    operator_id INTEGER,
    before_data TEXT,
    after_data TEXT,
    diff_data TEXT,
    summary TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // 索引
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_category    ON instruments(category)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_serial       ON instruments(serial_number)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_manufacturer ON instruments(manufacturer)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_location     ON instruments(installation_location)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_status       ON instruments(status)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_valid_until  ON instruments(valid_until)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_deleted ON instruments(is_deleted)');
  database.run('CREATE INDEX IF NOT EXISTS idx_versions_instrument ON instrument_versions(instrument_id)');
  database.run('CREATE INDEX IF NOT EXISTS idx_versions_created ON instrument_versions(created_at)');
}

function queryTableColumns(database, table) {
  const result = database.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return [];
  const nameIndex = result[0].columns.indexOf('name');
  return result[0].values.map(row => row[nameIndex]);
}

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  createAllTables(db);

  // 创建默认管理员
  const bcrypt = require('bcryptjs');
  const existing = db.exec("SELECT id FROM users WHERE username = 'admin'");
  if (existing.length === 0 || existing[0].values.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.run("INSERT INTO users (username, password, nickname) VALUES (?, ?, ?)",
      ['admin', hash, '管理员']);
  }

  saveDb();
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

function queryAll(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function run(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastInsertId = queryOne('SELECT last_insert_rowid() as id')?.id || 0;
  if (transactionDepth === 0) saveDb();
  return {
    changes,
    lastInsertId,
  };
}

function transaction(work) {
  if (!db) throw new Error('数据库未初始化');
  if (transactionDepth > 0) return work();
  db.run('BEGIN TRANSACTION');
  transactionDepth++;
  try {
    const result = work();
    db.run('COMMIT');
    transactionDepth--;
    saveDb();
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    transactionDepth--;
    saveDb();
    throw error;
  }
}

module.exports = { getDb, saveDb, queryAll, queryOne, run, transaction };
