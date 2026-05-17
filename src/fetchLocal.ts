/**
 * Local filesystem data source for offline development.
 * Reads from fixtures/ directory instead of Wookieepedia API.
 *
 * Has the same interface as fetchWookiee.js async generators.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { log } from "./util.ts";
import { FixtureError } from "./errors.ts";
import type { WookieepediaImageInfoResult, WookieepediaPageResult } from "./types/wookieepedia.ts";

type TitleInput = string | string[];
type FixtureResult = WookieepediaPageResult | WookieepediaImageInfoResult;

/**
 * Get the fixtures directory for the current continuity.
 * @param legends - Whether to use legends continuity
 * @returns Path to fixtures directory
 *
 * The base path can be overridden via FIXTURES_PATH environment variable.
 * This is useful for testing against snapshotted fixtures.
 */
function getFixturesDir(legends = false): string {
  const continuity = legends ? "legends" : "canon";
  const basePath = process.env.FIXTURES_PATH || path.join(process.cwd(), "fixtures");
  return path.join(basePath, continuity);
}

/**
 * Build an index mapping titles and pageids to fixture files.
 * @param {string} dir - Directory to index
 * @returns {Promise<Map<string, string>>} Map of title/pageid -> filename
 */
async function buildIndex(dir: string): Promise<Map<string, string>> {
  const index = new Map<string, string>();

  try {
    const files = await fs.readdir(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(dir, file);
      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content) as Partial<FixtureResult>;

      // Index by title (primary key for lookups)
      if (data.title) {
        index.set(data.title, filePath);
      }

      // Also index by pageid for redundancy
      if ("pageid" in data && data.pageid) {
        index.set(String(data.pageid), filePath);
      }
    }
  } catch (err) {
    if (!(err instanceof Error && "code" in err && err.code === "ENOENT")) throw err;
    // Directory doesn't exist - empty index
  }

  return index;
}

// Cached indexes for each fixture type
let mediaIndex: Map<string, string> | null = null;
let seriesIndex: Map<string, string> | null = null;
let imageInfoIndex: Map<string, string> | null = null;
let fixturesDir: string | null = null;
let currentLegends: boolean | null = null;

/**
 * Reset cached indexes. Call this when switching fixture sources (e.g., in tests).
 */
export function resetLocalIndexes() {
  mediaIndex = null;
  seriesIndex = null;
  imageInfoIndex = null;
  fixturesDir = null;
  currentLegends = null;
}

/**
 * Initialize or get cached indexes.
 * @param legends - Whether to use legends continuity
 */
async function ensureIndexes(legends = false): Promise<void> {
  const dir = getFixturesDir(legends);

  // Rebuild indexes if continuity changed or not initialized
  if (fixturesDir !== dir || currentLegends !== legends) {
    fixturesDir = dir;
    currentLegends = legends;

    log.info(`Building fixture indexes for ${legends ? "legends" : "canon"}...`);

    [mediaIndex, seriesIndex, imageInfoIndex] = await Promise.all([
      buildIndex(path.join(dir, "media")),
      buildIndex(path.join(dir, "series")),
      buildIndex(path.join(dir, "imageinfo")),
    ]);

    log.info(
      `Indexed ${mediaIndex.size} media, ${seriesIndex.size} series, ${imageInfoIndex.size} images`,
    );
  }
}

/**
 * Normalize a title for lookup (underscores to spaces, like MediaWiki).
 * @param {string} title - Title to normalize
 * @returns {string} Normalized title
 */
function normalizeTitle(title: string): string {
  return title.replace(/_/g, " ");
}

function requireIndex(index: Map<string, string> | null, name: string): Map<string, string> {
  if (!index) throw new FixtureError(`${name} fixture index is not initialized`);
  return index;
}

/**
 * Load a fixture file by title from one of the indexes.
 * @param {string} title - Page title to look up
 * @param {Map<string, string>[]} indexes - Indexes to search in order
 * @returns {Promise<object|null>} Fixture data or null if not found
 */
async function loadFixture<T extends FixtureResult>(
  title: string,
  indexes: Map<string, string>[],
): Promise<T | null> {
  // Try both the original title and normalized version (underscores -> spaces)
  const normalized = normalizeTitle(title);

  for (const index of indexes) {
    // Try original first
    let filePath = index.get(title);
    if (!filePath && title !== normalized) {
      // Try normalized
      filePath = index.get(normalized);
    }
    if (filePath) {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    }
  }
  return null;
}

/**
 * Fetch timeline page from fixtures.
 * @param {boolean} legends - Whether to use legends continuity
 * @returns {Promise<object>} Timeline page data
 */
export async function fetchTimelineLocal(legends = false): Promise<WookieepediaPageResult> {
  const dir = getFixturesDir(legends);
  const timelinePath = path.join(dir, "timeline.json");

  try {
    const content = await fs.readFile(timelinePath, "utf-8");
    return JSON.parse(content) as WookieepediaPageResult;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      throw new FixtureError(
        `Timeline fixture not found at ${timelinePath}. Run 'node scripts/capture-api-data.js' first.`,
        { cause: err },
      );
    }
    throw err;
  }
}

/**
 * Local version of fetchWookiee - yields page data from fixtures.
 * @param {string|string[]} titles - Page title(s) to fetch
 * @param {boolean} legends - Whether to use legends continuity
 * @yields {object} Page data with title, pageid, wikitext, timestamp
 */
export async function* fetchWookieeLocal(
  titles: TitleInput,
  legends = false,
): AsyncGenerator<WookieepediaPageResult> {
  if (typeof titles === "string") titles = [titles];

  await ensureIndexes(legends);

  for (const title of titles) {
    // Check if this is the timeline page
    const timelineTitle = `Timeline of ${legends ? "legends" : "canon"} media`;
    if (title === timelineTitle) {
      yield await fetchTimelineLocal(legends);
      continue;
    }

    // Search in media, then series indexes
    const data = await loadFixture<WookieepediaPageResult>(title, [
      requireIndex(mediaIndex, "media"),
      requireIndex(seriesIndex, "series"),
    ]);

    if (data) {
      yield data;
    } else {
      // Return missing page response (same as API)
      yield {
        title,
        missing: true,
      };
    }
  }
}

/**
 * Local version of fetchImageInfo - yields image info from fixtures.
 * @param {string|string[]} titles - Image file title(s) to fetch (with "File:" prefix)
 * @param {boolean} legends - Whether to use legends continuity
 * @yields {object} Image info with title, pageid, sha1, timestamp, url
 */
export async function* fetchImageInfoLocal(
  titles: TitleInput,
  legends = false,
): AsyncGenerator<WookieepediaImageInfoResult> {
  if (typeof titles === "string") titles = [titles];

  await ensureIndexes(legends);

  for (const title of titles) {
    const data = await loadFixture<WookieepediaImageInfoResult>(title, [
      requireIndex(imageInfoIndex, "imageinfo"),
    ]);

    if (data) {
      yield data;
    } else {
      // Return missing page response (same as API)
      yield {
        title,
        missing: true,
      };
    }
  }
}
