require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  jwt: {
    secret: process.env.JWT_SECRET || require('crypto').randomBytes(64).toString('hex'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  upload: {
    excelMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 50 * 1024 * 1024,
    pdfMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE, 10) || 50 * 1024 * 1024,
  },

  session: {
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
  },
};
