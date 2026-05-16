import fs from "fs/promises";
import sharp from "sharp";
import { fileExists, log } from "../util.ts";
import { Size, IMAGE_PATH } from "../const.ts";
import type { ImageSize, ImageStorage } from "../types/index.ts";

export class FsImage implements ImageStorage {
  filename: string;
  existsCache: Partial<Record<ImageSize, boolean>>;

  constructor(filename: string) {
    this.filename = filename;
    this.existsCache = {};
  }

  /** Returns true if any size variant is missing */
  async anyMissing(): Promise<boolean> {
    let exists: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(Size)) {
      exists[key] = await this.exists(value);
    }
    return Object.values(exists).some((e) => !e);
  }

  async exists(size: ImageSize = Size.FULL): Promise<boolean> {
    if (this.existsCache[size] !== undefined) {
      return this.existsCache[size];
    }
    this.existsCache[size] = await fileExists(`${IMAGE_PATH}${size}${this.filename}`);
    return this.existsCache[size];
  }

  async read(size: ImageSize = Size.FULL): Promise<Buffer> {
    return await fs.readFile(`${IMAGE_PATH}${size}${this.filename}`);
  }

  async write(buffer: Buffer, size: ImageSize = Size.FULL): Promise<void> {
    await fs.writeFile(`${IMAGE_PATH}${size}${this.filename}`, buffer);
  }

  async writeVariantsIfMissing(buffer: Buffer): Promise<void> {
    let resized = "";
    if (!(await this.exists(Size.MEDIUM))) {
      await sharp(buffer)
        .resize(500, null, { withoutEnlargement: true })
        .toFile(`${IMAGE_PATH}${Size.MEDIUM}${this.filename}`);
      resized += "medium, ";
    }
    if (!(await this.exists(Size.SMALL))) {
      await sharp(buffer)
        .resize(220, null, { withoutEnlargement: true })
        .toFile(`${IMAGE_PATH}${Size.SMALL}${this.filename}`);
      resized += "small, ";
    }
    if (!(await this.exists(Size.THUMB))) {
      await sharp(buffer)
        .resize(55, null, { withoutEnlargement: true })
        .toFile(`${IMAGE_PATH}${Size.THUMB}${this.filename}`);
      resized += "thumb, ";
    }
    if (resized) {
      log.info(`Resized ${this.filename} to ${resized.slice(0, -2)}`);
    }
  }

  /** If size is undefined delete all sizes. */
  async delete(size?: ImageSize): Promise<void> {
    if (size === undefined) {
      for (const s of Object.values(Size)) {
        await this.#deleteHelper(s);
      }
    } else {
      await this.#deleteHelper(size);
    }
  }

  async #deleteHelper(size: ImageSize): Promise<void> {
    try {
      await fs.unlink(`${IMAGE_PATH}${size}${this.filename}`);
    } catch (e) {
      // If it doesn't exist, we're chilling
      if (!(e instanceof Error && "code" in e && e.code === "ENOENT")) {
        throw e;
      }
    }
  }
}
