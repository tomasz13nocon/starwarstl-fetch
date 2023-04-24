import { writeFile } from "fs/promises";
import config, { debug } from "../config.js";
import { seriesTypes, suppressLog } from "../const.js";
import { fetchWookiee } from "../fetchWookiee.js";
import { docFromPage, figureOutFullTypes, fillDraftWithInfoboxData } from "../parsing.js";
import { seriesRegexes } from "../regex.js";
import { log } from "../util.js";
import { cleanupDraft } from "./cleanupDrafts.js";

const { CACHE_PAGES } = config();

export default async function (drafts, seriesDrafts) {
  log.info("Fetching series...");

  let seriesInfoboxes = [];
  let progress = 0;
  let outOf = seriesDrafts.length;

  // Series handling
  let seriesPages = fetchWookiee(
    seriesDrafts.map((d) => d.title),
    CACHE_PAGES
  );

  for await (let page of seriesPages) {
    for (let seriesDraft of seriesDrafts.filter((d) => d.title.replace(/#.*/, "") === page.title)) {
      let seriesDoc = await docFromPage(page, seriesDraft);
      if (seriesDoc === null) {
        if (debug.redlinks) {
          log.warn(`Series ${seriesDraft.title} is a redlink!`);
        }
        // infer series type from episodes
        log.info(`Inferring series type from episodes of a redlink series: ${seriesDraft.title}`);
        let episodes = drafts.filter((e) => e.series?.includes(seriesDraft.title));
        let epType;
        if (episodes.every((e, index) => (index === 0 ? (epType = e.type) : epType === e.type))) {
          seriesDraft.type = epType;
          log.info(`Inferred type: ${epType}`);
          if (
            episodes.every((e, index) =>
              index === 0 ? (epType = e.fullType) : epType === e.fullType
            )
          ) {
            seriesDraft.fullType = epType;
            log.info(`Inferred full type: ${epType}`);
          }
        } else {
          seriesDraft.type = "unknown";
          log.warn(
            "Failed to infer type. Setting 'unknown'. Consider adding 'unkown' entry to the legend."
          );
        }
        progress++;
        continue;
      }
      let seriesTitle = seriesDraft.title;
      if (seriesTitle.includes("#")) {
        seriesDraft.displayTitle = seriesTitle.replaceAll("#", " ");
      }
      let seriesInfobox = seriesDoc.infobox();
      let firstSentence = seriesDoc.sentence(0).text();
      // Figure out type from categories ...
      if (seriesDoc.categories().includes("Multimedia projects")) {
        seriesDraft.type = "multimedia";
      }
      // ... or from the first sentence of the article
      else {
        for (let [type, re] of Object.entries(seriesRegexes)) {
          if (re.test(firstSentence)) {
            if (seriesDraft.type) {
              if (!suppressLog.multipleRegexMatches.includes(seriesTitle))
                log.warn(
                  `Multiple regex matches in first sentence of series article: ${seriesTitle} when looking for type. Matched for: ${seriesDraft.type} and ${type} (latter takes priority). Sentence: ${firstSentence}`
                );
            }
            seriesDraft.type = type;
          }
        }
      }
      if (seriesInfobox !== null) {
        if (!seriesDraft.type) {
          seriesDraft.type = seriesTypes[seriesInfobox._type];
          if (seriesDraft.type === undefined)
            throw new Error(
              `Series ${seriesTitle} has unknown infobox: ${seriesInfobox._type}! Can't infer type.`
            );
          if (
            debug.distinctInfoboxes &&
            seriesInfobox &&
            !seriesInfoboxes.includes(seriesInfobox._type)
          ) {
            seriesInfoboxes.push(seriesInfobox._type, "\n");
          }
        }
        fillDraftWithInfoboxData(seriesDraft, seriesInfobox);
        cleanupDraft(seriesDraft);
        figureOutFullTypes(seriesDraft, seriesDoc, true);
      } else if (!seriesDraft.type) {
        throw new Error(
          `No infobox and failed to infer series type from article!! series: ${seriesTitle} sentence: ${firstSentence}`
        );
      }
      log.setStatusBarText([`Series article: ${++progress}/${outOf}`]);
    }
  }

  if (debug.distinctInfoboxes) {
    await writeFile("../../debug/seriesInfoboxes.txt", seriesInfoboxes);
  }
}
