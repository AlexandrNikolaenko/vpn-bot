const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const vpnapi = require('./api/vpnapi.js');
const pool = require('./api/db.js');
require("dotenv").config();

const bot = new Telegraf(process.env.token);

// ========== Команда рассылки (только админ) ==========
const ADMIN_ID = parseInt(process.env.ADMIN_ID, 10);
const DEVELOPER_ID = parseInt(process.env.DEVELOPER_ID, 10);

async function sendKeyReminders() {
  try {
    // Берём всех пользователей с выданным ключом, которые ещё не получили напоминание
    const [users] = await pool.pool.query(
      `SELECT id, chat_id, last_key_at, is_reminded 
       FROM users 
       WHERE last_key_at IS NOT NULL AND is_reminded = 0`
    );

    const now = new Date();

    for (const user of users) {
      const lastKey = new Date(user.last_key_at);
      const reminderDate = new Date(lastKey.getTime() + 5 * 1000 * 60 * 60 * 24); // через 5 дней

      if (now >= reminderDate) {
        try {
          await bot.telegram.sendMessage(
            user.chat_id,
            "⚠ Ваш VPN ключ скоро истечёт! Через 2 дня его нужно будет обновить."
          );

          // помечаем, что уведомление отправлено
          await pool.pool.query(
            `UPDATE users SET is_reminded = 1 WHERE id = ?`,
            [user.id]
          );

          console.log(`Напоминание отправлено пользователю ${user.chat_id}`);
        } catch (e) {
          console.error("Ошибка отправки напоминания:", e);
        }
      }
    }
  } catch (e) {
    console.error("Ошибка при проверке пользователей для напоминаний:", e);
  }
}

// проверка каждый час
setInterval(sendKeyReminders, 60 * 60 * 1000);

async function broadcastInBackground(ctx) {
  try {
    const [chats] = await pool.getAllChats();
    let sent = 0, removed = 0, failed = 0;

    // не блокируем event loop
    setImmediate(async () => {
      for (const chat of chats) {
        try {
          const msg = await ctx.telegram.copyMessage(
            chat.chat_id,
            ctx.chat.id,
            ctx.message.message_id
          );
          sent++;

          setTimeout(async () => {
            try {
              await ctx.telegram.deleteMessage(chat.chat_id, msg.message_id);
              console.log(`🗑️ Удалено сообщение у ${chat.chat_id}`);
            } catch (err) {
              // 400 — сообщение уже удалено или истёк срок хранения
              if (err.response?.error_code !== 400) {
                console.log(`⚠️ Ошибка удаления у ${chat.chat_id}: ${err.message}`);
              }
            }
          }, 24 * 60 * 60 * 1000);
        } catch (err) {
          if (err.response?.error_code === 403) {
            removed++;
            const uuid = await pool.deleteChat(chat.chat_id);
            await vpnapi.deleteUser(uuid);
            console.log('user deleted: '+chat.chat_id);
          } else {
            console.log(err);
            failed++;
          }
        }

        // немного спим, чтобы избежать flood limit
        await new Promise(r => setTimeout(r, 100));
      }

      await ctx.telegram.sendMessage(
        ctx.chat.id,
        `✅ Рассылка завершена.\n\n📨 Успешно: ${sent}\n🚫 Удалено: ${removed}\n⚠️ Ошибок: ${failed}`
      );
    });
  } catch (err) {
    console.error("Ошибка при рассылке:", err);
    await ctx.reply("⚠️ Ошибка при запуске рассылки.");
  }
}

async function showAd(ctx) {
  // Получаем последнее рекламное сообщение
    const ad = await pool.getLastAd();

    if (!ad) {
      await ctx.reply("❗Реклама не найдена. Обратитесь к администратору.");
      return;
    }

    // await ctx.telegram.forwardMessage(
    //   ctx.chat.id,        // куда пересылать
    //   ad.admin_chat_id,   // источник (админский чат)
    //   ad.message_id       // id рекламного сообщения
    // );

    await ctx.telegram.copyMessage(
      ctx.chat.id,        // куда пересылать
      ad.admin_chat_id,   // источник (админский чат)
      ad.message_id       // id рекламного сообщения
    );

    // Ждём 10 секунд
    await new Promise(res => setTimeout(res, 10000));
    return;
}

async function checkAgree(ctx) {
  const user = await pool.getUserById(ctx.from.id);
  return Boolean(user.agreed);
}

async function updateUrl(ctx) {
  await pool.saveUser(ctx);

  try {
    if (!(await checkAgree(ctx))) {
      return ctx.reply("Сначала подтвердите согласие с документами сервиса.");
    }

    const url = await pool.getKey(ctx.from.id);

    await showAd(ctx);

    const user = await vpnapi.addUser(ctx.from.id);
    
    if (user.success) {
      if (url.status == 'empty') {
        await pool.addKey({userId: ctx.from.id, ...user});
  
        await ctx.reply('Ваш URL: \n\n<pre>' + user.url + '</pre>',{ parse_mode: 'HTML',
          ...Markup.keyboard([
            ['🔄 Получить новый ключ'],
            ['📱 Android', '🍏 iOS'],
            ['💻 MacOS', '🖥 Windows']
          ])
          .resize()
          .oneTime(false)});

      } else {
        const uuid = await pool.updateKey({userId: ctx.from.id, ...user});

        await ctx.reply('Ваш новый URL: \n\n<pre>' + user.url + '</pre>',{ parse_mode: 'HTML',  });

        await vpnapi.deleteUser(uuid);
      }
    } else {
      throw new Error('Не удалось добавить пользователя')
    }
  } catch(e) {
    console.error(e);
    await ctx.reply('К сожалению не получилось создать новый ключ:( \nПопробуйте позже или обратитесь в поддержку')
  }
}

async function createUrl(ctx) {
  await pool.saveUser(ctx);

  try {
    if (!(await checkAgree(ctx))) {
      return ctx.reply("Сначала подтвердите согласие с документами сервиса.");
    }

    await showAd(ctx);
    
    const url = await pool.getKey(ctx.from.id);
    if (url.status == 'empty') {
      const user = await vpnapi.addUser(ctx.from.id);
  
      if (user.success) {
        await pool.addKey({userId: ctx.from.id, ...user});
  
        await ctx.reply('Ваш URL: \n\n<pre>' + user.url + '</pre>',{ parse_mode: 'HTML',
          ...Markup.keyboard([
            ['🔄 Получить новый ключ'],
            ['📱 Android', '🍏 iOS'],
            ['💻 MacOS', '🖥 Windows']
          ])
          .resize()
          .oneTime(false)});
      } else {
        throw new Error('Не удалось добавить пользователя')
      }
    } else {
      await ctx.reply('У вас уже есть URL.\nВаш URL: \n\n<pre>' + url.url + '</pre>',{ parse_mode: 'HTML', ...Markup.keyboard([
            ['🔄 Получить новый ключ'],
            ['📱 Android', '🍏 iOS'],
            ['💻 MacOS', '🖥 Windows']
          ])
          .resize()
          .oneTime(false)});
    }
  } catch(e) {
    console.error(e);
    await ctx.reply('К сожалению не получилось создать новый ключ:( \nПопробуйте позже или обратитесь в поддержку')
  }
}

bot.start(async (ctx) => {
  await pool.saveUser(ctx);
  await ctx.reply(
    `👋 Привет, это VPN +Vibe!

Здесь ты ловишь 🔑 бесплатные ключи для доступа к свободному интернету — без регистрации, смс и боли.

✨ Что умеет бот:
• ⚡ Выдать свежий VPN-ключ в пару тапов  
• 📘 Подсказать, как подключиться  
• ⏰ Напомнить, когда ключ пора обновить  

Жми «Получить ключ» и полетели 🚀`,
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔑 Получить ключ', 'get_key')]
      ])
    },
  );
});

bot.action('get_key', async (ctx) => {
  try {
    await pool.saveUser(ctx);
  
    await ctx.answerCbQuery();
  
      const user = await pool.getUserById(ctx.from.id);
  
      // Если пользователь уже соглашался — пропустить этот шаг
      if (user.agreed) {
          ctx.reply("👍 Ты уже согласился с условиями. Сейчас отправлю ключ...", { parse_mode: 'HTML',
          ...Markup.keyboard([
            ['🔄 Получить новый ключ'],
            ['📱 Android', '🍏 iOS'],
            ['💻 MacOS', '🖥 Windows']
          ])
          .resize()
          .oneTime(false)});
          
          await showAd(ctx);
          
          await updateUrl(ctx);
          return;
      }
  
      // Если НЕ согласился — отправляем экран согласия
      await ctx.reply(
  `📄 Перед тем как выдать тебе ключ, нужно чуть-чуть формальностей.

Чтобы всё было честно и прозрачно, подтверди, что ты согласен(на) с документами сервиса:

📰 Политика конфиденциальности  
https://telegra.ph/Politika-konfidencialnosti-08-15-17

📑 Пользовательское соглашение  
https://telegra.ph/Polzovatelskoe-soglashenie-08-15-10

Нажимая кнопку «Даю согласие», ты подтверждаешь, что прочитал(а) и принимаешь условия ✔️`,
          {
              parse_mode: "HTML",
              reply_markup: {
                  inline_keyboard: [
                      [{ text: 'Даю согласие', callback_data: 'agree' }]
                  ]
              }
          }
      );
  } catch (e) {
    console.log(e);
    await ctx.reply('Произошла ошибка');  
  }
});

bot.action('agree', async (ctx) => {
    await ctx.answerCbQuery();

    // отмечаем согласие в БД
    try {
      await pool.setAgreeUser(ctx);

      await ctx.reply(
          `🎉 Круто, согласие принято — двигаем дальше!

+Vibe VPN бесплатный, и чтобы так и оставалось, нужно всего одно маленькое действие с твоей стороны.

Посмотри короткий рекламный пост ниже — это помогает держать сервис живым и бесплатным для всех ❤️

⏳ Через 10 секунд после просмотра ты автоматически получишь свой ключ доступа.

Когда будешь готов(а), жми кнопку 👇
`,
        {
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: ' Смотреть рекламу и получить ключ', callback_data: 'get_url' }]
                ]
            }
        }
      );
    } catch(e) {
      console.log(e);
      await ctx.reply(
          "К сожалению не получилось подтвердить ваше согласие:(\n Побробуйте позже или обратитесь в поддержку"
      );
    }
});

bot.action('get_url', async (ctx) => {
  await createUrl(ctx);
})

bot.action('update_url', async (ctx) => {
  await updateUrl(ctx);
})

// Храним состояние, ждём сообщение для рассылки
let waitingForBroadcast = false;

// Команда для старта рассылки
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID && ctx.from.id !== DEVELOPER_ID) return;
  waitingForBroadcast = true;
  await ctx.reply('📣 Отправь сообщение, которое нужно разослать (может быть текст, фото, видео, документ, сообщение с кнопками).');
});

// При получении любого сообщения проверяем, ждёт ли админ рассылку
bot.on('message', async (ctx) => {
  if ((ctx.from.id == ADMIN_ID || ctx.from.id == DEVELOPER_ID) && waitingForBroadcast) {
    waitingForBroadcast = false;

    // сохраняем рекламное сообщение в БД (новое!)
    await pool.saveAd(ctx.chat.id, ctx.message.message_id);
    
    broadcastInBackground(ctx);
    return;
  }
  
  const text = ctx.message.text;

  switch (text) {
    case '🔄 Получить новый ключ':
      // вызываем логику выдачи ключа
      await updateUrl(ctx)
      break;

    case '📱 Android':
      await ctx.reply('📱 Инструкция для Android: https://zentrolamia.xyz/docs/instructions/v2raytun/');
      break;

    case '🍏 IOS':
      await ctx.reply('🍏 Инструкция для iOS: https://apps.apple.com/lt/app/v2raytun/id6476628951');
      break;

    case '💻 MacOS':
      await ctx.reply('💻 Инструкция для MacOS: https://apps.apple.com/lt/app/v2raytun/id6476628951');
      break;

    case '🖥 Windows':
      await ctx.reply('🖥 Инструкция для Windows: https://storage.v2raytun.com/v2RayTun_Setup.exe');
      break;

    default:
      await ctx.reply("Я не понимаю эту команду.");
      break;
  }
});

bot.launch().catch(() => waitingForBroadcast = false);
