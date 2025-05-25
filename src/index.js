import "./env.js";
import { writeFile } from "fs/promises";
import wtf from "wtf_wikipedia";
import initWtf from "./initWtf.js";
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
import { REDIS_URI, knownTemplates } from "./const.js";

const { CACHE_PAGES, LIMIT, LEGENDS } = config();

initWtf();

const timelinePage = `Timeline of ${LEGENDS ? "legends" : "canon"} media`;
log.info(`Fetching ${timelinePage}...`);

// let timelineDoc = wtf(await fs.readFile("../client/sample_wikitext/timeline", "utf-8"));
let timelineWikitext = (await fetchWookiee(timelinePage, CACHE_PAGES).next()).value.wikitext;
if (debug.saveTimeline) {
  await writeFile("debug/timeline", timelineWikitext);
  log.info("Saving timeline wikitext to debug/timeline due to debug.saveTimeline");
}
let timelineDoc = wtf(timelineWikitext);
let data = timelineDoc.tables()[1].json();

// Verify that no unexpected templates exist in timeline
let templates = Array.from(new Set(timelineDoc.templates().map((t) => t.json().template)));
let unknownTemplates = templates.filter(t => !knownTemplates.has(t))
if (unknownTemplates.length !== 0) {
  log.error("Unknown templates:", unknownTemplates);
  throw new Error("Unknown templates found in the timeline!");
}

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

const { missingDrafts, missingMediaNoLongerMissing } = await validatePageIds(drafts);

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
    await mediaColl.deleteMany({}, { session });
    await seriesColl.deleteMany({}, { session });
    for (let type of Object.keys(appearancesDrafts)) {
      await db.collection(type).deleteMany({}, { session });
    }


    log.info("Writing to DB");
    await mediaColl.insertMany(drafts, { session });
    await seriesColl.insertMany(seriesDrafts, { session });
    for (let [type, typeAppearances] of Object.entries(appearancesDrafts)) {
      await db.collection(type).createIndex({ name: "text" }, { session });
      await db.collection(type).insertMany(Object.entries(typeAppearances).map(([name, media]) => ({ name, media })), { session });
    }
    if (missingDrafts.length)
      await db.collection("missingMedia").insertMany(missingDrafts, { session, ordered: false });
    if (missingMediaNoLongerMissing.length)
      await db.collection("missingMedia").deleteMany({ pageid: { $in: missingMediaNoLongerMissing.map(m => m.pageid) } });

    await db.collection("meta").updateOne({}, { $set: { dataUpdateTimestamp: Date.now() } }, { upsert: true, session });
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
