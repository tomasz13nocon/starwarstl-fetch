import process from "node:process";
import { S3Image } from "./image/s3Image.js";
import { FsImage } from "./image/fsImage.js";
import { log } from "./util.js";
import { MW_API_USER_AGENT, AWS_ACCESS_KEY, AWS_SECRET_KEY } from "./const.js";

export const debug = {
  // Write a list of distinct infobox templates to file
  distinctInfoboxes: false,
  // Warn on redlinks
  redlinks: false,
  // log normalizations of article titles
  normalizations: true,
  // log normalizations of image filenames
  normalizationsImages: false,
  // saves timeline wikitext to file
  saveTimeline: true,
};

const requiredEnv = [MW_API_USER_AGENT, AWS_ACCESS_KEY, AWS_SECRET_KEY];

// Process env vars and command line args
export default function () {
  for (let env of requiredEnv) {
    if (env === undefined) {
      log.error(
        Object.keys({ env })[0],
        " environment variable must be defined. Aborting."
      );
      process.exit(1);
    }
  }

  let CACHE_PAGES = false;
  let LIMIT;
  let Image = FsImage;
  if (process.env.IMAGE_HOST === "filesystem") {
    Image = FsImage;
  } else if (process.env.IMAGE_HOST === "s3") {
    Image = S3Image;
  }

  // Command line args
  for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i];

    if (arg === "--cache" || arg === "-c") {
      CACHE_PAGES = true;
    } else if (arg === "--limit" || arg === "-l") {
      i++;
      let value = +process.argv[i];
      if (i >= process.argv.length || !Number.isInteger(value) || value < 1) {
        log.error(`option ${arg} requires a positive integer value`);
        process.exit(1);
      }
      LIMIT = value;
    } else if (arg === "--fs") {
      Image = FsImage;
    } else if (arg === "--s3") {
      Image = S3Image;
    } else {
      log.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  if (Image === S3Image) {
    log.info("Using S3 as image host");
  } else if (Image === FsImage) {
    log.info("Using filesystem as image host");
  }

  return { Image, CACHE_PAGES, LIMIT };
}
