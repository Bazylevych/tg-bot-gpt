import { unlink } from "fs/promises";

//* функция удаления файла принимающая путь
export async function removePath(path) {
  try {
    await unlink(path);
  } catch (e) {
    console.log("Error while removing file", e.message);
  }
}
