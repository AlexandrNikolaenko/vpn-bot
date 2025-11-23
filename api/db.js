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

  async getKey(chat_id) {
    try {
      const [user] = await this.pool.query(`
        SELECT * 
        FROM users JOIN vpn_keys 
        ON users.id = vpn_keys.user_id 
        WHERE users.chat_id = ${chat_id}`);
      console.log(user);
      if (user[0] && user[0].url) {
        return {
          status: 'fill',
          url: user[0].url
        }
      } else {
        return {status: 'empty'}
      }
    } catch(e) {
      console.log(e);
      return {status: 'empty'}
    }
  }

  // ========== Добавления нового клиента в VPN ==========

  async addKey(user) {
    const {userId: chat_id, uuid, email, subId: sub_id, url} = user;
    try {
      const [user] = await this.pool.query(`SELECT * FROM users WHERE chat_id = ${chat_id}`);
      
      const user_id = user[0].id;

      await this.pool.execute(`
        INSERT INTO vpn_keys (user_id, uuid, sub_id, email, url)
        VALUES (?, ?, ?, ?, ?)
      `, [user_id, uuid, sub_id, email, url]);

      setTimeout(() => {
        this.pool.execute(`DELETE FROM vpn_keys WHERE uuid = '${uuid}'`)
      }, 1000 * 60 * 2);

    } catch(e) {
      console.error('Ошибка сохранения пользователя:', e);
      return new Error(e);
    }
  }

  // ========== Обновление ключа ==========

  async updateKey(user) {
    const {userId: chat_id, uuid, email, subId: sub_id, url} = user;
    try {
      const [lastUser] = await this.pool.query(`
        SELECT vpn_keys.* 
        FROM users JOIN vpn_keys 
        ON users.id = vpn_keys.user_id 
        WHERE users.chat_id = ${chat_id}`);

      console.log(lastUser);
      
      if (!lastUser[0]) {
        await this.addKey(user);
        return;
      }
      const user_id = lastUser[0].user_id;

      await this.pool.execute(`
        UPDATE vpn_keys
        SET uuid = ?, sub_id = ?, email = ?, url = ?
        WHERE user_id = ?
      `, [uuid, sub_id, email, url, user_id]);

      return lastUser[0].uuid;

    } catch(e) {
      console.error('Ошибка сохранения пользователя:', e);
      return new Error(e);
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
        sub_id CHAR(16) NOT NULL UNIQUE,
        email CHAR(8) NOT NULL UNIQUE,
        url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    const [keys] = await this.pool.query(`SELECT k.*
      FROM vpn_keys k
      JOIN users u ON k.user_id = u.id
      WHERE u.chat_id = ${chat_id};
    `)
    await this.pool.execute('DELETE FROM users WHERE chat_id = ?', [chat_id]);
    return keys[0].uuid;
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