import { writeFile } from "fs/promises";
import config, { debug } from "../config.ts";
import { seriesTypes, suppressLog } from "../const.ts";
import { fetchWookiee } from "../fetchWookiee.ts";
import { docFromPage, figureOutFullTypes, fillDraftWithInfoboxData } from "../parsing/index.ts";
import { seriesRegexes } from "../regex.ts";
import { log } from "../util.ts";
import { cleanupDraft } from "./cleanupDrafts.ts";
import type { FullType, MediaDraft, SeriesDraft, SeriesType } from "../types/index.ts";

const { CACHE_PAGES } = config();

const hardcodedSeriesTypes: Partial<Record<string, SeriesType>> = {
  "Golden Books": "yr",
  "Disney Die-Cut Classics": "yr",
};

export default async function series(
  drafts: MediaDraft[],
  seriesDrafts: SeriesDraft[],
): Promise<void> {
  log.info("Fetching series...");

  let seriesInfoboxes: string[] = [];
  let progress = 0;
  let outOf = seriesDrafts.length;

  // Series handling
  let seriesPages = fetchWookiee(
    seriesDrafts.map((d) => d.title),
    CACHE_PAGES,
  );

  for await (let page of seriesPages) {
    for (let seriesDraft of seriesDrafts.filter((d) => d.title.replace(/#.*/, "") === page.title)) {
      let seriesDoc = await docFromPage(page, seriesDraft);
      let episodes = drafts.filter((e) => e.series?.includes(seriesDraft.title));

      const hardcodedType = hardcodedSeriesTypes[seriesDraft.title];
      if (hardcodedType) {
        seriesDraft.type = hardcodedType;
      }

      if (seriesDoc === null) {
        if (debug.redlinks) {
          log.warn(`Series ${seriesDraft.title} is a redlink!`);
        }
        // infer series type from episodes
        log.info(`Inferring series type from episodes of a redlink series: ${seriesDraft.title}`);
        let epType: MediaDraft["type"] | undefined;
        if (episodes.every((e, index) => (index === 0 ? (epType = e.type) : epType === e.type))) {
          seriesDraft.type = epType;
          log.info(`Inferred type: ${epType}`);
          let fullType: FullType | undefined;
          if (
            episodes.every((e, index) =>
              index === 0 ? (fullType = e.fullType) : fullType === e.fullType,
            )
          ) {
            seriesDraft.fullType = fullType;
            log.info(`Inferred full type: ${fullType}`);
          }
        } else {
          seriesDraft.type = "unknown";
          log.warn(
            "Failed to infer type. Setting 'unknown'. Consider adding 'unkown' entry to the legend.",
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
      const firstSentenceNode = seriesDoc.sentence(0);
      if (firstSentenceNode === null)
        throw new Error(`Expected first sentence in series article: ${seriesTitle}`);
      let firstSentence = firstSentenceNode.text();
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
                  `Multiple regex matches in first sentence of series article: ${seriesTitle} when looking for type.
Matched for: ${seriesDraft.type} and ${type} (latter takes priority).
Sentence: ${firstSentence}`,
                );
            }
            seriesDraft.type = type as SeriesType;
          }
        }
      }
      if (seriesInfobox !== null) {
        if (!seriesDraft.type) {
          seriesDraft.type = (seriesTypes as Partial<Record<string, SeriesType>>)[
            seriesInfobox._type
          ];
          if (seriesDraft.type === undefined)
            throw new Error(
              `Can't infer type.
Series ${seriesTitle} has unknown infobox:
${seriesInfobox._type}
Series comprises: ${episodes.map((e) => e.title).join("\n")}`,
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
        await figureOutFullTypes(seriesDraft, seriesDoc, true);
      } else if (!seriesDraft.type) {
        throw new Error(
          `No infobox and failed to infer series type from article!
Series: ${seriesTitle}
Sentence: ${firstSentence}
Series comprises: ${episodes.map((e) => e.title).join("\n")}`,
        );
      }
      log.setStatusBarText([`Series article: ${++progress}/${outOf}`]);
    }
  }

  if (debug.distinctInfoboxes) {
    await writeFile("../../debug/seriesInfoboxes.txt", seriesInfoboxes.join(""));
  }
}
