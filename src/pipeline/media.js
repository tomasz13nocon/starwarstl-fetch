import _ from "lodash";
import config, { debug } from "../config.js";
import { fetchWookiee } from "../fetchWookiee.js";
import { UnsupportedDateFormat, parseWookieepediaDate } from "../parseWookieepediaDate.js";
import { docFromPage, fillDraftWithInfoboxData } from "../parsing.js";
import { log } from "../util.js";
import { writeFile } from "fs/promises";

let { CACHE_PAGES } = config();

function reduceAstToText(acc, item) {
  switch (item.type) {
    case "text":
    case "note":
      acc += item.text;
      break;
    case "list":
      acc += _.flatten(item.data).reduce(reduceAstToText, "");
      break;
    case "internal link":
    case "interwiki link":
      acc += item.text ?? item.page;
      break;
    case "external link":
      acc += item.text ?? item.site;
      break;
  }
  return acc;
}

export default async function (drafts) {
  log.info("Fetching articles...");

  let progress = 0;
  let outOf = Object.keys(drafts).length;
  log.setStatusBarText([`Article: ${progress}/${outOf}`]);

  let pages = fetchWookiee(Object.keys(drafts), CACHE_PAGES);
  let infoboxes = [];
  let seriesDrafts = {};

  for await (let page of pages) {
    let [doc, draft] = await docFromPage(page, drafts);
    if (doc === null) {
      if (debug.redlinks) {
        log.warn(`${page.title} is a redlink in the timeline! Ignoring.`);
      } else {
        log.info(`${page.title} is a redlink in the timeline! Ignoring.`);
      }
      delete drafts[page.title];
      continue;
    }
    draft.doc = doc; // We need this for the second iteration
    if (doc.isDisambig()) {
      log.error("Disambiguation page! title: " + draft.title);
    }
    let infobox = doc.infobox();
    if (!infobox) {
      log.error(page.wikitext.slice(0, 1500));
      throw `No infobox! title: ${draft.title}`;
    }

    if (debug.distinctInfoboxes && !infoboxes.includes(infobox._type))
      infoboxes.push(infobox._type, "\n");

    if (infobox._type === "audiobook") draft.audiobook === true;

    fillDraftWithInfoboxData(draft, infobox);

    try {
      if (draft.dateDetails) {
        try {
          draft.dateParsed = parseWookieepediaDate(draft.dateDetails.reduce(reduceAstToText, ""));
        } catch (e) {
          if (e instanceof UnsupportedDateFormat) {
            draft.dateParsed = parseWookieepediaDate(draft.date);
          } else {
            throw e;
          }
        }
      } else {
        draft.dateParsed = parseWookieepediaDate(draft.date);
      }
    } catch (e) {
      if (e instanceof UnsupportedDateFormat) {
        log.error(draft.title, e);
      } else {
        throw e;
      }
    }

    if (draft.dateParsed === undefined) delete draft.dateParsed;

    if (draft.series) {
      if (draft.type === "tv" && draft.series.length > 1) {
        log.warn(
          `${draft.title} has type "tv" and belongs to multiple series.` +
            " This can cause bugs in frontend!" +
            " Use of buildTvImagePath based on series array and collapsing adjacent tv episodes are some examples."
        );
      }
      for (let seriesTitle of draft.series) {
        if (!(seriesTitle in seriesDrafts)) {
          seriesDrafts[seriesTitle] = { title: seriesTitle };
        }
      }
    }

    log.setStatusBarText([`Article: ${++progress}/${outOf}`]);
  }

  if (debug.distinctInfoboxes) {
    await writeFile("../../debug/infoboxes.txt", infoboxes);
  }

  return { drafts, seriesDrafts };
}
