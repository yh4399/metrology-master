const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * 上传文件访问鉴权中间件
 *
 * 用于保护 /uploads 静态文件目录，防止未认证用户直接通过 URL 访问照片和 Excel 文件。
 * 支持两种传递 token 的方式：
 *   1. Authorization: Bearer <token>  (axios/fetch 请求自动携带)
 *   2. ?token=<token>                (img 标签、直接下载链接等无法设置 header 的场景)
 *
 * 验证逻辑与 auth.js 中的 JWT 中间件保持一致。
 */
function uploadsAuth(req, res, next) {
  // 优先从 Authorization header 读取，其次从 query string
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).send('未登录，请先登录');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).send('登录已过期，请重新登录');
    }
    return res.status(401).send('无效的登录凭证');
  }
}

module.exports = uploadsAuth;
