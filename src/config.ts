import process from "node:process";
import fs from "node:fs";
import { S3Image } from "./image/s3Image.ts";
import { FsImage } from "./image/fsImage.ts";
import { log } from "./util.ts";
import { MW_API_USER_AGENT, AWS_ACCESS_KEY, AWS_SECRET_KEY, IMAGE_PATH, Size } from "./const.ts";
import type { Config, DebugConfig } from "./types/config.ts";

export const debug: DebugConfig = {
  // Write a list of distinct infobox templates to file
  distinctInfoboxes: false,
  // Warn on redlinks
  redlinks: false,
  // log normalizations of article titles
  normTitles: true,
  // log normalizations of image filenames
  normImages: false,
  // only process one article
  // article: "Fighter Flight",
};

const requiredEnv = [
  ["MW_API_USER_AGENT", MW_API_USER_AGENT],
  ["AWS_ACCESS_KEY", AWS_ACCESS_KEY],
  ["AWS_SECRET_KEY", AWS_SECRET_KEY],
] as const;

let initialized = false;

const config: Config = {
  CACHE_PAGES: false,
  LIMIT: 0,
  LEGENDS: false,
  LOCAL: false,
  Image: FsImage,
};

// Process env vars and command line args on the first invocation
// Returns config object
export default function getConfig(): Config {
  if (initialized) return config;

  for (const [name, value] of requiredEnv) {
    if (value === undefined) {
      log.error(name, " environment variable must be defined. Aborting.");
      process.exit(1);
    }
  }

  if (process.env.IMAGE_HOST === "filesystem") {
    config.Image = FsImage;
  } else if (process.env.IMAGE_HOST === "s3") {
    config.Image = S3Image;
  }

  // Command line args
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg === "--cache" || arg === "-c") {
      config.CACHE_PAGES = true;
    } else if (arg === "--limit" || arg === "-l") {
      i++;
      const rawValue = process.argv[i];
      const value = Number(rawValue);
      if (i >= process.argv.length || !Number.isInteger(value) || value < 1) {
        log.error(`option ${arg} requires a positive integer value`);
        process.exit(1);
      }
      config.LIMIT = value;
    } else if (arg === "--fs") {
      config.Image = FsImage;
    } else if (arg === "--s3") {
      config.Image = S3Image;
    } else if (arg === "--legends") {
      config.LEGENDS = true;
    } else if (arg === "--local" || arg === "--offline") {
      config.LOCAL = true;
    } else {
      log.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (config.LOCAL) {
    log.info("Using local fixtures (offline mode)");
  }

  if (config.Image === S3Image) {
    log.info("Using S3 as image host");
  } else if (config.Image === FsImage) {
    log.info("Using filesystem as image host");
    for (const value of Object.values(Size)) {
      fs.mkdirSync(`${IMAGE_PATH}${value}`, { recursive: true });
    }
  }

  if (!fs.existsSync("./debug")) {
    fs.mkdirSync("./debug");
  }

  initialized = true;
  return config;
}
