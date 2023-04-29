import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import config from "config";
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";

console.log(config.get("TEST_ENV"));

let requestCount = 0; //* счетчик запросов
let requestTimer = null; //* переменная для установки таймера
const requestLimit = 3; //* лимит запросов
const requestInterval = 60 * 1000; //* интервал лимита запросов (1 минута)

//* инициализируем новую сессию с пустым массивом
const INITIAL_SESSION = {
  messages: [],
};

//! временное хранение ids сообщений для их подальшего удаления
//TODO добавить базу данных
const MESSAGES_IDS = [];

//* создаем обьект bot через конструктор telegraf
const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

//* установка сессий
bot.use(session());

//* обрабатываем команду new
bot.command("new", async (ctx) => {
  MESSAGES_IDS.push(ctx.message.message_id);
  ctx.session = INITIAL_SESSION;
  await ctx
    .reply("Im wait your voice or text message...")
    .then((message) => MESSAGES_IDS.push(message.message_id));
});

//* обрабатываем команду start
bot.command("start", async (ctx) => {
  ctx.session = INITIAL_SESSION;
  MESSAGES_IDS.push(ctx.message.message_id);
  await ctx
    .reply(
      "Hi, I am a chat gpt bot that can understand both text and voice messages.\n \nPrint /list for watching command list. \n \nSend a text or voice message to get started."
    )
    .then((message) => MESSAGES_IDS.push(message.message_id));
  //   await ctx
  //     .reply(JSON.stringify(ctx.message, null, 2))
  //     .then((message) => MESSAGES_IDS.push(message.message_id));
});

bot.command("clear", async (ctx) => {
  MESSAGES_IDS.push(ctx.message.message_id);

  for (let i = 0; i < MESSAGES_IDS.length; i++) {
    await ctx.deleteMessage(MESSAGES_IDS[i]);
  }
});

bot.command("list", async (ctx) => {
  MESSAGES_IDS.push(ctx.message.message_id);

  await ctx
    .reply(
      "Command list: \n /start - start bot \n /new - start new dialog with bot \n /clear - clear chat \n /list - command list"
    )
    .then((message) => MESSAGES_IDS.push(message.message_id));
});

//* обрабатываем голосовое сообщение используя фильтр message()
bot.on(message("voice"), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  MESSAGES_IDS.push(ctx.message.message_id);

  //* Проверяем не превышен ли лимит
  if (requestCount >= requestLimit) {
    await ctx
      .reply(
        "Превышен лимит сообщений в минуту (3). Повторите свой запрос позже..."
      )
      .then((message) => MESSAGES_IDS.push(message.message_id));

    return;
  }

  try {
    await ctx
      .reply(code("..."))
      .then((message) => MESSAGES_IDS.push(message.message_id)); //* сигнал о том что идет процесс обработки ответа
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id); //* получаем ссылку на файл
    const userId = String(ctx.message.from.id); //* получаем user id
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await openai.transcription(mp3Path);
    await ctx
      .reply(code(`Your request: ${text}`))
      .then((message) => MESSAGES_IDS.push(message.message_id));

    ctx.session.messages.push({ role: openai.roles.USER, content: text });

    const response = await openai.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    await ctx
      .reply(response.content)
      .then((message) => MESSAGES_IDS.push(message.message_id));

    requestCount++;
    if (!requestTimer) {
      requestTimer = setTimeout(() => {
        requestCount = 0;
        requestTimer = null;
      }, requestInterval);
    }
  } catch (e) {
    console.log("Error while voice message", e.message);
    await ctx
      .reply(code(`Error while voice message: ${e.message}`))
      .then((message) => MESSAGES_IDS.push(message.message_id));
  }
});

//* обрабатываем текстовое сообщение используя фильтр message()
bot.on(message("text"), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  MESSAGES_IDS.push(ctx.message.message_id);

  if (requestCount >= requestLimit) {
    await ctx
      .reply(
        "Превышен лимит сообщений в минуту (3). Повторите свой запрос позже..."
      )
      .then((message) => MESSAGES_IDS.push(message.message_id));
    return;
  }

  try {
    await ctx
      .reply(code("..."))
      .then((message) => MESSAGES_IDS.push(message.message_id));

    ctx.session.messages.push({
      role: openai.roles.USER,
      content: ctx.message.text,
    });

    const response = await openai.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    await ctx
      .reply(response.content)
      .then((message) => MESSAGES_IDS.push(message.message_id));

    requestCount++;
    if (!requestTimer) {
      requestTimer = setTimeout(() => {
        requestCount = 0;
        requestTimer = null;
      }, requestInterval);
    }
    console.log(MESSAGES_IDS);
  } catch (e) {
    console.log("Error while text message", e.message);
    await ctx
      .reply(code(`Error while text message: ${e.message}`))
      .then((message) => MESSAGES_IDS.push(message.message_id));
  }
});

//* запуск бота
bot.launch();

//* в случае отвала nodejs останавливаем бота
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
