const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
const ValidityRules = require('../models/validityRules');
const pdfService = require('../services/pdf');

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('仅支持PDF文件'));
  },
});

// POST /api/certificate/parse - 解析PDF证书
router.post('/parse', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传PDF文件' });

    const data = await pdfService.parseCertificate(req.file.path);

    // 尝试通过出厂编号匹配数据库中的器具
    let matchedInstruments = [];
    if (data.serial_no) {
      const inst = await Instrument.findBySerialNo(data.serial_no);
      if (inst) matchedInstruments = [inst];
    }

    res.json({
      code: 200,
      data: {
        ...data,
        filePath: req.file.path,
        matchedInstruments,
      },
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '解析失败: ' + err.message });
  }
});

// POST /api/certificate/save - 保存证书信息到数据库
router.post('/save', auth, async (req, res) => {
  try {
    const { category, id, serial_no, certificate_no, verification_date, verification_unit, expire_date, equipment_name } = req.body;

    let updated = 0;
    let updatedInstrumentIds = [];

    if (id) {
      // 通过ID更新
      const result = await Instrument.updateWithHistory(id, {
        certificate_number: certificate_no,
        inspection_date: verification_date,
        inspection_unit: verification_unit,
        valid_until: expire_date,
      }, { source: 'certificate_save', operatorId: req.userId });
      if (result && result.id) updatedInstrumentIds = [Number(id)];
      updated = updatedInstrumentIds.length;
    } else if (serial_no) {
      updatedInstrumentIds = Instrument.updateCertificateWithHistoryBySerialNoAndCategory(serial_no, category, {
        certificate_number: certificate_no,
        inspection_date: verification_date,
        inspection_unit: verification_unit,
        valid_until: expire_date,
      }, { source: 'certificate_save', operatorId: req.userId });
      updated = updatedInstrumentIds.length;
    }

    res.json({ code: 200, data: { updated, updatedInstrumentIds }, message: `成功更新 ${updated} 条记录` });
  } catch (err) {
    res.status(500).json({ code: 500, message: '保存失败: ' + err.message });
  }
});

// ============ 证书前缀→类别映射 ============
const PREFIX_CATEGORY_MAP = {
  'YB': '压力变送器',
  'WB': '温度变送器',
  'YLB-Y': '普通压力表',
  'YLB-N': '耐震压力表',
  'YLB': '压力表',
  'SJS': '温度计',
  'ZSYQJCYL': '差压变送器',
  'XH': '流量计',
  'F6': '双转子流量计',
  'LZX': '流量计',
};

// 批量上传用临时目录 multer — 匹配失败时保留文件供后续修正
const uploadTemp = multer({
  dest: path.join(__dirname, '..', 'uploads', 'temp_certs'),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true);
    else cb(new Error('仅支持PDF文件'));
  },
});

// ============ 从证书编号提取检验日期 ============
// 支持格式：
//   PREFIX-H1-ZX1-YYYYMMDDNN-...   → H1-ZX1标记后10位日期码的前8位（100%准确）
//   PREFIXYYYYMMDDNNN              → 紧凑格式，正则提取首个20YYMMDD
// 委托到 ValidityRules（与 instruments 导入流程共享同一实现）
function extractInspectionDate(certNo) {
  return ValidityRules.extractInspectionDate(certNo);
}

// ============ 从 extra_fields JSON 中提取分类 ============
function getClassification(instrument) {
  try {
    if (!instrument || !instrument.extra_fields) return null;
    const ef = typeof instrument.extra_fields === 'string'
      ? JSON.parse(instrument.extra_fields)
      : instrument.extra_fields;
    const raw = ef.classification;
    if (!raw) return null;
    // 去掉"类"后缀和首尾空格，统一为 A/B/C
    return String(raw).replace(/类/g, '').trim();
  } catch (_) { return null; }
}

// ============ 根据类别和分类计算有效日期（查规则表） ============
function calculateValidUntil(inspectionDate, category, classification) {
  return ValidityRules.calculateValidUntil(inspectionDate, category, classification);
}

// ============ POST /api/certificate/batch-upload ============
// 批量上传PDF证书，自动提取出厂编号并匹配器具
router.post('/batch-upload', auth, uploadTemp.array('files', 200), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ code: 400, message: '请上传PDF文件' });
    }

    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let errorCount = 0;
    const updatedInstrumentIds = [];

    for (const file of req.files) {
      const originalName = file.originalname.replace(/\.pdf$/i, '');
      const fileResult = {
        fileName: file.originalname,
        serialNumber: null,
        categoryPrefix: null,
        category: null,
        matchedInstrument: null,
        certificateNumber: originalName, // 文件名（不含.pdf）作为证书编号
        status: 'unknown',
        updatedInstrumentIds: []
      };

      try {
        // === 解析文件名提取出厂编号和前缀 ===
        // 标准格式: {PREFIX}-H1-ZX1-{DATECODE}-{SERIAL}.pdf
        //   DATECODE = 10位数字(YYYYMMDDNN)，SERIAL 可能含 '-' (如 1807P-21621-11537)
        // 其他格式: {PREFIX}-YYYYMMDDNN, {PREFIX}-YYYY-NNNNN 等
        const parts = originalName.split('-');

        // 提取出厂编号
        let serialNumber = null;
        const h1zx1Marker = '-H1-ZX1-';
        const h1zx1Pos = originalName.indexOf(h1zx1Marker);
        if (h1zx1Pos !== -1) {
          // 标准 H1-ZX1 格式：跳过日期码(10位数字)，剩余全部为出厂编号
          const afterMarker = originalName.substring(h1zx1Pos + h1zx1Marker.length);
          const afterParts = afterMarker.split('-');
          // afterParts[0] = 日期码, afterParts[1..] = 出厂编号各段
          if (afterParts.length > 1) {
            serialNumber = afterParts.slice(1).join('-');
          } else {
            serialNumber = afterParts[0]; // 兜底：只有日期码没有编号
          }
        } else {
          // 非标准格式：取最后一个 '-' 之后的部分
          serialNumber = parts[parts.length - 1];
        }
        fileResult.serialNumber = serialNumber;

        // 提取正确的证书编号（H1-ZX1 格式：{PREFIX}-H1-ZX1-{DATECODE}，不含出厂编号段）
        if (h1zx1Pos !== -1) {
          const h1zx1Prefix = originalName.substring(0, h1zx1Pos);
          const certAfterMarker = originalName.substring(h1zx1Pos + h1zx1Marker.length);
          const certAfterParts = certAfterMarker.split('-');
          const dateCode = certAfterParts[0]; // 10位日期码
          fileResult.certificateNumber = h1zx1Prefix + h1zx1Marker + dateCode;
        }
        // 非标准格式保持 originalName（已在上面设置）

        // 提取类别前缀（第一个部分，但可能是复合前缀如 YLB-Y、YLB-N）
        let prefix = parts[0];
        // 检查是否为复合前缀（Y=普通压力表, N=耐震压力表）
        if (parts.length >= 2 && ['Y', 'N'].includes(parts[1])) {
          prefix = parts[0] + '-' + parts[1];
        }

        fileResult.categoryPrefix = prefix;
        fileResult.category = PREFIX_CATEGORY_MAP[prefix] || null;

        // === 在数据库中匹配出厂编号（按类别精确匹配） ===
        if (serialNumber) {
          const instruments = await Instrument.findBySerialNoAndCategory(
            String(serialNumber),
            fileResult.category
          );

          // 如果无法从文件名前缀解析出类别，记录警告（仅按编号匹配，可能误匹配）
          if (fileResult.category === null) {
            fileResult.warning = '无法从文件名前缀识别类别，仅按出厂编号匹配，可能关联到错误类别的器具';
          }

          if (instruments.length === 1) {
            const instrument = instruments[0];
            fileResult.matchedInstrument = {
              id: instrument.id,
              category: instrument.category,
              serial_number: instrument.serial_number,
              installation_location: instrument.installation_location,
              manufacturer: instrument.manufacturer
            };
            fileResult.status = 'matched';

            // === 自动填入证书编号 + 同步更新检验日期和有效日期 ===
            const inspectionDate = extractInspectionDate(fileResult.certificateNumber);
            const classification = getClassification(instrument);
            const validUntil = inspectionDate ? calculateValidUntil(inspectionDate, instrument.category, classification) : null;

            const updateData = { certificate_number: fileResult.certificateNumber };
            if (inspectionDate) updateData.inspection_date = inspectionDate;
            if (validUntil) updateData.valid_until = validUntil;

            fileResult.extractedInspectionDate = inspectionDate;
            fileResult.classification = classification;
            fileResult.calculatedValidUntil = validUntil;
            fileResult.dateExtracted = !!inspectionDate;

            // === 保存证书 PDF 到持久目录 ===
            try {
              const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(instrument.id));
              fs.mkdirSync(certDir, { recursive: true });
              const safeCertNo = fileResult.certificateNumber.replace(/[<>:"/\\|?*]/g, '_');
              const destPath = path.join(certDir, safeCertNo + '.pdf');
              fs.copyFileSync(file.path, destPath);
              updateData.certificate_file = `/uploads/certificates/${instrument.id}/${safeCertNo}.pdf`;
              fileResult.savedCertificateFile = updateData.certificate_file;
            } catch (fsErr) {
              fileResult.certFileWarning = '证书文件保存失败: ' + fsErr.message;
            }

            fileResult.updatedInstrumentIds = await Instrument.updateCertificateWithHistoryBySerialNoAndCategory(
              String(serialNumber),
              fileResult.category,
              updateData,
              { source: 'certificate_upload', operatorId: req.userId }
            );
            matchedCount++;
          } else if (instruments.length > 1) {
            // 同编号有多条匹配记录
            const instrument = instruments[0];

            // 如果类别未知（无法从文件名前缀识别），且有多条不同类别的记录匹配，
            // 则无法确定正确的目标，标记为 unmatched 避免跨类别误写入
            if (fileResult.category === null) {
              fileResult.status = 'unmatched';
              fileResult.tempFilePath = file.path; // 保留临时文件供后续修正
              fileResult.warning = `出厂编号 "${serialNumber}" 匹配到 ${instruments.length} 条不同类别的器具，无法自动确定目标。请手动确认类别后关联证书。`;
              unmatchedCount++;
            } else {
              // 同编号同类别有多条重复记录，全部更新并标记警告
              fileResult.matchedInstrument = {
                id: instrument.id,
                category: instrument.category,
                serial_number: instrument.serial_number,
                installation_location: instrument.installation_location,
                manufacturer: instrument.manufacturer
              };
              fileResult.status = 'matched';
              fileResult.warning = `出厂编号 "${serialNumber}" 在类别 "${fileResult.category}" 下有 ${instruments.length} 条重复记录，全部已更新（建议清理重复数据）`;

              // === 同步更新检验日期和有效日期 ===
              const inspectionDateMulti = extractInspectionDate(fileResult.certificateNumber);
              const classificationMulti = getClassification(instrument);
              const validUntilMulti = inspectionDateMulti ? calculateValidUntil(inspectionDateMulti, instrument.category, classificationMulti) : null;

              const updateDataMulti = { certificate_number: fileResult.certificateNumber };
              if (inspectionDateMulti) updateDataMulti.inspection_date = inspectionDateMulti;
              if (validUntilMulti) updateDataMulti.valid_until = validUntilMulti;

              fileResult.extractedInspectionDate = inspectionDateMulti;
              fileResult.classification = classificationMulti;
              fileResult.calculatedValidUntil = validUntilMulti;
              fileResult.dateExtracted = !!inspectionDateMulti;

              // === 保存证书 PDF 到持久目录 ===
              try {
                const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(instrument.id));
                fs.mkdirSync(certDir, { recursive: true });
                const safeCertNo = fileResult.certificateNumber.replace(/[<>:"/\\|?*]/g, '_');
                const destPath = path.join(certDir, safeCertNo + '.pdf');
                fs.copyFileSync(file.path, destPath);
                updateDataMulti.certificate_file = `/uploads/certificates/${instrument.id}/${safeCertNo}.pdf`;
                fileResult.savedCertificateFile = updateDataMulti.certificate_file;
              } catch (fsErr) {
                fileResult.certFileWarning = '证书文件保存失败: ' + fsErr.message;
              }

              fileResult.updatedInstrumentIds = await Instrument.updateCertificateWithHistoryBySerialNoAndCategory(
                String(serialNumber),
                fileResult.category,
                updateDataMulti,
                { source: 'certificate_upload', operatorId: req.userId }
              );
              matchedCount++;
            }
          } else {
            fileResult.status = 'unmatched';
            fileResult.tempFilePath = file.path; // 保留临时文件供后续修正
            unmatchedCount++;
          }
        } else {
          fileResult.status = 'error';
          fileResult.error = '无法从文件名提取出厂编号';
          errorCount++;
        }
      } catch (err) {
        fileResult.status = 'error';
        fileResult.error = err.message;
        errorCount++;
      }

      results.push(fileResult);
      updatedInstrumentIds.push(...fileResult.updatedInstrumentIds);
    }

    res.json({
      code: 200,
      data: {
        total: req.files.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        error: errorCount,
        updatedInstrumentIds: [...new Set(updatedInstrumentIds)],
        results
      },
      message: `处理完成：${matchedCount}条匹配成功，${unmatchedCount}条未匹配，${errorCount}条出错`
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '批量上传失败: ' + err.message });
  }
});

// ============ 标准化日期字符串用于比较（去分隔符） ============
function normalizeDate(dateStr) {
  if (!dateStr) return '';
  return String(dateStr).replace(/[^\d]/g, '').substring(0, 8);
}

// ============ GET /api/certificate/check-dates ============
// 扫描全部器具，双维度校验：
//   维度一：证书编号提取日期 ↔ 数据库检验日期
//   维度二：检验日期 ↔ 有效日期（按业务规则计算）
router.get('/check-dates', auth, async (req, res) => {
  try {
    const { category, classification, status, onlyMismatch } = req.query;
    const page = parseInt(req.query.page) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize) || 200, 500);

    const params = {};
    if (category) params.category = category;
    if (classification) params.classification = classification;
    if (status) params.status = status;
    params.page = 1;
    params.pageSize = 99999;

    const allInstruments = await Instrument.list(params);
    const results = [];
    let certMatch = 0, certMismatch = 0, certMissing = 0, certNoExtract = 0;
    let validMatch = 0, validMismatch = 0, validMissing = 0;
    let totalMatch = 0, totalMismatch = 0, totalMissing = 0, totalSkip = 0;

    for (const inst of allInstruments.list) {
      const cls = getClassification(inst);

      // ===== 维度一：证书编号 → 检验日期 =====
      let certStatus = 'no_cert';
      let extractedDate = null;
      if (inst.certificate_number) {
        extractedDate = extractInspectionDate(inst.certificate_number);
        if (!extractedDate) {
          certStatus = 'cert_no_extract';
          certNoExtract++;
        } else if (!inst.inspection_date) {
          certStatus = 'cert_missing';
          certMissing++;
        } else if (normalizeDate(extractedDate) === normalizeDate(inst.inspection_date)) {
          certStatus = 'cert_match';
          certMatch++;
        } else {
          certStatus = 'cert_mismatch';
          certMismatch++;
        }
      } else {
        certNoExtract++; // counted as no_cert for summary
      }

      // ===== 维度二：检验日期 → 有效日期 =====
      let validStatus = 'no_inspection';
      let expectedValidUntil = null;
      if (inst.inspection_date) {
        expectedValidUntil = calculateValidUntil(inst.inspection_date, inst.category, cls);
        if (!expectedValidUntil) {
          validStatus = 'no_inspection';
        } else if (!inst.valid_until) {
          validStatus = 'valid_missing';
          validMissing++;
        } else if (normalizeDate(expectedValidUntil) === normalizeDate(inst.valid_until)) {
          validStatus = 'valid_match';
          validMatch++;
        } else {
          validStatus = 'valid_mismatch';
          validMismatch++;
        }
      }

      // ===== 综合状态 =====
      let itemStatus;
      const hasCertIssue = certStatus === 'cert_mismatch' || certStatus === 'cert_missing';
      const hasValidIssue = validStatus === 'valid_mismatch' || validStatus === 'valid_missing';
      const hasCertData = certStatus === 'cert_match' || certStatus === 'cert_mismatch' || certStatus === 'cert_missing';
      const hasValidData = validStatus === 'valid_match' || validStatus === 'valid_mismatch' || validStatus === 'valid_missing';

      if (hasCertIssue || hasValidIssue) {
        itemStatus = 'mismatch';
        totalMismatch++;
      } else if (certStatus === 'cert_missing' || validStatus === 'valid_missing') {
        itemStatus = 'missing';
        totalMissing++;
      } else if (hasCertData || hasValidData) {
        itemStatus = 'match';
        totalMatch++;
      } else {
        itemStatus = 'skip';
        totalSkip++;
      }

      // 从证书提取日期计算预期有效日期（用于批量更新参考）
      const certExpectedValidUntil = extractedDate
        ? calculateValidUntil(extractedDate, inst.category, cls)
        : null;

      results.push({
        id: inst.id,
        category: inst.category,
        serial_number: inst.serial_number,
        certificate_number: inst.certificate_number,
        inspection_date: inst.inspection_date,
        valid_until: inst.valid_until,
        classification: cls,
        // 维度一
        extracted_date: extractedDate,
        cert_expected_valid_until: certExpectedValidUntil,
        cert_status: certStatus,
        // 维度二
        expected_valid_until: expectedValidUntil,
        valid_status: validStatus,
        // 综合
        status: itemStatus
      });
    }

    // 筛选
    let filtered = results;
    if (onlyMismatch === '1') {
      filtered = results.filter(r => r.status === 'mismatch' || r.status === 'missing');
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    res.json({
      code: 200,
      data: {
        total: allInstruments.list.length,
        certMatch, certMismatch, certMissing, certNoExtract,
        validMatch, validMismatch, validMissing,
        match: totalMatch, mismatch: totalMismatch, missing: totalMissing, skip: totalSkip,
        results: paged,
        page, pageSize,
        pageTotal: Math.ceil(total / pageSize)
      }
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '日期校验失败: ' + err.message });
  }
});

// ============ POST /api/certificate/batch-update-dates ============
// 批量更新检验日期和有效日期
router.post('/batch-update-dates', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ code: 400, message: '请提供要更新的器具列表' });
    }

    let updated = 0;
    for (const item of items) {
      if (!item.id) continue;
      const updateData = {};
      if (item.inspection_date) updateData.inspection_date = item.inspection_date;
      if (item.valid_until) updateData.valid_until = item.valid_until;
      if (Object.keys(updateData).length === 0) continue;

      await Instrument.updateWithHistory(item.id, updateData, {
        source: 'certificate_date_fix',
        operatorId: req.userId
      });
      updated++;
    }

    res.json({ code: 200, data: { updated }, message: `成功更新 ${updated} 条记录` });
  } catch (err) {
    res.status(500).json({ code: 500, message: '批量更新失败: ' + err.message });
  }
});

// ============ 有效日期规则管理 ============

// GET /api/certificate/validity-rules — 获取所有规则
router.get('/validity-rules', auth, async (req, res) => {
  try {
    const rules = ValidityRules.list();
    res.json({ code: 200, data: { rules } });
  } catch (err) {
    res.status(500).json({ code: 500, message: '获取规则失败: ' + err.message });
  }
});

// POST /api/certificate/validity-rules — 新增规则
router.post('/validity-rules', auth, async (req, res) => {
  try {
    const { category, classification, period_value, period_unit, priority } = req.body;
    if (!category || !period_value) {
      return res.status(400).json({ code: 400, message: '类别和有效期数值为必填项' });
    }
    const rule = ValidityRules.create({ category, classification, period_value, period_unit, priority });
    res.json({ code: 200, data: { rule }, message: '规则添加成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '新增规则失败: ' + err.message });
  }
});

// PUT /api/certificate/validity-rules/:id — 修改规则
router.put('/validity-rules/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的ID' });
    const rule = ValidityRules.update(id, req.body);
    if (!rule) return res.status(404).json({ code: 404, message: '规则不存在' });
    res.json({ code: 200, data: { rule }, message: '规则更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '更新规则失败: ' + err.message });
  }
});

// DELETE /api/certificate/validity-rules/:id — 删除规则
router.delete('/validity-rules/:id', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ code: 400, message: '无效的ID' });
    const changes = ValidityRules.delete(id);
    if (changes === 0) return res.status(404).json({ code: 404, message: '规则不存在' });
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '删除规则失败: ' + err.message });
  }
});

// POST /api/certificate/validity-rules/reset — 重置为默认规则
router.post('/validity-rules/reset', auth, async (req, res) => {
  try {
    const rules = ValidityRules.resetDefaults();
    res.json({ code: 200, data: { rules }, message: '已重置为默认规则' });
  } catch (err) {
    res.status(500).json({ code: 500, message: '重置规则失败: ' + err.message });
  }
});

// ============ 模糊匹配辅助函数 ============
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[m][n];
}

function similarityScore(targetSN, candidateSN) {
  const a = String(targetSN || '').replace(/-/g, '').toLowerCase();
  const b = String(candidateSN || '').replace(/-/g, '').toLowerCase();
  if (!a || !b) return 0;
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// ============ 辅助：清理敏感字段用于响应 ============
function sanitizeForResponse(record) {
  if (!record) return null;
  const clean = { ...record };
  delete clean.photo_url;
  delete clean.certificate_file;
  return clean;
}

// ============ POST /api/certificate/unmatched-search ============
// 证书未匹配时，搜索可能的匹配候选
router.post('/unmatched-search', auth, async (req, res) => {
  try {
    const { serialNumber, certificateNumber, category, keyword } = req.body;
    if (!serialNumber) {
      return res.status(400).json({ code: 400, message: '请提供证书中的出厂编号' });
    }

    // 策略1：同类别 + 关键词
    const candidates1 = Instrument.fuzzySearchBySerialNo(serialNumber, category || null, keyword || '');
    // 策略2：全库模糊匹配
    const candidates2 = category ? Instrument.searchAllBySerialFuzzy(serialNumber, 30) : [];
    // 合并去重
    const seen = new Set();
    const allCandidates = [];
    for (const c of [...candidates1, ...candidates2]) {
      if (!seen.has(c.id)) { seen.add(c.id); allCandidates.push(c); }
    }

    // 计算相似度并排序
    const scored = allCandidates.map(c => ({
      id: c.id,
      category: c.category,
      serial_number: c.serial_number,
      installation_location: c.installation_location || '',
      model: c.model || '',
      manufacturer: c.manufacturer || '',
      similarity: similarityScore(serialNumber, c.serial_number)
    }));

    // 按相似度降序，取前 10 条
    scored.sort((a, b) => b.similarity - a.similarity);
    const candidates = scored.slice(0, 10);

    res.json({ code: 200, data: { serialNumber, certificateNumber, category: category || null, candidates } });
  } catch (err) {
    res.status(500).json({ code: 500, message: '搜索失败: ' + err.message });
  }
});

// ============ POST /api/certificate/force-match ============
// 以证书为准：将证书信息强制关联到指定器具
router.post('/force-match', auth, async (req, res) => {
  try {
    const { certificateSerialNumber, certificateNumber, category, targetInstrumentId, updateSerialNumber, tempFilePath, inspectionDate, validUntil } = req.body;

    const instrument = await Instrument.findById(targetInstrumentId);
    if (!instrument) return res.status(404).json({ code: 404, message: '目标器具不存在或已在回收站' });

    const oldSerialNumber = instrument.serial_number;

    // 如果要求修正出厂编号，先检查新编号是否在同类别下已存在
    if (updateSerialNumber && certificateSerialNumber) {
      const dups = Instrument.findBySerialNoAndCategory(String(certificateSerialNumber), category || null);
      const otherDups = (dups || []).filter(d => Number(d.id) !== Number(targetInstrumentId));
      if (otherDups.length > 0) {
        // 同类别下已有另一条器具使用了该编号，仍然允许但记录警告
        console.warn('[force-match] 出厂编号 ' + certificateSerialNumber +
          ' 在类别 "' + (category || '未知') + '" 下已存在器具 #' + otherDups.map(d => d.id).join(', '));
      }
    }

    // 构建更新数据
    const updateData = {};
    if (updateSerialNumber && certificateSerialNumber) {
      updateData.serial_number = String(certificateSerialNumber);
    }
    if (certificateNumber) {
      updateData.certificate_number = String(certificateNumber);
    }
    if (inspectionDate) {
      updateData.inspection_date = inspectionDate;
    }
    if (validUntil) {
      updateData.valid_until = validUntil;
    }

    // 处理临时证书文件 → 移动到永久目录
    if (tempFilePath) {
      try {
        const absTempPath = path.resolve(tempFilePath);
        const tempDir = path.resolve(path.join(__dirname, '..', 'uploads', 'temp_certs'));
        if (absTempPath.startsWith(tempDir + path.sep) && fs.existsSync(absTempPath)) {
          const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(targetInstrumentId));
          fs.mkdirSync(certDir, { recursive: true });
          const safeCertNo = (certificateNumber || certificateSerialNumber || 'cert').replace(/[<>:"/\\|?*]/g, '_');
          const destPath = path.join(certDir, safeCertNo + '.pdf');
          fs.copyFileSync(absTempPath, destPath);
          updateData.certificate_file = `/uploads/certificates/${targetInstrumentId}/${safeCertNo}.pdf`;
          // 删除临时文件
          try { fs.unlinkSync(absTempPath); } catch (_) { /* ignore */ }
        }
      } catch (fsErr) {
        console.warn('[force-match] 证书文件处理失败:', fsErr.message);
      }
    }

    const result = await Instrument.updateWithHistory(targetInstrumentId, updateData, {
      source: 'certificate_correction',
      operatorId: req.userId
    });

    res.json({
      code: 200,
      data: {
        id: targetInstrumentId,
        oldSerialNumber,
        newSerialNumber: updateSerialNumber ? certificateSerialNumber : oldSerialNumber,
        certificateNumber: certificateNumber || null,
        inspectionDate: inspectionDate || null,
        validUntil: validUntil || null,
        historyId: result?.id || null
      },
      message: updateSerialNumber
        ? `已修正器具 #${targetInstrumentId} 的出厂编号并关联证书`
        : `已将证书关联到器具 #${targetInstrumentId}`
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '强制匹配失败: ' + err.message });
  }
});

// ============ POST /api/certificate/create-from-cert ============
// 用证书信息创建新器具
router.post('/create-from-cert', auth, async (req, res) => {
  try {
    const { serialNumber, certificateNumber, category, inspectionDate, validUntil, tempFilePath, classification, location } = req.body;

    if (!serialNumber) return res.status(400).json({ code: 400, message: '出厂编号不能为空' });
    if (!category) return res.status(400).json({ code: 400, message: '器具类别不能为空' });

    const data = {
      serial_number: String(serialNumber),
      category: String(category),
      certificate_number: certificateNumber || null,
      inspection_date: inspectionDate || null,
      valid_until: validUntil || null,
      installation_location: location || '',
      status: 'active'
    };

    if (classification) {
      const clsVal = String(classification).replace(/类/g, '').trim();
      data.extra_fields = JSON.stringify({ classification: clsVal + '类' });
    }

    // 处理临时证书文件
    const result = await Instrument.createWithHistory(data, {
      source: 'certificate_create',
      operatorId: req.userId
    });

    const newId = result.id;
    let certFile = null;

    if (tempFilePath) {
      try {
        const absTempPath = path.resolve(tempFilePath);
        const tempDir = path.resolve(path.join(__dirname, '..', 'uploads', 'temp_certs'));
        if (absTempPath.startsWith(tempDir + path.sep) && fs.existsSync(absTempPath)) {
          const certDir = path.join(__dirname, '..', 'uploads', 'certificates', String(newId));
          fs.mkdirSync(certDir, { recursive: true });
          const safeCertNo = (certificateNumber || serialNumber || 'cert').replace(/[<>:"/\\|?*]/g, '_');
          const destPath = path.join(certDir, safeCertNo + '.pdf');
          fs.copyFileSync(absTempPath, destPath);
          certFile = `/uploads/certificates/${newId}/${safeCertNo}.pdf`;
          // 更新证书文件路径
          Instrument.update(newId, { certificate_file: certFile });
          try { fs.unlinkSync(absTempPath); } catch (_) { /* ignore */ }
        }
      } catch (fsErr) {
        console.warn('[create-from-cert] 证书文件处理失败:', fsErr.message);
      }
    }

    res.json({
      code: 200,
      data: {
        id: newId,
        serial_number: serialNumber,
        certificate_number: certificateNumber || null,
        certificate_file: certFile
      },
      message: '已根据证书信息创建新器具'
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '创建失败: ' + err.message });
  }
});

module.exports = router;
