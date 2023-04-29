import { Configuration, OpenAIApi } from "openai";
import config from "config";
import { createReadStream } from "fs";

class OpenAI {
  //* обьект ролей
  roles = {
    ASSISTANT: "assistant",
    USER: "user",
    SYSTEM: "system",
  };

  //* подключение к openAI API
  constructor(apiKey) {
    //* настройка конфигурации
    const configuration = new Configuration({
      apiKey,
    });
    //* определение екземпляра openai
    this.openai = new OpenAIApi(configuration);
  }

  //* метод для общения с чатом
  async chat(messages) {
    try {
      //* отправка сообщения чату и получение ответа
      const response = await this.openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages,
      });

      return response.data.choices[0].message;
    } catch (e) {
      console.log("Error while wait response chat", e.message);
    }
  }

  //* метод для транскрипции звука в текст
  async transcription(filepath) {
    try {
      //* отправка файла и получение текста
      const response = await this.openai.createTranscription(
        createReadStream(filepath),
        "whisper-1"
      );

      return response.data.text;
    } catch (e) {
      console.log("Error while transcription text", e.message);
    }
  }
}

//* експортирование екземпляра класса с передачей в него API KEY
export const openai = new OpenAI(config.get("OPENAI_KEY"));
