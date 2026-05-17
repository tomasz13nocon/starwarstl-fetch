import { log } from "../util.ts";
import type { MediaDraft, SeriesDraft } from "../types/index.ts";

export default function adjustBookTypes(drafts: MediaDraft[], seriesDrafts: SeriesDraft[]): SeriesDraft[] {
  // Problem: Junior series are referred to as "young reader" by wookieepedia, so we have to infer yr type by looking at entries of the series
  // If all entries of a book series are yr then the series is yr
  let bookSeriesArr = seriesDrafts.filter((e) => e.type === "book").map((e) => e.title);
  for (let bookSeries of bookSeriesArr) {
    let entries = drafts.filter((e) => e.series?.includes(bookSeries));
    if (entries.every((e) => e.type === "yr")) {
      let seriesDraft = seriesDrafts.find((e) => e.title === bookSeries);
      if (seriesDraft) {
        seriesDraft.type = "yr";
        delete seriesDraft.fullType;
      }
      log.info(`Series ${bookSeries} has only yr entries, therefore it is yr.`);
    }
  }
  return seriesDrafts;
}
