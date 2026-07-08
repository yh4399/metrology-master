const { queryAll, queryOne, run, transaction } = require('./db');

const InspectionBatch = {
  // ===== 批次 CRUD =====
  list() {
    const batches = queryAll('SELECT * FROM inspection_batches ORDER BY updated_at DESC, id DESC');
    return batches.map(b => ({
      ...b,
      itemCount: (queryOne('SELECT COUNT(*) as cnt FROM inspection_batch_items WHERE batch_id = ?', [b.id]) || {}).cnt || 0
    }));
  },

  findById(id) {
    return queryOne('SELECT * FROM inspection_batches WHERE id = ?', [id]);
  },

  create(name) {
    const result = run('INSERT INTO inspection_batches (name, status) VALUES (?, ?)', [name, 'draft']);
    return { id: result.lastInsertId, name, status: 'draft' };
  },

  update(id, data) {
    const sets = [];
    const vals = [];
    if (data.name !== undefined) { sets.push('name = ?'); vals.push(data.name); }
    if (data.status !== undefined) { sets.push('status = ?'); vals.push(data.status); }
    if (sets.length === 0) return 0;
    sets.push("updated_at = datetime('now','localtime')");
    vals.push(id);
    return run(`UPDATE inspection_batches SET ${sets.join(', ')} WHERE id = ?`, vals).changes;
  },

  delete(id) {
    // CASCADE will handle items
    return run('DELETE FROM inspection_batches WHERE id = ?', [id]).changes;
  },

  // ===== 批次项目 =====
  getItems(batchId) {
    return queryAll('SELECT * FROM inspection_batch_items WHERE batch_id = ? ORDER BY id', [batchId]);
  },

  getItem(batchId, itemId) {
    return queryOne('SELECT * FROM inspection_batch_items WHERE batch_id = ? AND id = ?', [batchId, itemId]);
  },

  addItems(batchId, instruments) {
    return transaction(() => {
      let count = 0;
      for (const inst of instruments) {
        // Check duplicate
        const existing = queryOne(
          'SELECT id FROM inspection_batch_items WHERE batch_id = ? AND instrument_id = ?',
          [batchId, inst.id]
        );
        if (existing) continue;

        run(
          `INSERT INTO inspection_batch_items
            (batch_id, instrument_id, serial_number, category, installation_location, model, manufacturer,
             old_certificate_number, old_inspection_date, old_valid_until)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            batchId, inst.id,
            inst.serial_number || '', inst.category || '',
            inst.installation_location || '', inst.model || '', inst.manufacturer || '',
            inst.certificate_number || '', inst.inspection_date || '', inst.valid_until || ''
          ]
        );
        count++;
      }
      return count;
    });
  },

  removeItem(batchId, itemId) {
    return run('DELETE FROM inspection_batch_items WHERE batch_id = ? AND id = ?', [batchId, itemId]).changes;
  },

  updateItem(batchId, itemId, data) {
    const sets = [];
    const vals = [];
    const fields = [
      'new_certificate_number', 'new_inspection_date', 'new_valid_until',
      'certificate_file', 'match_status', 'notes'
    ];
    for (const f of fields) {
      if (data[f] !== undefined) { sets.push(f + ' = ?'); vals.push(data[f]); }
    }
    if (sets.length === 0) return 0;
    vals.push(batchId, itemId);
    return run(
      `UPDATE inspection_batch_items SET ${sets.join(', ')} WHERE batch_id = ? AND id = ?`,
      vals
    ).changes;
  },

  // Mark all items as updated (after applying to ledger)
  markAllUpdated(batchId) {
    return run(
      "UPDATE inspection_batch_items SET match_status = 'updated' WHERE batch_id = ? AND match_status != 'updated'",
      [batchId]
    ).changes;
  },

  // ===== 计量确认记录 =====

  // 获取确认记录预览数据（批次 + 项目 + 仪器信息）
  getConfirmationPreview(batchId) {
    const batch = queryOne('SELECT * FROM inspection_batches WHERE id = ?', [batchId]);
    if (!batch) return null;

    const items = queryAll(
      `SELECT i.*, ins.category AS ins_category, ins.serial_number AS ins_serial_number,
              ins.model AS ins_model, ins.manufacturer AS ins_manufacturer,
              ins.range_min, ins.range_max, ins.range_unit, ins.accuracy_class,
              ins.installation_location AS ins_installation_location,
              ins.inspection_unit AS ins_inspection_unit
       FROM inspection_batch_items i
       LEFT JOIN instruments ins ON i.instrument_id = ins.id
       WHERE i.batch_id = ?
       ORDER BY i.id`,
      [batchId]
    );

    return { batch, items };
  },

  // 保存批次确认信息
  updateBatchConfirmationInfo(batchId, info) {
    return run(
      "UPDATE inspection_batches SET confirmation_info = ?, updated_at = datetime('now','localtime') WHERE id = ?",
      [JSON.stringify(info || {}), batchId]
    ).changes;
  },

  // 保存单个项目的确认数据
  updateItemConfirmationData(batchId, itemId, data) {
    return run(
      'UPDATE inspection_batch_items SET confirmation_data = ? WHERE batch_id = ? AND id = ?',
      [JSON.stringify(data || {}), batchId, itemId]
    ).changes;
  }
};

module.exports = InspectionBatch;
