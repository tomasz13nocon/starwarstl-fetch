import "./env.js";
import { writeFile } from "fs/promises";
import wtf from "wtf_wikipedia";
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
import cleanupDrafts from "./pipeline/cleanupDrafts.js";
import { createClient } from "redis";
import { allowedAppCategories } from "./const.js";

const { CACHE_PAGES, LIMIT } = config();

(() => {
  wtf.extend((models, templates) => {
    let parse = models.parse;

    templates.c = (tmpl, list) => {
      let x = parse(tmpl, ["value"]);
      list.push({ template: "C", value: x.value });
      return `{{C|${x.value}}}`;
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

    templates["scroll box"] = (tmpl) => {
      // implement if causing issues
      return tmpl;
    };

    // For appearances section (App template), which uses {{!}} as a column break
    templates["!"] = (tmpl) => {
      return tmpl;
    };

    // Appearances templates. Rust parses these, so leave them be
    const appTemplates = ["1st", "1stm", "co", "mo", "imo", "flash", "1stid", "hologram"];
    for (let template of appTemplates) {
      templates[template] = (tmpl) => {
        return tmpl;
      };
    }
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
// TODO: make these pure-ish and more SRP

const drafts = timeline(data);

const { seriesDrafts, appearancesDrafts } = await media(drafts);

await series(drafts, seriesDrafts);

await mediaTypes(drafts, seriesDrafts);

adjustBookTypes(drafts, seriesDrafts);

await images(drafts);

validateFullTypes(drafts);

cleanupDrafts(drafts, seriesDrafts);

log.warn(`creature count: ${netLog.creaturesCount}`);
log.warn(`c-creature count: ${netLog["c-creaturesCount"]}`);
log.warn(`l-creature count: ${netLog["l-creaturesCount"]}`);
log.warn(`organism count: ${netLog.organismsCount}`);
log.warn(`c-organism count: ${netLog["c-organismsCount"]}`);
log.warn(`l-organism count: ${netLog["l-organismsCount"]}`);

let mediaColl = db.collection("media");
let seriesColl = db.collection("series");

log.info("Clearing DB");
await mediaColl.deleteMany({});
await seriesColl.deleteMany({});
for (let type of Object.keys(appearancesDrafts)) {
  await db.collection(type).deleteMany({});
}

log.info("Writing to DB");
await mediaColl.insertMany(drafts);
await seriesColl.insertMany(seriesDrafts);
for (let [type, typeAppearances] of Object.entries(appearancesDrafts)) {
  await db.collection(type).insertMany(Object.entries(typeAppearances).map(([name, media]) => ({ name, media })));
  await db.collection(type).createIndex({ name: "text" });
}

let tvShowsNew = await mediaColl.distinct("series", { type: "tv" });
for (let show of tvShowsNew) {
  if (!(await fileExists(buildTvImagePath(show)))) {
    log.warn("New tv series! Its thumbnail has to be uploaded manually. title: " + show);
  }
}

log.info("Invalidating redis cache");
const redis = createClient();
await redis.connect();
await redis.flushDb();
await redis.disconnect();

await closeDb();

log.info(
  `Done!
Number of redirects encountered: ${netLog.redirectNum}
Total API data recieved: ${toHumanReadable(netLog.bytesRecieved)}
Total image data recieved: ${toHumanReadable(netLog.imageBytesRecieved)}
Number of HTTP requests made: ${netLog.requestNum}
${netLog.s3read ? "Number of S3 read requests: " + netLog.s3read : ""}
${netLog.s3write ? "Number of S3 write requests: " + netLog.s3write : ""}`
);
