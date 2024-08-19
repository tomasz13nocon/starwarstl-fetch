import "./env.js";
import { writeFile } from "fs/promises";
import wtf from "wtf_wikipedia";
import { buildTvImagePath, fileExists, log, toHumanReadable } from "./util.js";
import config, { debug } from "./config.js";
import { fetchWookiee } from "./fetchWookiee.js";
import netLog from "./netLog.js";
import { client, closeDb, db } from "./db.js";
import timeline from "./pipeline/timeline.js";
import media from "./pipeline/media.js";
import series from "./pipeline/series.js";
import mediaTypes from "./pipeline/mediaTypes.js";
import images from "./pipeline/images.js";
import adjustBookTypes from "./pipeline/adjustBookTypes.js";
import validateFullTypes from "./pipeline/validateFullTypes.js";
import cleanupDrafts from "./pipeline/cleanupDrafts.js";
import { createClient } from "redis";
import validatePageIds from "./pipeline/validatePageIds.js";
import { REDIS_URI } from "./const.js";

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

    templates.film = tmpl => {
      let x = parse(tmpl, ["value"]);
      switch (x.value) {
        case "1": case "I":
          return "[[Star Wars: Episode I The Phantom Menace|''Star Wars'': Episode I ''The Phantom Menace'']]";
        case "2": case "II":
          return "[[Star Wars: Episode II Attack of the Clones|''Star Wars'': Episode II ''Attack of the Clones'']]"
        case "3": case "III":
          return "[[Star Wars: Episode III Revenge of the Sith|''Star Wars'': Episode III ''Revenge of the Sith'']]"
        case "4": case "IV":
          return "[[Star Wars: Episode IV A New Hope|''Star Wars'': Episode IV ''A New Hope'']]"
        case "5": case "V":
          return "[[Star Wars: Episode V The Empire Strikes Back|''Star Wars'': Episode V ''The Empire Strikes Back'']]"
        case "6": case "VI":
          return "[[Star Wars: Episode VI Return of the Jedi|''Star Wars'': Episode VI ''Return of the Jedi'']]"
        case "7": case "VII":
          return "[[Star Wars: Episode VII The Force Awakens|''Star Wars'': Episode VII ''The Force Awakens'']]"
        case "8": case "VIII":
          return "[[Star Wars: Episode VIII The Last Jedi|''Star Wars'': Episode VIII ''The Last Jedi'']]"
        case "9": case "IX":
          return "[[Star Wars: Episode IX The Rise of Skywalker|''Star Wars'': Episode IX ''The Rise of Skywalker'']]"
        default:
          log.warn("Unknown Film template argument:", x.value);
          return tmpl;
      }
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

await validatePageIds(drafts);

log.info(`creature count: ${netLog.creaturesCount}`);
log.info(`c-creature count: ${netLog["c-creaturesCount"]}`);
log.info(`l-creature count: ${netLog["l-creaturesCount"]}`);
log.info(`organism count: ${netLog.organismsCount}`);
log.info(`c-organism count: ${netLog["c-organismsCount"]}`);
log.info(`l-organism count: ${netLog["l-organismsCount"]}`);


const session = client.startSession();
try {
  await session.withTransaction(async () => {
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
      await db.collection(type).createIndex({ name: "text" });
      await db.collection(type).insertMany(Object.entries(typeAppearances).map(([name, media]) => ({ name, media })));
    }

    await db.collection("meta").updateOne({}, { $set: { dataUpdateTimestamp: Date.now() } }, { upsert: true });
  });
}
finally {
  await session.endSession();
}

let tvShowsNew = await db.collection("media").distinct("series", { type: "tv" });
for (let show of tvShowsNew) {
  if (!(await fileExists(buildTvImagePath(show)))) {
    log.warn("New tv series! Its thumbnail has to be uploaded manually. title: " + show);
  }
}

log.info("Invalidating redis cache");
const redis = createClient({ url: REDIS_URI });
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
