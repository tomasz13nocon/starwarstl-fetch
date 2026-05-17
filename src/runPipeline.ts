/**
 * Runs the fetch pipeline and returns the processed data.
 * This module extracts the pipeline logic from index.ts for testability.
 *
 * The pipeline processes Wookieepedia data through these stages:
 * 1. timeline - Parse timeline table into draft objects
 * 2. media - Fetch individual media articles, extract infobox data, appearances
 * 3. series - Fetch series articles, determine series types
 * 4. mediaTypes - Determine full types (book-a, tv-animated, etc.)
 * 5. adjustBookTypes - Adjust book series to yr type if all entries are yr
 * 6. images - Fetch/process cover images (optional, can be skipped for tests)
 * 7. validateFullTypes - Validate required fullTypes exist
 * 8. cleanupDrafts - Remove empty/null values
 *
 * @module runPipeline
 */

import wtf from "./wtf.ts";
import initWtf from "./initWtf.ts";
import { log } from "./util.ts";
import config from "./config.ts";
import { fetchWookiee } from "./fetchWookiee.ts";
import { knownTemplates } from "./const.ts";
import { PipelineError } from "./errors.ts";
import timeline from "./pipeline/timeline.ts";
import media from "./pipeline/media.ts";
import series from "./pipeline/series.ts";
import mediaTypes from "./pipeline/mediaTypes.ts";
import adjustBookTypes from "./pipeline/adjustBookTypes.ts";
import images from "./pipeline/images.ts";
import validateFullTypes from "./pipeline/validateFullTypes.ts";
import cleanupDrafts from "./pipeline/cleanupDrafts.ts";
import validatePageIds from "./pipeline/validatePageIds.ts";

import type { MediaDraft } from "./types/draft.ts";
import type {
  PipelineOptions,
  PipelineResult,
  TimelineRow,
  ValidatePageIdsResult,
} from "./types/pipeline.ts";
import type { WtfTemplate } from "./types/wtf.ts";
import { isPageMissing } from "./types/wookieepedia.ts";

/**
 * Run the fetch pipeline.
 *
 * @param {PipelineOptions} [options={}] - Pipeline options
 * @returns {Promise<PipelineResult>} Processed pipeline data
 */
export async function runPipeline(options: PipelineOptions = {}): Promise<PipelineResult> {
  const { skipImages = false, skipValidatePageIds = false, limit = 0 } = options;
  const { CACHE_PAGES, LEGENDS } = config();

  // Initialize wtf_wikipedia with custom templates
  initWtf();

  // Fetch and parse timeline
  // Proper legends handling is unimplemented for now
  const timelinePage = `Timeline of ${LEGENDS ? "legends" : "canon"} media`;
  log.info(`Fetching ${timelinePage}...`);

  const timelineResult = await fetchWookiee(timelinePage, CACHE_PAGES).next();
  if (timelineResult.done) {
    throw new PipelineError(`No page returned for ${timelinePage}`);
  }

  if (isPageMissing(timelineResult.value)) {
    throw new PipelineError(`Timeline page not found: ${timelinePage}`);
  }

  const timelineWikitext = timelineResult.value.wikitext;
  const timelineDoc = wtf(timelineWikitext);
  const timelineTable = timelineDoc.tables()[1];
  if (timelineTable === undefined) {
    throw new PipelineError(`Timeline table not found on ${timelinePage}`);
  }
  let data = timelineTable.json() as TimelineRow[];

  // Verify no unexpected templates
  const templates = Array.from(
    new Set(timelineDoc.templates().map((t: WtfTemplate) => t.json().template)),
  );
  const unknownTemplates = templates.filter(
    (t): t is string => typeof t === "string" && !knownTemplates.has(t as never),
  );
  if (unknownTemplates.length !== 0) {
    log.error("Unknown templates:", unknownTemplates);
    throw new PipelineError("Unknown templates found in the timeline!");
  }

  // Apply limit if specified
  if (limit > 0) {
    data = data.slice(0, limit);
  }

  // Run pipeline stages
  const drafts = timeline(data);

  const { seriesDrafts, appearancesDrafts } = await media(drafts);

  await series(drafts, seriesDrafts);

  await mediaTypes(drafts, seriesDrafts);

  adjustBookTypes(drafts, seriesDrafts);

  if (!skipImages) {
    await images(drafts);
  }

  validateFullTypes(drafts);

  cleanupDrafts(drafts, seriesDrafts);

  let missingDrafts: ValidatePageIdsResult["missingDrafts"] = [];
  let missingMediaNoLongerMissing: MediaDraft[] = [];
  if (!skipValidatePageIds) {
    ({ missingDrafts, missingMediaNoLongerMissing } = await validatePageIds(drafts));
  }

  return { drafts, seriesDrafts, appearancesDrafts, missingDrafts, missingMediaNoLongerMissing };
}

export default runPipeline;
