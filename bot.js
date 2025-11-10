const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const api = require('./api/api.js');
const pool = require('./api/db.js');
require("dotenv").config();

const bot = new Telegraf(process.env.token);

// ========== Команда рассылки (только админ) ==========
const ADMIN_ID = parseInt(process.env.ADMIN_ID, 10);
const DEVELOPER_ID = parseInt(process.env.DEVELOPER_ID, 10);

bot.start(async (ctx) => {
  await pool.saveUser(ctx);
  await ctx.reply(
    "👋 Привет, @" +
      ctx.from.username +
      "! \n" +
      "Я помогаю скачать видео без водяного знака и в хорошем качестве из TikTok, Instagram, YouTube Shorts и Pinterest. \n \n" +
      "<i>Присылай ссылку на ролик и через мгновение получишь видео без водяного знака.</i> \n \n" +
      "Если возникла техническая ошибка, пиши сюда — @AliBabagg. \n" +
      "<b>Исправим как можно скорее! 🔧</b> \n",
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📘 Инструкция', 'how_to_use')]
      ])
    },
  );

  await ctx.reply(
    'Вы можете в любой момент открыть меню:',
    Markup.keyboard([
      ['📘 Инструкция']
    ])
    .resize() // чтобы кнопка подстроилась под экран
    .oneTime(false) // чтобы не пропадала после нажатия
  );
});

bot.hears('📘 Инструкция',  async (ctx) => {
  await pool.saveUser(ctx);
  const instruction = `📘 <b>Как пользоваться ботом:</b>

1️⃣ Найди видео в TikTok, Instagram, YouTube Shorts или Pinterest.  
2️⃣ Скопируй ссылку на видео.  
3️⃣ Отправь ссылку сюда, в чат со мной.  
4️⃣ Через несколько секунд получишь файл без водяного знака! 🎉  

❗Если видео слишком большое или не загружается — попробуй позже или напиши в поддержку.`;

  await ctx.reply(instruction, { parse_mode: 'HTML',  });
});

bot.action('how_to_use', async (ctx) => {
  await pool.saveUser(ctx);
  await ctx.answerCbQuery();

  const instruction = `📘 <b>Как пользоваться ботом:</b>

1️⃣ Найди видео в TikTok, Instagram, YouTube Shorts или Pinterest.  
2️⃣ Скопируй ссылку на видео.  
3️⃣ Отправь ссылку сюда, в чат со мной.  
4️⃣ Через несколько секунд получишь файл без водяного знака! 🎉  

❗Если видео слишком большое или не загружается — попробуй позже или напиши в поддержку.`;

  await ctx.reply(instruction, { parse_mode: 'HTML',  });
});

// Храним состояние, ждём сообщение для рассылки
let waitingForBroadcast = false;

// Команда для старта рассылки
bot.command('broadcast', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID && ctx.from.id !== DEVELOPER_ID) return;
  waitingForBroadcast = true;
  await ctx.reply('📣 Отправь сообщение, которое нужно разослать (может быть текст, фото, видео, документ, сообщение с кнопками).');
});


bot.on("text", async (ctx) => {
  if ((ctx.from.id == ADMIN_ID || ctx.from.id == DEVELOPER_ID) && waitingForBroadcast) {
    waitingForBroadcast = false;

    broadcastInBackground(ctx);
    return;
  }
  await ctx.reply("I've got it");
});

// При получении любого сообщения проверяем, ждёт ли админ рассылку
bot.on('message', async (ctx) => {
  if ((ctx.from.id == ADMIN_ID || ctx.from.id == DEVELOPER_ID) && waitingForBroadcast) {
    waitingForBroadcast = false;

    broadcastInBackground(ctx);
  }
});

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
            await pool.deleteChat(chat.chat_id);
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

bot.launch().catch(() => waitingForBroadcast = false);
