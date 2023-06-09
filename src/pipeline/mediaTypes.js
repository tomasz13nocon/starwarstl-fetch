import { figureOutFullTypes } from "../parsing.js";
import { log } from "../util.js";

export default async function (drafts, seriesDrafts) {
  let progress = 0;
  let outOf = drafts.length;
  log.info("Extracting full types");

  // Second iteration over media to get full types, for which we need series data.
  // Second iteration because we want to batch series fetching.
  for (let draft of drafts) {
    await figureOutFullTypes(draft, draft.doc, false, seriesDrafts);
    delete draft.doc;
    log.setStatusBarText([`Second iteration (full types). Article: ${++progress}/${outOf}`]);
  }
}
