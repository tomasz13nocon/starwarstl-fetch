import { figureOutFullTypes } from "../parsing/index.ts";
import { log } from "../util.ts";
import type { MediaDraft, SeriesDraft } from "../types/index.ts";

export default async function mediaTypes(
  drafts: MediaDraft[],
  seriesDrafts: SeriesDraft[],
): Promise<void> {
  let progress = 0;
  let outOf = drafts.length;
  log.info("Extracting full types");

  // Second iteration over media to get full types, for which we need series data.
  // Second iteration because we want to batch series fetching.
  for (let draft of drafts) {
    if (!draft.doc) throw new Error(`Missing parsed doc for ${draft.title}`);
    await figureOutFullTypes(draft, draft.doc, false, seriesDrafts);
    delete draft.doc;
    log.setStatusBarText([`Second iteration (full types). Article: ${++progress}/${outOf}`]);
  }
}
