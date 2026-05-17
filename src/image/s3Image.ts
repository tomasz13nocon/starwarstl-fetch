import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import sharp from "sharp";
import { log } from "../util.ts";
import { Size, S3_IMAGE_PATH, AWS_ACCESS_KEY, AWS_SECRET_KEY, BUCKET } from "../const.ts";
import netLog from "../netLog.ts";
import type { ImageSize, ImageStorage } from "../types/index.ts";
// import "./env.js"; // TODO confirm not needed

const s3client = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId: AWS_ACCESS_KEY ?? "", secretAccessKey: AWS_SECRET_KEY ?? "" },
});

export class S3Image implements ImageStorage {
  static #existsCache: Partial<Record<ImageSize, Record<string, boolean>>> = {};
  filename: string;

  constructor(filename: string) {
    this.filename = filename;
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
    if (S3Image.#existsCache[size] !== undefined) {
      return S3Image.#existsCache[size][this.filename] ?? false;
    }

    let truncated = true;
    let continuationToken: string | undefined;
    S3Image.#existsCache[size] = {};
    while (truncated) {
      const response = await s3client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: `${S3_IMAGE_PATH}${size}`,
          ContinuationToken: continuationToken,
        }),
      );
      netLog.s3read++;

      for (let item of response.Contents ?? []) {
        const key = item.Key?.split("/").pop();
        if (key) S3Image.#existsCache[size][key] = true;
      }

      truncated = response.IsTruncated ?? false;
      if (truncated) {
        continuationToken = response.NextContinuationToken;
      }
    }
    return S3Image.#existsCache[size]?.[this.filename] ?? false;
  }

  async read(size: ImageSize = Size.FULL): Promise<Buffer> {
    let data = (
      await s3client.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: `${S3_IMAGE_PATH}${size}${this.filename}`,
        }),
      )
    ).Body;
    netLog.s3read++;
    if (!data || !("on" in data))
      throw new Error(`S3 object body is not readable: ${this.filename}`);
    const stream = data as Readable;
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.once("end", () => resolve(Buffer.concat(chunks)));
      stream.once("error", reject);
    });
  }

  async write(buffer: Buffer, size: ImageSize = Size.FULL): Promise<void> {
    await s3client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${S3_IMAGE_PATH}${size}${this.filename}`,
        Body: buffer,
        ContentType: "image/webp",
      }),
    );
    netLog.s3write++;
    log.info(`Wrote ${this.filename} at size ${size} to S3.`);
  }

  async writeVariantsIfMissing(buffer: Buffer): Promise<void> {
    let b: Buffer;
    let resized = "";
    if (!(await this.exists(Size.MEDIUM))) {
      b = await sharp(buffer).resize(500, null, { withoutEnlargement: true }).toBuffer();
      await this.write(b, Size.MEDIUM);
      resized += "medium, ";
    }
    if (!(await this.exists(Size.SMALL))) {
      b = await sharp(buffer).resize(220, null, { withoutEnlargement: true }).toBuffer();
      await this.write(b, Size.SMALL);
      resized += "small, ";
    }
    if (!(await this.exists(Size.THUMB))) {
      b = await sharp(buffer).resize(55, null, { withoutEnlargement: true }).toBuffer();
      await this.write(b, Size.THUMB);
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
    await s3client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: `${S3_IMAGE_PATH}${size}${this.filename}`,
      }),
    );
    netLog.s3write++;
    log.info(`Deleted ${this.filename} at size ${size} from S3.`);
  }
}
