const { queryAll, queryOne, run } = require('./db');

// 统一计量器具模型 - 单表设计
const Instrument = {

  // ======================== 类别列表 ========================
  categories() {
    const rows = queryAll('SELECT DISTINCT category FROM instruments WHERE category IS NOT NULL AND category != "" ORDER BY category');
    return rows.map(r => r.category);
  },

  // ======================== 统计 ========================
  stats() {
    const now = new Date().toISOString().slice(0, 10);
    const d30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const totalRow = queryOne('SELECT COUNT(*) as cnt FROM instruments');
    const totalCount = totalRow ? totalRow.cnt : 0;

    const expiredRow = queryOne(
      'SELECT COUNT(*) as cnt FROM instruments WHERE valid_until < ? AND status != "scrapped"',
      [now]
    );
    const expired = expiredRow ? expiredRow.cnt : 0;

    const expiringRow = queryOne(
      'SELECT COUNT(*) as cnt FROM instruments WHERE valid_until BETWEEN ? AND ? AND status != "scrapped"',
      [now, d30]
    );
    const expiringSoon = expiringRow ? expiringRow.cnt : 0;

    const byCat = queryAll(
      'SELECT category, COUNT(*) as count FROM instruments GROUP BY category ORDER BY count DESC'
    );

    const byStatus = queryAll(
      'SELECT status, COUNT(*) as count FROM instruments GROUP BY status'
    );

    return {
      totalCount,
      expired,
      expiringSoon,
      byCategory: byCat,
      byStatus
    };
  },

  // ======================== 列表查询 ========================
  list(params = {}) {
    const page = Math.max(parseInt(params.page) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(params.pageSize) || 20, 1), 200);
    const offset = (page - 1) * pageSize;

    let where = 'WHERE 1=1';
    const vals = [];

    if (params.category) {
      where += ' AND category = ?';
      vals.push(params.category);
    }

    if (params.keyword) {
      where += ' AND (serial_number LIKE ? OR model LIKE ? OR manufacturer LIKE ? OR installation_location LIKE ? OR certificate_number LIKE ? OR department LIKE ?)';
      const kw = '%' + params.keyword + '%';
      vals.push(kw, kw, kw, kw, kw, kw);
    }

    if (params.status) {
      where += ' AND status = ?';
      vals.push(params.status);
    }

    if (params.validFrom) {
      where += ' AND valid_until IS NOT NULL AND date(valid_until) >= date(?)';
      vals.push(params.validFrom);
    }

    if (params.validTo) {
      where += ' AND valid_until IS NOT NULL AND date(valid_until) <= date(?)';
      vals.push(params.validTo);
    }

    if (params.inspectionFrom) {
      where += ' AND inspection_date IS NOT NULL AND date(inspection_date) >= date(?)';
      vals.push(params.inspectionFrom);
    }

    if (params.inspectionTo) {
      where += ' AND inspection_date IS NOT NULL AND date(inspection_date) <= date(?)';
      vals.push(params.inspectionTo);
    }

    if (params.classification) {
      where += " AND extra_fields IS NOT NULL AND json_extract(extra_fields, '$.classification') LIKE ?";
      vals.push('%' + params.classification + '%');
    }

    // 排序
    const allowedSorts = ['category', 'serial_number', 'model', 'manufacturer', 'valid_until', 'status', 'installation_location', 'created_at', 'updated_at', 'inspection_date'];
    let sortBy = 'updated_at';
    if (params.sortBy && allowedSorts.includes(params.sortBy)) {
      sortBy = params.sortBy;
    }
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 总数
    const countRow = queryOne(`SELECT COUNT(*) as cnt FROM instruments ${where}`, vals);
    const total = countRow ? countRow.cnt : 0;

    // 数据
    const list = queryAll(
      `SELECT * FROM instruments ${where} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
      [...vals, pageSize, offset]
    );

    return { list, total, page, pageSize };
  },

  // ======================== 全量查询（导出用） ========================
  findAll(params = {}) {
    let where = 'WHERE 1=1';
    const vals = [];

    if (params.category) {
      where += ' AND category = ?';
      vals.push(params.category);
    }
    if (params.keyword) {
      where += ' AND (serial_number LIKE ? OR model LIKE ? OR manufacturer LIKE ? OR installation_location LIKE ? OR certificate_number LIKE ?)';
      const kw = '%' + params.keyword + '%';
      vals.push(kw, kw, kw, kw, kw);
    }
    if (params.status) {
      where += ' AND status = ?';
      vals.push(params.status);
    }
    if (params.validFrom) {
      where += ' AND valid_until IS NOT NULL AND date(valid_until) >= date(?)';
      vals.push(params.validFrom);
    }
    if (params.validTo) {
      where += ' AND valid_until IS NOT NULL AND date(valid_until) <= date(?)';
      vals.push(params.validTo);
    }
    if (params.inspectionFrom) {
      where += ' AND inspection_date IS NOT NULL AND date(inspection_date) >= date(?)';
      vals.push(params.inspectionFrom);
    }
    if (params.inspectionTo) {
      where += ' AND inspection_date IS NOT NULL AND date(inspection_date) <= date(?)';
      vals.push(params.inspectionTo);
    }

    if (params.classification) {
      where += " AND extra_fields IS NOT NULL AND json_extract(extra_fields, '$.classification') LIKE ?";
      vals.push('%' + params.classification + '%');
    }

    const allowedSorts = ['category', 'serial_number', 'model', 'manufacturer', 'valid_until', 'status', 'installation_location', 'created_at', 'updated_at', 'inspection_date'];
    let sortBy = 'updated_at';
    if (params.sortBy && allowedSorts.includes(params.sortBy)) {
      sortBy = params.sortBy;
    }
    const sortOrder = params.sortOrder === 'asc' ? 'ASC' : 'DESC';

    return queryAll(`SELECT * FROM instruments ${where} ORDER BY ${sortBy} ${sortOrder}`, vals);
  },

  // ======================== 单条查询 ========================
  findById(id) {
    return queryOne('SELECT * FROM instruments WHERE id = ?', [id]);
  },

  // ======================== 新增 ========================
  create(data) {
    const fields = [
      'category', 'serial_number', 'model', 'manufacturer',
      'range_min', 'range_max', 'range_unit', 'accuracy_class',
      'installation_location', 'department',
      'certificate_number', 'inspection_date', 'valid_until',
      'inspection_result', 'inspection_unit', 'status', 'remark',
      'extra_fields', 'photo_url'
    ];

    const present = fields.filter(f => data[f] !== undefined && data[f] !== null);
    const vals = present.map(f => data[f]);
    const placeholders = present.map(() => '?').join(', ');

    if (present.length === 0) throw new Error('没有可插入的数据');

    return run(
      `INSERT INTO instruments (${present.join(', ')}) VALUES (${placeholders})`,
      vals
    );
  },

  // ======================== 更新 ========================
  update(id, data) {
    const fields = [
      'category', 'serial_number', 'model', 'manufacturer',
      'range_min', 'range_max', 'range_unit', 'accuracy_class',
      'installation_location', 'department',
      'certificate_number', 'inspection_date', 'valid_until',
      'inspection_result', 'inspection_unit', 'status', 'remark',
      'extra_fields', 'photo_url'
    ];

    const sets = [];
    const vals = [];

    for (const f of fields) {
      if (data[f] !== undefined) {
        sets.push(`${f} = ?`);
        vals.push(data[f]);
      }
    }

    if (sets.length === 0) return 0;

    sets.push("updated_at = datetime('now','localtime')");
    vals.push(id);

    const result = run(
      `UPDATE instruments SET ${sets.join(', ')} WHERE id = ?`,
      vals
    );
    return result.changes;
  },

  // ======================== 删除 ========================
  delete(id) {
    return run('DELETE FROM instruments WHERE id = ?', [id]);
  },

  // ======================== 按类别删除 ========================
  deleteByCategory(category) {
    if (!category) throw new Error('类别不能为空');
    const countRow = queryOne('SELECT COUNT(*) as cnt FROM instruments WHERE category = ?', [category]);
    const count = countRow ? countRow.cnt : 0;
    run('DELETE FROM instruments WHERE category = ?', [category]);
    return { deleted: count, category };
  },

  // ======================== 导入日志 ========================
  createImportLog(data) {
    return run(
      'INSERT INTO import_logs (file_name, total_rows, success_rows, fail_rows, error_detail) VALUES (?, ?, ?, ?, ?)',
      [
        data.file_name || '',
        data.total_rows || 0,
        data.success_rows || 0,
        data.fail_rows || 0,
        JSON.stringify(data.error_detail || [])
      ]
    );
  },

  // ======================== 按出厂编号查找 ========================
  findBySerialNo(serialNo) {
    return queryOne('SELECT * FROM instruments WHERE serial_number = ?', [serialNo]);
  },

  // ======================== 按出厂编号和类别精确查找 ========================
  // 返回数组：category 非空时按 serial_number + category 精确匹配；
  // category 为空时回退到只按编号查找（向后兼容）。
  findBySerialNoAndCategory(serialNo, category) {
    if (category) {
      return queryAll(
        'SELECT * FROM instruments WHERE serial_number = ? AND category = ?',
        [serialNo, category]
      );
    }
    return queryAll('SELECT * FROM instruments WHERE serial_number = ?', [serialNo]);
  },

  // ======================== 按ID数组批量查找 ========================
  findByIds(ids) {
    if (!ids || ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return queryAll(`SELECT * FROM instruments WHERE id IN (${placeholders})`, ids);
  },

  // ======================== 按出厂编号和类别更新证书信息 ========================
  updateCertificateBySerialNo(serialNo, data) {
    const sets = [];
    const vals = [];
    if (data.certificate_number !== undefined) { sets.push('certificate_number = ?'); vals.push(data.certificate_number); }
    if (data.inspection_date !== undefined) { sets.push('inspection_date = ?'); vals.push(data.inspection_date); }
    if (data.valid_until !== undefined) { sets.push('valid_until = ?'); vals.push(data.valid_until); }
    if (data.inspection_unit !== undefined) { sets.push('inspection_unit = ?'); vals.push(data.inspection_unit); }
    if (data.inspection_result !== undefined) { sets.push('inspection_result = ?'); vals.push(data.inspection_result); }
    if (sets.length === 0) return 0;
    sets.push("updated_at = datetime('now','localtime')");
    vals.push(serialNo);
    const result = run(`UPDATE instruments SET ${sets.join(', ')} WHERE serial_number = ?`, vals);
    return result.changes;
  },

  // ======================== 按出厂编号和类别精确更新证书信息 ========================
  // category 非空时只更新 serial_number + category 匹配的记录；
  // category 为空时回退到只按 serial_number 更新（向后兼容，但会记录日志警告）。
  updateCertificateBySerialNoAndCategory(serialNo, category, data) {
    const sets = [];
    const vals = [];
    if (data.certificate_number !== undefined) { sets.push('certificate_number = ?'); vals.push(data.certificate_number); }
    if (data.inspection_date !== undefined) { sets.push('inspection_date = ?'); vals.push(data.inspection_date); }
    if (data.valid_until !== undefined) { sets.push('valid_until = ?'); vals.push(data.valid_until); }
    if (data.inspection_unit !== undefined) { sets.push('inspection_unit = ?'); vals.push(data.inspection_unit); }
    if (data.inspection_result !== undefined) { sets.push('inspection_result = ?'); vals.push(data.inspection_result); }
    if (sets.length === 0) return 0;
    sets.push("updated_at = datetime('now','localtime')");

    if (category) {
      vals.push(serialNo, category);
      const result = run(
        `UPDATE instruments SET ${sets.join(', ')} WHERE serial_number = ? AND category = ?`,
        vals
      );
      return result.changes;
    }

    vals.push(serialNo);
    const result = run(`UPDATE instruments SET ${sets.join(', ')} WHERE serial_number = ?`, vals);
    return result.changes;
  },

  // ======================== 到期预警查询 ========================
  findExpiring(days = 30) {
    const now = new Date().toISOString().slice(0, 10);
    const deadline = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

    return queryAll(
      `SELECT * FROM instruments
       WHERE valid_until BETWEEN ? AND ?
         AND status != 'scrapped'
       ORDER BY valid_until ASC`,
      [now, deadline]
    );
  },

  // ======================== 已过期查询 ========================
  findExpired() {
    const now = new Date().toISOString().slice(0, 10);
    return queryAll(
      `SELECT * FROM instruments
       WHERE valid_until < ?
         AND status NOT IN ('scrapped')
       ORDER BY valid_until ASC`,
      [now]
    );
  }
};

module.exports = Instrument;
