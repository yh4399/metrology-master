const jwt = require('jsonwebtoken')
const config = require('../config')

/**
 * JWT 验证中间件
 * 从 Authorization 头提取 token，验证后将 userId 注入 req
 */
function auth(req, res, next) {
  // 优先从 Authorization 头读取，其次从 query string (用于文件下载)
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录，请先登录' })
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    req.userId = decoded.userId
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ code: 401, message: '登录已过期，请重新登录' })
    }
    return res.status(401).json({ code: 401, message: '无效的登录凭证' })
  }
}

module.exports = auth
