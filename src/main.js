import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import { code } from "telegraf/format";
import config from "config";
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";
import { removePath } from "./utils.js";
import { textConverter } from "./google.js";

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

//* создаем обьект bot через конструктор telegraf
const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

//* установка сессий
bot.use(session());

bot.telegram.setMyCommands([
  {
    command: "start",
    description: "Start bot",
  },
  {
    command: "new",
    description: "Create new session (new context)",
  },
  {
    command: "list",
    description: "List command",
  },
]);

//* обрабатываем команду new
bot.command("new", async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply("Im wait your voice or text message...");
});

//* обрабатываем команду start
bot.command("start", async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply(
    "Hi, I am a chat gpt bot that can understand both text and voice messages.\n \nPrint /list for watching command list. \n \nSend a text or voice message to get started."
  );
});

bot.command("list", async (ctx) => {
  await ctx.reply(
    "Command list: \n /start - start bot \n /new - start new dialog with bot \n /clear - clear chat \n /list - command list"
  );
});

//* обрабатываем голосовое сообщение используя фильтр message()
bot.on(message("voice"), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;

  //* Проверяем не превышен ли лимит
  if (requestCount >= requestLimit) {
    await ctx.reply(
      "Превышен лимит сообщений в минуту (3). Повторите свой запрос позже..."
    );

    return;
  }

  try {
    await ctx.reply(code("...")); //* сигнал о том что идет процесс обработки ответа
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id); //* получаем ссылку на файл
    const userId = String(ctx.message.from.id); //* получаем user id
    const oggPath = await ogg.create(link.href, userId); //* получаем файл
    const mp3Path = await ogg.toMp3(oggPath, userId); //* конвертируем файл в mp3

    const text = await openai.transcription(mp3Path); //* конвертируем голос в текст
    removePath(mp3Path); //* удаляем файл mp3

    await ctx.reply(code(`Your request: ${text}`)); //* даем пользователю в ответ транскипцию его голосового сообщения

    ctx.session.messages.push({ role: openai.roles.USER, content: text }); //* добавляем в сессию сообщение

    const response = await openai.chat(ctx.session.messages); //* получаем ответ от чата gpt

    //* добавляем сообщение чата в сессию
    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    const audio = await textConverter.textToSpeech(response.content);

    await ctx.sendVoice(
      { source: audio },
      { title: "Response Assistent", performer: "ChatGPT" }
    );
    //await ctx.reply(response.content);//* отправляем пользователю ответ чата

    //* итерируем запрос
    requestCount++;
    //* если таймер закончился запускаем его по новой
    if (!requestTimer) {
      requestTimer = setTimeout(() => {
        requestCount = 0;
        requestTimer = null;
      }, requestInterval);
    }
  } catch (e) {
    console.log("Error while voice message", e.message);
    await ctx.reply(code(`Error while voice message: ${e.message}`));
  }
});

//* обрабатываем текстовое сообщение используя фильтр message()
bot.on(message("text"), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;

  //* Проверяем не превышен ли лимит
  if (requestCount >= requestLimit) {
    await ctx.reply(
      "Превышен лимит сообщений в минуту (3). Повторите свой запрос позже..."
    );

    return;
  }

  try {
    await ctx.reply(code("...")); //* сигнал о том что идет процесс обработки ответа

    //* добавляем в сессию сообщение
    ctx.session.messages.push({
      role: openai.roles.USER,
      content: ctx.message.text,
    });

    const response = await openai.chat(ctx.session.messages); //* получаем ответ от чата gpt

    //* добавляем сообщение чата в сессию
    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    const audio = await textConverter.textToSpeech(response.content);

    await ctx.sendAudio(
      { source: audio },
      { title: "Response Assistent", performer: "ChatGPT" }
    );
    // await ctx.reply(response.content); //* отправляем пользователю ответ чата

    //* итерируем запрос
    requestCount++;
    //* если таймер закончился запускаем его по новой
    if (!requestTimer) {
      requestTimer = setTimeout(() => {
        requestCount = 0;
        requestTimer = null;
      }, requestInterval);
    }
  } catch (e) {
    console.log("Error while text message", e.message);
    await ctx.reply(code(`Error while text message: ${e.message}`));
  }
});

//* запуск бота
bot.launch();

//* в случае отвала nodejs останавливаем бота
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
