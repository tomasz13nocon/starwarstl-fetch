import "./env.ts";
import { runPipeline } from "./runPipeline.js";
import { buildTvImagePath, fileExists, log, toHumanReadable } from "./util.ts";
import config from "./config.ts";
import netLog from "./netLog.ts";
import { client, closeDb, db } from "./db.js";
import { createClient } from "redis";
import { REDIS_URI } from "./const.ts";

const { LIMIT } = config();

// Run the pipeline
const { drafts, seriesDrafts, appearancesDrafts, missingDrafts, missingMediaNoLongerMissing } =
  await runPipeline({
    skipImages: false,
    skipValidatePageIds: false,
    limit: LIMIT || 0,
  });

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
      await db.collection("missingMedia").insertMany(missingDrafts, { session });
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
