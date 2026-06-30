const { queryOne } = require('./db');

const User = {
  async findByUsername(username) {
    return queryOne('SELECT id, username, password, nickname, created_at FROM users WHERE username = ?', [username]);
  },

  async findById(id) {
    return queryOne('SELECT id, username, nickname, created_at FROM users WHERE id = ?', [id]);
  },
};

module.exports = User;
