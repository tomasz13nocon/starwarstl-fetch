import { suppressLog } from "../const.js";
import { db } from "../db.js";
import { log } from "../util.js";

export default async function (drafts) {
  log.info("Veryfing page IDs...");

  const oldMediaArr = await db
    .collection("media")
    .find({}, { _id: 0, pageid: 1, title: 1 })
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
        log.warn(
          `"${oldMedia.title}" with pageid: ${oldMedia.pageid} missing from new data, but it's safe to delete, due to not being in any list.`,
        );
        continue;
      }

      throw new Error(`Pageid missing! title: "${oldMedia.title}" pageid: ${oldMedia.pageid}`);
    }

    // Don't look at notUniques since they naturally have multiple titles for one pageid
    if (!oldMedia.notUnique && newMedia.title !== oldMedia.title)
      log.warn(
        `"${oldMedia.title}" with pageid ${oldMedia.pageid} has been renamed to "${newMedia.title}"`,
      );
  }

  const oldPageids = new Set(oldMediaArr.map((m) => m.pageid));

  for (let newMedia of drafts) {
    if (!oldPageids.has(newMedia.pageid)) {
      log.info(
        `New media: ${newMedia.fullType ?? newMedia.type} "${newMedia.title}" with pageid ${newMedia.pageid}`,
      );
      newMedia.addedAt = new Date();
    }
  }
}
