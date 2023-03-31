import { writeFile } from "fs/promises";
import wtf from "wtf_wikipedia";
import "./env.js";
import { buildTvImagePath, fileExists, log, toHumanReadable } from "./util.js";
import config, { debug } from "./config.js";
import { fetchWookiee } from "./fetchWookiee.js";
import netLog from "./netLog.js";
import { closeDb, db } from "./db.js";
import timeline from "./pipeline/timeline.js";
import media from "./pipeline/media.js";
import series from "./pipeline/series.js";
import mediaTypes from "./pipeline/mediaTypes.js";
import images from "./pipeline/images.js";
import adjustBookTypes from "./pipeline/adjustBookTypes.js";
import validateFullTypes from "./pipeline/validateFullTypes.js";

const { Image, CACHE_PAGES, LIMIT } = config();

(() => {
  wtf.extend((models, templates) => {
    let parse = models.parse;

    templates.c = (tmpl, list) => {
      let x = parse(tmpl, ["value"]);
      list.push({ template: "C", value: x.value });
      return `((${x.value}))`;
    };

    templates.circa = (tmpl, list) => {
      let x = parse(tmpl, ["value"]);
      list.push({ template: "C", value: x.value });
      return `((Approximate date))`;
    };

    // Ignore quotes found at the begining of articles so that the first paragraph is the actual article
    templates.quote = (tmpl, list) => {
      list.push(parse(tmpl, ["text", "author"]));
      return "";
    };

    templates["scroll box"] = (tmpl, list) => {
      // TODO implement if causing issues
      return tmpl;
    };
  });
})();



log.info("Fetching timeline...");
// let timelineDoc = wtf(await fs.readFile("../client/sample_wikitext/timeline", "utf-8"));
let timelineWikitext = (await fetchWookiee("Timeline of canon media", CACHE_PAGES).next()).value.wikitext;
if (debug.saveTimeline) {
  await writeFile("debug/timeline", timelineWikitext);
  log.info("Saving timeline wikitext to debug/timeline due to debug.saveTimeline");
}
let timelineDoc = wtf(timelineWikitext);
let data = timelineDoc.tables()[1].json();

if (LIMIT) {
  data = data.slice(0, LIMIT);
}

// Processing pipeline starts

const { drafts, nopageDrafts } = timeline(data);

const { seriesDrafts } = await media(drafts);

await series(drafts, seriesDrafts);

mediaTypes(drafts, seriesDrafts);

adjustBookTypes(drafts, seriesDrafts);

await images(drafts);

validateFullTypes(drafts);



let mediaColl = db.collection("media");
let seriesColl = db.collection("series");

log.info("Clearing DB...");
mediaColl.deleteMany({});
seriesColl.deleteMany({});

log.info("Writing to DB...");
await mediaColl.insertMany(Object.values(drafts));
if (nopageDrafts.length)
  await mediaColl.insertMany(nopageDrafts);
await seriesColl.insertMany(Object.values(seriesDrafts));

let tvShowsNew = await mediaColl.distinct("series", { type: "tv" });
for (let show of tvShowsNew) {
  if (!(await fileExists(buildTvImagePath(show)))) {
    log.warn("New tv series! Its thumbnail has to be uploaded manually. title: " + show);
  }
}

let now = Date.now();
log.info("Updating data timestamp: " + now);
await db.collection("meta").updateOne({}, { $set: { dataUpdateTimestamp: now } }, { upsert: true });

await closeDb();

log.info(
  `Done!
Number of redirects encountered: ${netLog.redirectNum}
Total API data recieved: ${toHumanReadable(netLog.bytesRecieved)}
Total image data recieved: ${toHumanReadable(netLog.imageBytesRecieved)}
Number of HTTP requests made: ${netLog.requestNum}
${Image.s3requests !== undefined ? "Number of S3 requests: read: " + Image.s3requests.read + ", write: " + Image.s3requests.write : ""}`
);
