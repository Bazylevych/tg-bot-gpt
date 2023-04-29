import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import installer from "@ffmpeg-installer/ffmpeg";
import { createWriteStream } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { removePath } from "./utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); //* определяем текущую папку

class OggConverter {
  constructor() {
    ffmpeg.setFfmpegPath(installer.path);
  }

  //* метод конвертирует ogg в mp3
  toMp3(input, output) {
    try {
      const outputPath = resolve(dirname(input), `${output}.mp3`); //* получаю путь к файлу который буду конвертировать
      return new Promise((resolve, reject) => {
        //*  процесс конвертации, сохранения нового файла и удаление старого
        ffmpeg(input)
          .inputOption("-t 30")
          .output(outputPath)
          .on("end", () => {
            removePath(input);
            resolve(outputPath);
          })
          .on("error", (err) => reject(err.message))
          .run();
      });
    } catch (e) {
      console.log("Error while creating mp3", e.message);
    }
  }

  //* метод скачивает и сохраняет файл
  async create(url, filename) {
    try {
      const oggPath = resolve(__dirname, "../voices", `${filename}.ogg`); //* определяем путь к файлу .ogg

      //* скачиваем файл
      const response = await axios({
        method: "get",
        url,
        responseType: "stream",
      });

      return new Promise((resolve) => {
        const stream = createWriteStream(oggPath);
        response.data.pipe(stream);
        stream.on("finish", () => resolve(oggPath));
      });
    } catch (e) {
      console.log("Error while creating ogg", e.message);
    }
  }
}

export const ogg = new OggConverter(); //* експортируем екземпляр класса
