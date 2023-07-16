import fs from "fs/promises";
import logWithStatusbar from "log-with-statusbar";
import { TV_IMAGE_PATH } from "./const.js";

export const buildTvImagePath = (seriesTitle) =>
  TV_IMAGE_PATH + seriesTitle.replaceAll(" ", "_") + ".webp";

export async function fileExists(filename) {
  try {
    await fs.stat(filename);
  } catch (e) {
    if (e.code === "ENOENT") {
      return false;
    }
    throw e;
  }
  return true;
}

export const toCamelCase = (str) => {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
};

export const toHumanReadable = (n) => {
  if (n < 1000) return `${n} B`;
  else if (n < 1000000) return `${n / 1000} KB`;
  else if (n < 1000000000) return `${n / 1000000} MB`;
  else if (n < 1000000000000) return `${n / 1000000000} GB`;
};

export let log;
if (process.stdout.isTTY) {
  log = logWithStatusbar();
  log.setStatusBarText([""]);
} else {
  console.setStatusBarText = () => {};
  log = console;
}

// For dates in format yyyy-mm-dd that lack a month or day, or have question marks in their place
// return the latest possible date e.g. 2022-??-?? => 2022-12-31
export const unscuffDate = (date) => {
  date = date.replaceAll("–", "-"); // endash
  if (/^\d{4}[-?xX]*$/.test(date)) {
    return `${date.slice(0, 4)}-12-31`;
  }
  if (/^\d{4}-\d{2}[-?xX]*$/.test(date)) {
    let d = new Date(date.slice(0, 4), parseInt(date.slice(5, 7)), 0);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;
  }
  return date;
};
