const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();

// 确保上传目录存在
const uploadsDir = path.join(__dirname, 'uploads');
const photosDir = path.join(uploadsDir, 'photos');
const certsDir = path.join(uploadsDir, 'certificates');
const tempCertsDir = path.join(uploadsDir, 'temp_certs');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
if (!fs.existsSync(certsDir)) fs.mkdirSync(certsDir, { recursive: true });
if (!fs.existsSync(tempCertsDir)) fs.mkdirSync(tempCertsDir, { recursive: true });

// 清理超过 24 小时的临时证书文件
try {
  const now = Date.now();
  const tempFiles = fs.readdirSync(tempCertsDir);
  for (const f of tempFiles) {
    const fPath = path.join(tempCertsDir, f);
    try {
      const stat = fs.statSync(fPath);
      if (now - stat.mtimeMs > 24 * 3600 * 1000) {
        fs.unlinkSync(fPath);
      }
    } catch (_) { /* ignore */ }
  }
} catch (_) { /* ignore */ }

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session(config.session));

// 静态文件：上传的图片（需要认证）
const uploadsAuth = require('./middleware/uploadsAuth');
app.use('/uploads', uploadsAuth, express.static(path.join(__dirname, 'uploads')));

// 静态文件：前端构建产物（生产模式）
app.use(express.static(path.join(__dirname, 'public')));

// 视图引擎（保留EJS作为后备）
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==================== 前端SPA入口（生产模式） ====================
// 当访问非API路径时，返回Vue应用的index.html
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ==================== 页面路由（EJS后备） ====================
// 如果在开发模式，Vite dev server处理前端; 生产模式则由上面的静态文件处理

// ==================== API路由 ====================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/instruments', require('./routes/instruments'));
app.use('/api/certificate', require('./routes/certificate'));

// ==================== SPA fallback：非API请求返回index.html ====================
if (fs.existsSync(clientDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ==================== 启动 ====================
const { getDb } = require('./models/db');

async function start() {
  await getDb();
  require('./models/validityRules').init();
  console.log('数据库初始化完成');

  app.listen(config.port, () => {
    console.log(`计量器具管理系统已启动: http://localhost:${config.port}`);
    console.log(`API地址: http://localhost:${config.port}/api`);
  });
}

start().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});

module.exports = app;
