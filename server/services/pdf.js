const fs = require('fs');

/**
 * PDF证书解析服务
 * 使用 pdfjs-dist 提取文本，然后正则匹配关键字段
 */
async function parseCertificate(filePath) {
  let pdfjsLib;
  try {
    pdfjsLib = require('pdfjs-dist');
  } catch (e) {
    // fallback: 尝试pdf-parse
    return parseWithPdfParse(filePath);
  }

  try {
    const data = new Uint8Array(fs.readFileSync(filePath));
    const doc = await pdfjsLib.getDocument({ data }).promise;

    let fullText = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      fullText += content.items.map(item => item.str).join(' ') + '\n';
    }

    return extractFields(fullText);
  } catch (e) {
    console.error('pdfjs解析失败:', e.message);
    return parseWithPdfParse(filePath);
  }
}

async function parseWithPdfParse(filePath) {
  try {
    const pdfParse = require('pdf-parse');
    const buf = fs.readFileSync(filePath);
    let data;
    if (typeof pdfParse === 'function') {
      data = await pdfParse(buf);
    } else if (pdfParse.PDFParse) {
      data = await new pdfParse.PDFParse(buf);
    } else {
      throw new Error('pdf-parse无法使用');
    }
    return extractFields(data.text);
  } catch (e) {
    console.error('pdf-parse也失败了:', e.message);
    return { error: '无法解析PDF文件: ' + e.message };
  }
}

/**
 * 从文本中提取关键字段
 */
function extractFields(text) {
  const result = {
    certificate_no: null,
    equipment_name: null,
    model_spec: null,
    serial_no: null,
    manufacturer: null,
    verification_date: null,
    verification_unit: null,
    expire_date: null,
    raw_text: text,
  };

  // 证书编号（PDF文字可能含空格，需先合并）
  // 常见格式: YB-H1-ZX1-2026040306, YLB-H1-ZX1-2025010201, SJS-H1-..., WB-H1-..., ZSYQJ...
  // 先去噪：移除证书编号区域的多余空格
  const certCleaned = text
    .replace(/证\s*书\s*编\s*号[：:\s]*/, '证书编号:')
    .replace(/([A-Z]{2,})\s*-\s*([A-Z0-9]+)\s*-\s*([A-Z0-9]+)\s*-\s*([0-9\s]+[0-9])/g, (m, p1, p2, p3, p4) => {
      return p1 + '-' + p2 + '-' + p3 + '-' + p4.replace(/\s+/g, '');
    });

  const certPatterns = [
    /证书编号[：:\s]*([A-Za-z0-9]{2,}-[A-Za-z0-9]+-[A-Za-z0-9]+-\d+)/,
    /YB-H1-ZX1-\d+/,
    /SJS-H1-ZX1-\d+/,
    /YLB-[A-Z]*-H1-ZX1-\d+/,
    /WB-H1-ZX1-\d+/,
    /ZSYQJ[A-Za-z0-9]+/,
  ];
  for (const pat of certPatterns) {
    const m = certCleaned.match(pat) || text.match(pat);
    if (m) { result.certificate_no = m[1] || m[0]; break; }
  }

  // 器具名称
  const nameMatch = text.match(/计量器具名称[：:\s]*(\S+)/);
  if (nameMatch) result.equipment_name = nameMatch[1];

  // 型号规格
  const modelMatch = text.match(/型\s*号\s*[\/／]\s*规\s*格[：:\s]*(\S+)/);
  if (modelMatch) result.model_spec = modelMatch[1];

  // 出厂编号
  const snPatterns = [
    /出\s*厂\s*编\s*号[：:\s]*(\S+)/,
    /器\s*具\s*编\s*号[：:\s]*(\S+)/,
    /编\s*号[：:\s]*(\d{6,})/,
  ];
  for (const pat of snPatterns) {
    const m = text.match(pat);
    if (m) { result.serial_no = m[1]; break; }
  }

  // 制造单位
  const mfrMatch = text.match(/(?:制\s*造\s*单\s*位|生\s*产\s*厂\s*家)[：:\s]*(\S+)/);
  if (mfrMatch) result.manufacturer = mfrMatch[1];

  // 校准日期
  const datePatterns = [
    /校\s*准\s*日\s*期[：:\s]*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/,
    /检\s*定\s*日\s*期[：:\s]*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/,
    /校\s*准\s*日\s*期[：:\s]*(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) {
      result.verification_date = m[1].replace(/[年月]/g, '-').replace(/日/g, '').replace(/\s+/g, '');
      break;
    }
  }

  // 校准单位
  if (text.includes('山东海盛')) result.verification_unit = '山东海盛海洋工程集团有限公司';
  else if (text.includes('胜利油田')) result.verification_unit = '胜利油田分公司技术检测中心';

  return result;
}

module.exports = { parseCertificate };
