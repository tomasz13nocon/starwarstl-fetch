import { log } from "../util.js";

export default function (drafts, seriesDrafts) {
  // Problem: Junior series are referred to as "young reader" by wookieepedia, so we have to infer yr type by looking at entries of the series
  // If all entries of a book series are yr then the series is yr
  let bookSeriesArr = Object.values(seriesDrafts)
    .filter((e) => e.type === "book")
    .map((e) => e.title);
  for (let bookSeries of bookSeriesArr) {
    let entries = Object.values(drafts).filter((e) => e.series?.includes(bookSeries));
    if (entries.every((e) => e.type === "yr")) {
      seriesDrafts[bookSeries].type = "yr";
      delete seriesDrafts[bookSeries].fullType;
      log.info(`Series ${bookSeries} has only yr entries, therefore it is yr.`);
    }
  }
}
