import config, { debug } from "../config.ts";
import { fetchWookiee } from "../fetchWookiee.ts";
import { UnsupportedDateFormat, parseWookieepediaDate } from "../parseWookieepediaDate.ts";
import { docFromPage, fillDraftWithInfoboxData, getAppearances, reduceAstToText } from "../parsing/index.ts";
import { log } from "../util.ts";
import { writeFile } from "fs/promises";
import { cleanupDraft } from "./cleanupDrafts.js";
import { allowedAppCategories } from "../const.ts";
import type { AppearanceEntry, AppearanceTemplate, AppearancesDrafts, MediaDraft, MediaStageResult, SeriesDraft } from "../types/index.ts";

let { CACHE_PAGES } = config();

export default async function media(drafts: MediaDraft[]): Promise<MediaStageResult> {
  log.info("Fetching articles...");

  let progress = 0;
  let outOf = drafts.length;
  log.setStatusBarText([`Article: ${progress}/${outOf}`]);

  const titles = drafts.map((d) => d.href ?? d.title);
  for (var i = 0; i < titles.length; i++) {
    if (!titles[i]) throw new Error(`No title! Between ${titles[i - 1]} and ${titles[i + 1]}`);
  }

  let pages = fetchWookiee([...new Set(titles)], CACHE_PAGES);
  let infoboxes: string[] = [];
  let seriesDraftsMap: Record<string, SeriesDraft> = {};
  let appearancesDrafts: AppearancesDrafts = {};

  for await (let page of pages) {
    if (debug.article && debug.article !== page.title) continue;

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
        let logRedlink = debug.redlinks ? log.warn : log.info;
        logRedlink(`${page.title} is a redlink.`);
        draft.redlink = true;
        // TODO: ensure these have all availible info
        continue;
      }
      draft.doc = doc; // We need this for the second iteration

      let infobox = doc.infobox();
      if (!infobox) {
        throw new Error(
          `No infobox! title: ${draft.title}\nwikitext:\n${page.wikitext.slice(0, 1500)}`,
        );
      }

      if (debug.distinctInfoboxes && !infoboxes.includes(infobox._type))
        infoboxes.push(infobox._type, "\n");

      if (infobox._type === "audiobook") draft.audiobook === true;

      fillDraftWithInfoboxData(draft, infobox);

      let appearances = getAppearances(doc);
      draft.appearances = appearances?.nodes;
      if (appearances?.links) {
        for (let [type, links] of Object.entries(appearances.links)) {
          if (type.startsWith("l-")) continue;
          if (type.startsWith("c-")) type = type.slice(2);
          for (let link of links) {
            if (!(type in appearancesDrafts)) appearancesDrafts[type] = {};
            const appearancesForType = appearancesDrafts[type]!;
            let linkName = link.name;
            if (linkName.endsWith("/Legends")) linkName = linkName.slice(0, -8);
            if (!(linkName in appearancesForType)) appearancesForType[linkName] = [];
            // Log repeat appearances
            // if (appearancesDrafts[type][linkName].find((o) => o.id === draft._id)) {
            //   console.error(`Repeat appearance of ${type}: ${linkName} in ${draft.title}`);
            // }
            // for (let [oldType, appDraftsType] of Object.entries(appearancesDrafts)) {
            //   if (appDraftsType[linkName]?.find((o) => o.id === draft._id)) {
            //     console.error(
            //       `Repeat appearance across categories of ${oldType}: ${linkName} in ${draft.title}`
            //     );
            //   }
            // }
            const appearanceEntry: AppearanceEntry = {
              id: draft._id,
              ...(link.templates && {
                t: link.templates.map((t: AppearanceTemplate) => ({
                  name: t.name,
                  ...(t.parameters.length ? { parameters: t.parameters } : {}),
                })),
              }),
            };
            appearancesForType[linkName]!.push(appearanceEntry);
          }
        }
      }

      cleanupDraft(draft);

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
            " Use of buildTvImagePath based on series array and collapsing adjacent tv episodes are some examples.",
          );
        }
        for (let seriesTitle of draft.series) {
          if (!(seriesTitle in seriesDraftsMap)) {
            seriesDraftsMap[seriesTitle] = { title: seriesTitle };
          }
        }
      }

      log.setStatusBarText([`Article: ${++progress}/${outOf}`]);
    }
  }

  // Make sure no unknown appearances category was found
  for (let type of Object.keys(appearancesDrafts)) {
    if (!(allowedAppCategories as readonly string[]).includes(type)) {
      throw new Error(`Appearances category "${type}" is not allowed.`);
    }
  }

  if (debug.distinctInfoboxes) {
    await writeFile("../../debug/infoboxes.txt", infoboxes.join(""));
  }

  return { seriesDrafts: Object.values(seriesDraftsMap), appearancesDrafts };
}
