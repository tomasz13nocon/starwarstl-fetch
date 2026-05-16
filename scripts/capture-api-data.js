#!/usr/bin/env node
/**
 * Captures all Wookieepedia API responses to fixtures/ for offline development.
 *
 * Usage:
 *   node scripts/capture-api-data.js [--legends]
 *
 * This script fetches:
 *   1. Timeline page wikitext
 *   2. All media article wikitexts (from timeline)
 *   3. All series article wikitexts (from media infoboxes)
 *   4. All image info responses (from media infoboxes)
 *
 * Output structure:
 *   fixtures/
 *     canon/                    (or legends/)
 *       timeline.json           - Timeline page response
 *       media/                  - Individual media articles
 *         {pageid}.json
 *       series/                 - Series articles
 *         {pageid}.json
 *       imageinfo/              - Image info responses
 *         {pageid}.json
 *       manifest.json           - Metadata about the capture
 *
 * Note: Missing pages (redlinks) have no pageid, so their filename falls back
 * to a sanitized version of the title. These files contain { title, missing: true }.
 */

import "../src/env.ts";
import fs from "node:fs/promises";
import path from "node:path";
import wtf from "wtf_wikipedia";
import initWtf from "../src/initWtf.js";
import { fetchWookiee, fetchImageInfo } from "../src/fetchWookiee.ts";
import { log } from "../src/util.ts";
import { types } from "../src/const.ts";
import { decode } from "html-entities";

// Parse CLI args
const isLegends = process.argv.includes("--legends");
const continuity = isLegends ? "legends" : "canon";

// Initialize wtf_wikipedia with custom templates
initWtf();

const CACHE_PAGES = true;
const FIXTURES_DIR = path.join(process.cwd(), "fixtures", continuity);

async function cleanFixtures() {
  try {
    await fs.rm(FIXTURES_DIR, { recursive: true, force: true });
    log.info(`Cleaned existing fixtures at ${FIXTURES_DIR}`);
  } catch (err) {
    // Directory doesn't exist, that's fine
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Sanitize a title for use as a filename.
 * Uses pageid if available, falls back to sanitized title.
 */
function safeFilename(pageid, title) {
  if (pageid) return `${pageid}.json`;
  // Fallback: sanitize title for filesystem
  return title.replace(/[/\\?%*:|"<>]/g, "_") + ".json";
}

async function captureTimeline() {
  const timelinePage = `Timeline of ${continuity} media`;
  log.info(`Fetching timeline: "${timelinePage}"...`);

  const result = await fetchWookiee(timelinePage, CACHE_PAGES).next();
  const page = result.value;

  if (page.missing) {
    throw new Error(`Timeline page not found: ${timelinePage}`);
  }

  await writeJson(path.join(FIXTURES_DIR, "timeline.json"), page);
  log.info(`Saved timeline (pageid: ${page.pageid})`);

  return page;
}

function extractMediaTitles(timelineWikitext) {
  const doc = wtf(timelineWikitext);
  const table = doc.tables()[1].json();

  const titles = new Set();

  for (const item of table) {
    // Skip items with unknown types (like "P" for placeholder)
    if (types[item.col2?.text] === undefined) continue;

    const title = decode(item.Title?.links?.[0]?.page);
    if (title) {
      titles.add(title);
    }
  }

  return [...titles];
}

async function captureMediaArticles(titles) {
  const mediaDir = path.join(FIXTURES_DIR, "media");
  await ensureDir(mediaDir);

  log.info(`Fetching ${titles.length} media articles...`);

  let progress = 0;
  const seriesTitles = new Set();
  const coverFilenames = new Set();

  for await (const page of fetchWookiee(titles, CACHE_PAGES)) {
    progress++;
    log.setStatusBarText([`Media: ${progress}/${titles.length}`]);

    const filename = safeFilename(page.pageid, page.title);
    await writeJson(path.join(mediaDir, filename), page);

    // Parse the article to extract series and cover info
    if (!page.missing && page.wikitext) {
      const doc = wtf(page.wikitext);
      const infobox = doc.infobox();

      if (infobox) {
        // Extract series
        const seriesData = infobox.get("series");
        if (seriesData) {
          const links = seriesData.links?.() || [];
          for (const link of links) {
            if (link.page()) seriesTitles.add(link.page());
          }
        }

        // Extract cover image - use wikitext() and strip [[File:...|...]] markup
        const imageData = infobox.get("image");
        if (imageData) {
          const coverWook = imageData
            .wikitext()
            .replaceAll(/(\[\[|File:|\]\]|\|.*)/g, "")
            .trim();
          if (coverWook) {
            coverFilenames.add(coverWook);
          }
        }
      }
    }
  }

  log.info(`Saved ${progress} media articles`);
  return { seriesTitles: [...seriesTitles], coverFilenames: [...coverFilenames] };
}

async function captureSeriesArticles(titles) {
  if (titles.length === 0) {
    log.info("No series articles to fetch");
    return;
  }

  const seriesDir = path.join(FIXTURES_DIR, "series");
  await ensureDir(seriesDir);

  log.info(`Fetching ${titles.length} series articles...`);

  let progress = 0;

  for await (const page of fetchWookiee(titles, CACHE_PAGES)) {
    progress++;
    log.setStatusBarText([`Series: ${progress}/${titles.length}`]);

    const filename = safeFilename(page.pageid, page.title);
    await writeJson(path.join(seriesDir, filename), page);
  }

  log.info(`Saved ${progress} series articles`);
}

async function captureImageInfo(coverFilenames) {
  if (coverFilenames.length === 0) {
    log.info("No images to fetch info for");
    return;
  }

  const imageDir = path.join(FIXTURES_DIR, "imageinfo");
  await ensureDir(imageDir);

  // Add "File:" prefix for the API
  const fileTitles = coverFilenames.map((f) => `File:${f}`);

  log.info(`Fetching ${fileTitles.length} image info records...`);

  let progress = 0;

  for await (const imageinfo of fetchImageInfo(fileTitles)) {
    progress++;
    log.setStatusBarText([`Image info: ${progress}/${fileTitles.length}`]);

    const filename = safeFilename(imageinfo.pageid, imageinfo.title);
    await writeJson(path.join(imageDir, filename), imageinfo);
  }

  log.info(`Saved ${progress} image info records`);
}

async function writeManifest(stats) {
  const manifest = {
    capturedAt: new Date().toISOString(),
    continuity,
    stats,
  };

  await writeJson(path.join(FIXTURES_DIR, "manifest.json"), manifest);
  log.info("Wrote manifest.json");
}

async function main() {
  log.info(`Starting API data capture for ${continuity} continuity...`);
  log.info(`Output directory: ${FIXTURES_DIR}`);

  // Clean existing fixtures to avoid stale data
  await cleanFixtures();
  await ensureDir(FIXTURES_DIR);

  // 1. Capture timeline
  const timelinePage = await captureTimeline();

  // 2. Extract media titles from timeline
  const mediaTitles = extractMediaTitles(timelinePage.wikitext);
  log.info(`Found ${mediaTitles.length} unique media titles in timeline`);

  // 3. Capture media articles (and extract series + cover info)
  const { seriesTitles, coverFilenames } = await captureMediaArticles(mediaTitles);
  log.info(`Found ${seriesTitles.length} unique series titles`);
  log.info(`Found ${coverFilenames.length} unique cover filenames`);

  // 4. Capture series articles
  await captureSeriesArticles(seriesTitles);

  // 5. Capture image info
  await captureImageInfo(coverFilenames);

  // 6. Write manifest
  await writeManifest({
    mediaArticles: mediaTitles.length,
    seriesArticles: seriesTitles.length,
    images: coverFilenames.length,
  });

  log.info("Data capture complete!");
}

main().catch((err) => {
  log.error("Capture failed:", "message" in err ? err.message : JSON.stringify(err));
  process.exit(1);
});
