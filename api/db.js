const mysql = require("mysql2/promise");

class DB {
  constructor () {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  // ========== Функция сохранения пользователя ==========
  async saveUser(ctx) {
    const { id: chat_id, username, first_name } = ctx.from;
    try {
      await this.pool.execute(`
        INSERT INTO users (chat_id, username, first_name)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE username = VALUES(username), last_seen = NOW()
      `, [chat_id, username || null, first_name || null]);
    } catch (err) {
      console.error('Ошибка сохранения пользователя:', err);
    }
  }

  // ========== Создание таблицы ==========
  async initDB() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        chat_id BIGINT UNIQUE,
        username VARCHAR(255),
        first_name VARCHAR(255),
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS vpn_keys (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        uuid CHAR(36) NOT NULL UNIQUE,
        remark VARCHAR(255),
        status ENUM('active', 'revoked') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);
  }

  // ========== Получение всех чатов с пользователями ==========
  async getAllChats() {
    return await this.pool.query('SELECT chat_id FROM users')
  }

  // ========== Удаление заблокировавшего пользователя ==========
  async deleteChat(chat_id) {
    await this.pool.execute('DELETE FROM users WHERE chat_id = ?', [chat_id])
  }

  // ========== Создание соединения ==========
  static createPool() {
    const db = new DB();
    // db.initDB(); 
    return db;
  }
}

const pool = DB.createPool();

module.exports = pool;