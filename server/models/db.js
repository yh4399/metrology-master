const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'metrology.db');

let db = null;

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

  // 索引
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_category    ON instruments(category)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_serial       ON instruments(serial_number)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_manufacturer ON instruments(manufacturer)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_location     ON instruments(installation_location)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_status       ON instruments(status)');
  database.run('CREATE INDEX IF NOT EXISTS idx_ins_valid_until  ON instruments(valid_until)');
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
  saveDb();
  return {
    changes: db.getRowsModified(),
    lastInsertId: queryOne('SELECT last_insert_rowid() as id')?.id || 0,
  };
}

module.exports = { getDb, saveDb, queryAll, queryOne, run };
