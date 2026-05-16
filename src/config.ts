import process from "node:process";
import fs from "node:fs";
import { Command, CommanderError, InvalidArgumentError } from "commander";
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

type CliOptions = {
  cache?: boolean;
  limit?: number;
  fs?: boolean;
  s3?: boolean;
  legends?: boolean;
  local?: boolean;
  offline?: boolean;
};

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError("must be a positive integer");
  }
  return parsed;
}

export function parseCliArgs(argv = process.argv): CliOptions {
  const program = new Command()
    .name("fetch")
    .description("Fetch and transform Star Wars timeline data from Wookieepedia")
    .allowExcessArguments(false)
    .option("-c, --cache", "cache Wookieepedia page requests")
    .option("-l, --limit <count>", "process only the first <count> timeline rows", parsePositiveInteger)
    .option("--fs", "store images on the local filesystem")
    .option("--s3", "store images in S3")
    .option("--legends", "use the legends timeline and fixtures")
    .option("--local", "read Wookieepedia data from local fixtures")
    .option("--offline", "alias for --local");

  program.exitOverride();
  program.parse(argv);
  return program.opts<CliOptions>();
}

// Process env vars and command line args on the first invocation
// Returns config object
export default function getConfig(): Config {
  if (initialized) return config;

  let cli: CliOptions;
  try {
    cli = parseCliArgs();
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exit(error.exitCode);
    }
    throw error;
  }

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

  if (cli.cache) config.CACHE_PAGES = true;
  if (cli.limit !== undefined) config.LIMIT = cli.limit;
  if (cli.fs) config.Image = FsImage;
  if (cli.s3) config.Image = S3Image;
  if (cli.legends) config.LEGENDS = true;
  if (cli.local || cli.offline) config.LOCAL = true;

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
