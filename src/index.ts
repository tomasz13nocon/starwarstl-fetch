import "./env.ts";
import { createClient } from "redis";
import type { Document, OptionalId } from "mongodb";

import { runPipeline } from "./runPipeline.ts";
import { buildTvImagePath, fileExists, log, toHumanReadable } from "./util.ts";
import config from "./config.ts";
import netLog from "./netLog.ts";
import { client, closeDb, db } from "./db.ts";
import { REDIS_URI } from "./const.ts";
import { FetchError } from "./errors.ts";

import type { AppearanceEntry } from "./types/appearances.ts";
import type { MediaDraft, SeriesDraft } from "./types/draft.ts";
import type { PipelineResult } from "./types/pipeline.ts";

type AppearanceCollectionDocument = {
  name: string;
  media: AppearanceEntry[];
};

async function writePipelineResult({
  drafts,
  seriesDrafts,
  appearancesDrafts,
  missingDrafts,
  missingMediaNoLongerMissing,
}: PipelineResult): Promise<void> {
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      let mediaColl = db.collection<MediaDraft>("media");
      let seriesColl = db.collection<SeriesDraft>("series");

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
        if (typeAppearances === undefined) continue;
        const appearancesCollection = db.collection<AppearanceCollectionDocument>(type);
        await appearancesCollection.createIndex({ name: "text" }, { session });
        await appearancesCollection.insertMany(
          Object.entries(typeAppearances).map(([name, media]) => ({ name, media })),
          { session },
        );
      }
      if (missingDrafts.length) {
        await db.collection("missingMedia").insertMany(missingDrafts as OptionalId<Document>[], { session });
      }
      if (missingMediaNoLongerMissing.length) {
        await db.collection("missingMedia").deleteMany({
          pageid: { $in: missingMediaNoLongerMissing.map((m) => m.pageid) },
        });
      }

      await db
        .collection("meta")
        .updateOne({}, { $set: { dataUpdateTimestamp: Date.now() } }, { upsert: true, session });
    });
  } finally {
    await session.endSession();
  }
}

async function warnForNewTvShows(): Promise<void> {
  let tvShowsNew = (await db.collection("media").distinct("series", { type: "tv" })).filter(
    (show): show is string => typeof show === "string",
  );
  for (let show of tvShowsNew) {
    if (!(await fileExists(buildTvImagePath(show)))) {
      log.warn("New tv series! Its thumbnail has to be uploaded manually. title: " + show);
    }
  }
}

async function invalidateRedisCache(): Promise<void> {
  log.info("Invalidating redis cache");
  const redis = createClient({ url: REDIS_URI });
  await redis.connect();
  await redis.flushDb();
  await redis.disconnect();
}

async function main(): Promise<void> {
  const { LIMIT } = config();

  // Run the pipeline
  const pipelineResult = await runPipeline({
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

  await writePipelineResult(pipelineResult);
  await warnForNewTvShows();
  await invalidateRedisCache();

  log.info(
    `Done!
Number of redirects encountered: ${netLog.redirectNum}
Total API data recieved: ${toHumanReadable(netLog.bytesRecieved)}
Total image data recieved: ${toHumanReadable(netLog.imageBytesRecieved)}
Number of HTTP requests made: ${netLog.requestNum}
${netLog.s3read ? "Number of S3 read requests: " + netLog.s3read : ""}
${netLog.s3write ? "Number of S3 write requests: " + netLog.s3write : ""}`
  );
}

try {
  await main();
} catch (error) {
  if (error instanceof FetchError) {
    log.error(`${error.name}: ${error.message}`);
  } else {
    log.error(error);
  }
  process.exitCode = 1;
} finally {
  await closeDb();
}
