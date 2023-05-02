import process from "node:process";
import fs from "node:fs";
import { S3Image } from "./image/s3Image.js";
import { FsImage } from "./image/fsImage.js";
import { log } from "./util.js";
import { MW_API_USER_AGENT, AWS_ACCESS_KEY, AWS_SECRET_KEY, IMAGE_PATH, Size } from "./const.js";

export const debug = {
  // Write a list of distinct infobox templates to file
  distinctInfoboxes: false,
  // Warn on redlinks
  redlinks: false,
  // log normalizations of article titles
  normTitles: true,
  // log normalizations of image filenames
  normImages: false,
  // saves timeline wikitext to file
  saveTimeline: true,
  // only process one article
  // article: "Fighter Flight",
};

const requiredEnv = [MW_API_USER_AGENT, AWS_ACCESS_KEY, AWS_SECRET_KEY];

let initialized = false;

const config = {
  CACHE_PAGES: false,
  LIMIT: 0,
  Image: FsImage,
};

// Process env vars and command line args on the first invocation
// Returns config object
export default function () {
  if (initialized) return config;

  for (let env of requiredEnv) {
    if (env === undefined) {
      log.error(Object.keys({ env })[0], " environment variable must be defined. Aborting.");
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
    let arg = process.argv[i];

    if (arg === "--cache" || arg === "-c") {
      config.CACHE_PAGES = true;
    } else if (arg === "--limit" || arg === "-l") {
      i++;
      let value = +process.argv[i];
      if (i >= process.argv.length || !Number.isInteger(value) || value < 1) {
        log.error(`option ${arg} requires a positive integer value`);
        process.exit(1);
      }
      config.LIMIT = value;
    } else if (arg === "--fs") {
      config.Image = FsImage;
    } else if (arg === "--s3") {
      config.Image = S3Image;
    } else {
      log.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
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
