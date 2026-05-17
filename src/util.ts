import fs from "fs/promises";
import logWithStatusbar from "log-with-statusbar";
import { TV_IMAGE_PATH } from "./const.ts";

export interface Logger {
  setStatusBarText(text: string[]): void;
  log(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

const isNodeError = (error: unknown): error is NodeJS.ErrnoException => error instanceof Error;

export const buildTvImagePath = (seriesTitle: string): string =>
  TV_IMAGE_PATH + seriesTitle.replaceAll(" ", "_") + ".webp";

export async function fileExists(filename: string): Promise<boolean> {
  try {
    await fs.stat(filename);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
  return true;
}

export const toCamelCase = (str: string): string => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
};

export const toHumanReadable = (n: number): string | undefined => {
  if (n < 1000) return `${n} B`;
  else if (n < 1000000) return `${n / 1000} KB`;
  else if (n < 1000000000) return `${n / 1000000} MB`;
  else if (n < 1000000000000) return `${n / 1000000000} GB`;
};

export const log: Logger = process.stdout.isTTY
  ? logWithStatusbar()
  : {
    setStatusBarText: () => { },
    log: (...args) => console.log(...args),
    info: (...args) => console.info("INFO: ", ...args),
    warn: (...args) => console.warn("WARN: ", ...args),
    error: (...args) => console.error("ERROR: ", ...args),
  };

if (process.stdout.isTTY) {
  log.setStatusBarText([""]);
}

// For dates in format yyyy-mm-dd that lack a month or day, or have question marks in their place
// return the latest possible date e.g. 2022-??-?? => 2022-12-31
export const unscuffDate = (date: string | undefined): string | undefined => {
  if (!date) return date;
  date = date.replaceAll("–", "-"); // endash
  if (/^\d{4}[-?xX]*$/.test(date)) {
    return `${date.slice(0, 4)}-12-31`;
  }
  if (/^\d{4}-\d{2}[-?xX]*$/.test(date)) {
    const d = new Date(parseInt(date.slice(0, 4)), parseInt(date.slice(5, 7)), 0);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;
  }
  return date;
};
