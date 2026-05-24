import config, { debug } from "../config.ts";
import { fetchWookiee } from "../fetchWookiee.ts";
import { UnsupportedDateFormat, parseWookieepediaDate } from "../parseWookieepediaDate.ts";
import {
  docFromPage,
  fillDraftWithInfoboxData,
  getAppearances,
  reduceAstToText,
} from "../parsing/index.ts";
import { isPageMissing } from "../types/wookieepedia.ts";
import { log } from "../util.ts";
import { writeFile } from "fs/promises";
import { cleanupDraft } from "./cleanupDrafts.ts";
import { allowedAppCategories } from "../const.ts";
import { PipelineError } from "../errors.ts";
import type {
  AppearanceEntry,
  AppearanceTemplate,
  AppearancesDrafts,
  MediaDraft,
  MediaStageResult,
  SeriesDraft,
} from "../types/index.ts";

let { CACHE_PAGES } = config();

function articleTitlesForDrafts(drafts: MediaDraft[]): string[] {
  const titles = drafts.map((d) => d.href ?? d.title);
  for (let i = 0; i < titles.length; i++) {
    if (!titles[i]) throw new PipelineError(`No title! Between ${titles[i - 1]} and ${titles[i + 1]}`);
  }
  return [...new Set(titles)];
}

function redlinkLogger(): (message: string) => void {
  return debug.redlinks ? (message: string) => log.warn(message) : (message: string) => log.info(message);
}

function addAppearances(
  draft: MediaDraft,
  appearancesDrafts: AppearancesDrafts,
): void {
  if (!draft.doc) return;
  const appearances = getAppearances(draft.doc);
  draft.appearances = appearances?.nodes;
  if (!appearances?.links) return;

  for (let [type, links] of Object.entries(appearances.links)) {
    if (type.startsWith("l-")) continue;
    if (type.startsWith("c-")) type = type.slice(2);
    for (const link of links) {
      const appearancesForType = (appearancesDrafts[type] ??= {});
      const linkName = link.name.endsWith("/Legends") ? link.name.slice(0, -8) : link.name;
      const appearanceEntry: AppearanceEntry = {
        id: draft._id,
        ...(link.templates && {
          t: link.templates.map((t: AppearanceTemplate) => ({
            name: t.name,
            ...(t.parameters.length ? { parameters: t.parameters } : {}),
          })),
        }),
      };
      const entries = (appearancesForType[linkName] ??= []);
      entries.push(appearanceEntry);
    }
  }
}

function parseDraftDate(draft: MediaDraft): void {
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
}

function collectSeriesDrafts(draft: MediaDraft, seriesDraftsMap: Record<string, SeriesDraft>): void {
  if (!draft.series) return;
  if (draft.type === "tv" && draft.series.length > 1) {
    log.warn(
      `${draft.title} has type "tv" and belongs to multiple series.` +
        " This can cause bugs in frontend!" +
        " Use of buildTvImagePath based on series array and collapsing adjacent tv episodes are some examples.",
    );
  }
  for (const seriesTitle of draft.series) {
    if (!(seriesTitle in seriesDraftsMap)) {
      seriesDraftsMap[seriesTitle] = { title: seriesTitle };
    }
  }
}

function validateAppearanceCategories(appearancesDrafts: AppearancesDrafts): void {
  for (const type of Object.keys(appearancesDrafts)) {
    if (!(allowedAppCategories as readonly string[]).includes(type)) {
      throw new PipelineError(`Appearances category "${type}" is not allowed.`);
    }
  }
}

export default async function media(drafts: MediaDraft[]): Promise<MediaStageResult> {
  log.info("Fetching articles...");

  let progress = 0;
  let outOf = drafts.length;
  log.setStatusBarText([`Article: ${progress}/${outOf}`]);

  let pages = fetchWookiee(articleTitlesForDrafts(drafts), CACHE_PAGES);
  let infoboxes: string[] = [];
  let seriesDraftsMap: Record<string, SeriesDraft> = {};
  let appearancesDrafts: AppearancesDrafts = {};

  for await (let page of pages) {
    if (debug.article && debug.article !== page.title) continue;

    if (isPageMissing(page)) {
      const matchingDrafts = drafts.filter((d) => (d.href ?? d.title) === page.title);
      for (let draft of matchingDrafts) {
        redlinkLogger()(`${page.title} is a redlink.`);
        draft.redlink = true;
        log.setStatusBarText([`Article: ${++progress}/${outOf}`]);
      }
      continue;
    }

    if (!("wikitext" in page)) continue;
    const matchingDrafts = drafts.filter((d) => (d.href ?? d.title) === page.title);
    if (matchingDrafts.length === 0) {
      log.error(
        `No matching draft for: "${page.title}". ${page.normalizedFrom ? 'Title was normalized from "' + page.normalizedFrom + '"' : "Title was NOT normalized."}`,
      );
    }

    // This will be a single iteration most of the time
    // It won't be only for "chapter" entries which all link to their parent media
    for (let draft of matchingDrafts) {
      draft.pageid = page.pageid;
      let doc = await docFromPage(page, draft);
      if (doc === null) {
        redlinkLogger()(`${page.title} is a redlink.`);
        draft.redlink = true;
        // TODO: ensure these have all availible info
        continue;
      }
      draft.doc = doc; // We need this for the second iteration

      let infobox = doc.infobox();
      if (!infobox) {
        throw new PipelineError(
          `No infobox! title: ${draft.title}\nwikitext:\n${page.wikitext.slice(0, 1500)}`,
        );
      }

      if (debug.distinctInfoboxes && !infoboxes.includes(infobox._type))
        infoboxes.push(infobox._type, "\n");

      if (infobox._type === "audiobook") draft.audiobook = true;

      fillDraftWithInfoboxData(draft, infobox);

      addAppearances(draft, appearancesDrafts);

      cleanupDraft(draft);

      parseDraftDate(draft);
      collectSeriesDrafts(draft, seriesDraftsMap);

      log.setStatusBarText([`Article: ${++progress}/${outOf}`]);
    }
  }

  validateAppearanceCategories(appearancesDrafts);

  if (debug.distinctInfoboxes) {
    await writeFile("../../debug/infoboxes.txt", infoboxes.join(""));
  }

  return { seriesDrafts: Object.values(seriesDraftsMap), appearancesDrafts };
}

export function enrichMediaArticles(drafts: MediaDraft[]): Promise<MediaStageResult> {
  return media(drafts);
}
