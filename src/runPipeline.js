/**
 * Runs the fetch pipeline and returns the processed data.
 * This module extracts the pipeline logic from index.js for testability.
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

import wtf from "wtf_wikipedia";
import initWtf from "./initWtf.js";
import { log } from "./util.ts";
import config from "./config.ts";
import { fetchWookiee } from "./fetchWookiee.ts";
import { knownTemplates } from "./const.ts";
import timeline from "./pipeline/timeline.js";
import media from "./pipeline/media.js";
import series from "./pipeline/series.js";
import mediaTypes from "./pipeline/mediaTypes.js";
import adjustBookTypes from "./pipeline/adjustBookTypes.js";
import images from "./pipeline/images.js";
import validateFullTypes from "./pipeline/validateFullTypes.js";
import cleanupDrafts from "./pipeline/cleanupDrafts.js";
import validatePageIds from "./pipeline/validatePageIds.js";

/**
 * @typedef {Object} PipelineOptions
 * @property {boolean} [skipImages=false] - Skip image processing (useful for tests)
 * @property {boolean} [skipValidatePageIds=false] - Skip page ID validation (requires DB access)
 * @property {number} [limit=0] - Limit number of items to process (0 = no limit)
 */

/**
 * @typedef {Object} PipelineResult
 * @property {Array} drafts - Processed media draft objects
 * @property {Array} seriesDrafts - Processed series draft objects
 * @property {Object} appearancesDrafts - Appearances organized by type
 * @property {Array} missingDrafts - Media that was in DB but no longer in timeline
 * @property {Array} missingMediaNoLongerMissing - Previously missing media now back in timeline
 */

/**
 * Run the fetch pipeline.
 *
 * @param {PipelineOptions} [options={}] - Pipeline options
 * @returns {Promise<PipelineResult>} Processed pipeline data
 */
export async function runPipeline(options = {}) {
  const { skipImages = false, skipValidatePageIds = false, limit = 0 } = options;
  const { CACHE_PAGES, LEGENDS } = config();

  // Initialize wtf_wikipedia with custom templates
  initWtf();

  // Fetch and parse timeline
  // Proper legends handling is unimplemented for now
  const timelinePage = `Timeline of ${LEGENDS ? "legends" : "canon"} media`;
  log.info(`Fetching ${timelinePage}...`);

  const timelineWikitext = (await fetchWookiee(timelinePage, CACHE_PAGES).next()).value.wikitext;
  const timelineDoc = wtf(timelineWikitext);
  let data = timelineDoc.tables()[1].json();

  // Verify no unexpected templates
  const templates = Array.from(new Set(timelineDoc.templates().map((t) => t.json().template)));
  const unknownTemplates = templates.filter((t) => !knownTemplates.has(t));
  if (unknownTemplates.length !== 0) {
    log.error("Unknown templates:", unknownTemplates);
    throw new Error("Unknown templates found in the timeline!");
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

  let missingDrafts = [];
  let missingMediaNoLongerMissing = [];
  if (!skipValidatePageIds) {
    ({ missingDrafts, missingMediaNoLongerMissing } = await validatePageIds(drafts));
  }

  return { drafts, seriesDrafts, appearancesDrafts, missingDrafts, missingMediaNoLongerMissing };
}

export default runPipeline;
