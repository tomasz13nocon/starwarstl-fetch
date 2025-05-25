import { suppressLog } from "../const.js";
import { db } from "../db.js";
import { log } from "../util.js";

export default async function (drafts) {
  log.info("Veryfing page IDs...");

  const missingDrafts = [];
  const missingMediaNoLongerMissing = [];

  const oldMediaArr = await db
    .collection("media")
    .find({}, { title: 1, pageid: 1, notUnique: 1 })
    .toArray();

  for (let oldMedia of oldMediaArr) {
    const newMedia = drafts.find((m) => m.pageid === oldMedia.pageid);

    if (newMedia === undefined) {
      if (suppressLog.ignoreMissingPageid.includes(oldMedia.title)) continue;

      if (suppressLog.migrateMissingPageid.includes(oldMedia.title)) {
        // TODO implement or remove from suppress log
        throw new Error("Not implemented");
      }

      const pageidsInUse = await db.collection("lists").distinct("items");

      // WARN:pageid If we end up using pageids for stuff other than lists, this needs to be updated
      if (!pageidsInUse.includes(oldMedia.pageid)) {
        log.info(
          `"${oldMedia.title}" with pageid: ${oldMedia.pageid} missing from new data, but it's safe to delete, due to not being in any list.`,
        );
        continue;
      }

      // add oldMedia to missingDrafts
      // persist missingDrafts to missingMedia in DB
      // frontend: display message about media being gone from one of user's lists, and show it in list page under "Media removed from timeline" heading

      missingDrafts.push(await db.collection("media").findOne({ pageid: oldMedia.pageid }));
      log.warn(
        `"${oldMedia.title}" with pageid: ${oldMedia.pageid} missing from new data. Saving to missingMedia.`,
      );

      // throw new Error(`Pageid missing! title: "${oldMedia.title}" pageid: ${oldMedia.pageid}`);
    } else {
      // Don't look at notUniques since they naturally have multiple titles for one pageid
      // Don't look at items without pageIDs, since they're not allowed to be added to lists anyway
      if (
        !oldMedia.notUnique &&
        newMedia.title !== oldMedia.title &&
        Number.isInteger(oldMedia.pageid) &&
        Number.isInteger(newMedia.pageid)
      )
        log.info(
          `Renamed: "${oldMedia.title}" with pageid ${oldMedia.pageid} to "${newMedia.title}"`,
        );
    }
  }

  const oldPageids = new Set(oldMediaArr.map((m) => m.pageid));
  const missingMediaArr = await db
    .collection("missingMedia")
    .find({}, { pageid: 1, title: 1 })
    .toArray();

  for (let newMedia of drafts) {
    if (!oldPageids.has(newMedia.pageid)) {
      log.info(
        `New media: ${newMedia.fullType ?? newMedia.type} "${newMedia.title}" with pageid ${newMedia.pageid}`,
      );
      newMedia.addedAt = new Date();
    }

    const missingMedia = missingMediaArr.find((m) => m.pageid === newMedia.pageid);
    if (missingMedia) {
      missingMediaNoLongerMissing.push(newMedia);
      log.warn(
        `Media with pageid ${newMedia.pageid} was missing, but it's present in the timeline again. Will delete from missingMedia.
Old title: ${missingMedia.title}
New title: ${newMedia.title}
Titles ${missingMedia.title === newMedia.title ? "are identical" : "differ"}.`,
      );
    }
  }

  return { missingDrafts, missingMediaNoLongerMissing };
}
