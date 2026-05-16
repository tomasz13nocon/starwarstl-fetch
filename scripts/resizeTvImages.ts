import * as fs from "fs/promises";
import sharp from "sharp";

const dir = "../client/public/img/tv-images/";
const filesRaw = await fs.readdir(dir);
const files: string[] = [];
for (let f of filesRaw) {
  if (!(await fs.stat(dir + f)).isDirectory()) {
    files.push(f);
  }
}
for (let f of files) {
  await sharp(dir + f).webp({ nearLossless: true }).resize(null, 32).toFile(`${dir}thumb/${f}`);
}
