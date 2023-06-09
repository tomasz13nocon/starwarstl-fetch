import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { log } from "../util.js";
import { Size, S3_IMAGE_PATH, AWS_ACCESS_KEY, AWS_SECRET_KEY, BUCKET } from "../const.js";
import netLog from "../netLog.js";
// import "./env.js"; // TODO confirm not needed

const s3client = new S3Client({
  region: "us-east-1",
  credentials: { accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY },
});

export class S3Image {
  static #existsCache = {};

  constructor(filename) {
    this.filename = filename;
  }

  /** Returns true if any size variant is missing */
  async anyMissing() {
    let exists = {};
    for (const [key, value] of Object.entries(Size)) {
      exists[key] = await this.exists(value);
    }
    return Object.values(exists).some((e) => !e);
  }

  async exists(size = Size.FULL) {
    if (S3Image.#existsCache[size] !== undefined) {
      return S3Image.#existsCache[size][this.filename];
    }

    let truncated = true;
    let continuationToken;
    S3Image.#existsCache[size] = {};
    while (truncated) {
      const response = await s3client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: `${S3_IMAGE_PATH}${size}`,
          ContinuationToken: continuationToken,
        })
      );
      netLog.s3read++;

      for (let item of response.Contents) {
        S3Image.#existsCache[size][item.Key.split("/").pop()] = true;
      }

      truncated = response.IsTruncated;
      if (truncated) {
        continuationToken = response.NextContinuationToken;
      }
    }
  }

  async read(size = Size.FULL) {
    let data = (
      await s3client.send(
        new GetObjectCommand({
          Bucket: BUCKET,
          Key: `${S3_IMAGE_PATH}${size}${this.filename}`,
        })
      )
    ).Body;
    netLog.s3read++;
    return new Promise((resolve, reject) => {
      const chunks = [];
      data.on("data", (chunk) => chunks.push(chunk));
      data.once("end", () => resolve(Buffer.concat(chunks)));
      data.once("error", reject);
    });
  }

  async write(buffer, size = Size.FULL) {
    await s3client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${S3_IMAGE_PATH}${size}${this.filename}`,
        Body: buffer,
        ContentType: "image/webp",
      })
    );
    netLog.s3write++;
    log.info(`Wrote ${this.filename} at size ${size} to S3.`);
  }

  async writeVariantsIfMissing(buffer) {
    let b;
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
  async delete(size) {
    if (size === undefined) {
      for (const s of Object.values(Size)) {
        await this.#deleteHelper(s);
      }
    } else {
      await this.#deleteHelper(size);
    }
  }

  async #deleteHelper(size) {
    await s3client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: `${S3_IMAGE_PATH}${size}${this.filename}`,
      })
    );
    netLog.s3write++;
    log.info(`Deleted ${this.filename} at size ${size} from S3.`);
  }
}
