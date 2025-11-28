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

  // ========== Функция получения информации о пользователе по id ==========
  async getUserById(id) {
    try {
      const [res] = await this.pool.query(`
        SELECT *
        FROM users
        WHERE chat_id = ?
        LIMIT 1
      `, [id]);
      return res[0];
    } catch (err) {
      console.error('Ошибка получения пользователя:', err);
    }
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

  // ========== Функция обновления состояния согласия ==========
  async setAgreeUser(ctx) {
    const chatId = ctx.from.id;

    try {
      // Обновляем пользователя
      const [result] = await this.pool.query(
        `UPDATE users SET agreed = 1 WHERE chat_id = ?`,
        [chatId]
      );

      if (result.affectedRows === 0) {
        console.warn(`setAgreeUser: user with chat_id=${chatId} not found`);
        return null;
      }

      // Возвращаем обновлённые данные пользователя (по желанию)
      const [rows] = await this.pool.query(
        `SELECT * FROM users WHERE chat_id = ? LIMIT 1`,
        [chatId]
      );

      return rows[0];

    } catch (err) {
      console.error("DB ERROR in setAgreeUser:", err);
      throw err;
    }
  }

  // ========== Функция получуения ключа пользователя ==========
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

      if (!user[0]) {
        throw new Error(`Пользователь с chat_id=${chat_id} не найден`);
      }
      
      const user_id = user[0].id;

      await this.pool.execute(`
        INSERT INTO vpn_keys (user_id, uuid, sub_id, email, url)
        VALUES (?, ?, ?, ?, ?)
      `, [user_id, uuid, sub_id, email, url]);

      // 3. Обновляем last_key_at для пользователя
      await this.pool.execute(
        `UPDATE users SET last_key_at = NOW() WHERE id = ?`,
        [user_id]
      );

      setTimeout(() => {
        try {
          this.pool.execute(
            `DELETE FROM vpn_keys WHERE uuid = ?`,
            [uuid]
          );
        } catch (e) {
          console.error('Ошибка удаления VPN ключа по таймауту:', e);
        }
      }, 1000 * 60 * 60 * 24 * 7);

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

  // ========== Функция сохранения рекламы ==========
  async saveAd(chatId, messageId) {
    try {
      await this.pool.query(
        `INSERT INTO ads (admin_chat_id, message_id, created_at)
        VALUES (?, ?, NOW())`,
        [chatId, messageId]
      );
    } catch(e) {
      console.log(e);
      throw e;
    }
  }

  async getLastAd() {
    try {
      const [rows] = await this.pool.query(
        "SELECT * FROM ads ORDER BY created_at DESC LIMIT 1"
      );
      return rows[0] || null;
    } catch(e) {
      console.log(e);
      throw e;
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
        agreed TINYINT(1) DEFAULT 0,
        last_key_at DATETIME DEFAULT NULL;
        is_reminded TINYINT(1) DEFAULT 0;
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
      CREATE TABLE IF NOT EXISTS ads (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        admin_chat_id BIGINT NOT NULL,
        message_id BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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