const express = require('express');
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Instrument = require('../models/instrument');
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

    if (id && category) {
      // 通过ID更新
      const result = await Instrument.update(category, id, {
        certificate_no,
        verification_date,
        verification_unit,
        expire_date,
      });
      updated = result.changes || 0;
    } else if (serial_no) {
      // 通过出厂编号更新（跨表）
      for (const [cat] of Object.entries(require('../models/db').CATEGORY_TABLES)) {
        const result = await Instrument.updateByCertificate(cat, serial_no, {
          certificate_no,
          verification_date,
          verification_unit,
          expire_date,
        });
        if (result > 0) { updated = result; break; }
      }
    }

    res.json({ code: 200, data: { updated }, message: `成功更新 ${updated} 条记录` });
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

// ============ POST /api/certificate/batch-upload ============
// 批量上传PDF证书，自动提取出厂编号并匹配器具
router.post('/batch-upload', auth, upload.array('files', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ code: 400, message: '请上传PDF文件' });
    }

    const results = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    let errorCount = 0;

    for (const file of req.files) {
      const originalName = file.originalname.replace(/\.pdf$/i, '');
      const fileResult = {
        fileName: file.originalname,
        serialNumber: null,
        categoryPrefix: null,
        category: null,
        matchedInstrument: null,
        certificateNumber: originalName, // 文件名（不含.pdf）作为证书编号
        status: 'unknown'
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

            // === 自动填入证书编号（按类别精确更新） ===
            await Instrument.updateCertificateBySerialNoAndCategory(
              String(serialNumber),
              fileResult.category,
              { certificate_number: originalName }
            );
            matchedCount++;
          } else if (instruments.length > 1) {
            // 同编号有多条匹配记录
            const instrument = instruments[0];

            // 如果类别未知（无法从文件名前缀识别），且有多条不同类别的记录匹配，
            // 则无法确定正确的目标，标记为 unmatched 避免跨类别误写入
            if (fileResult.category === null) {
              fileResult.status = 'unmatched';
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

              await Instrument.updateCertificateBySerialNoAndCategory(
                String(serialNumber),
                fileResult.category,
                { certificate_number: originalName }
              );
              matchedCount++;
            }
          } else {
            fileResult.status = 'unmatched';
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
    }

    res.json({
      code: 200,
      data: {
        total: req.files.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        error: errorCount,
        results
      },
      message: `处理完成：${matchedCount}条匹配成功，${unmatchedCount}条未匹配，${errorCount}条出错`
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '批量上传失败: ' + err.message });
  }
});

module.exports = router;
