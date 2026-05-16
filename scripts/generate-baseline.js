#!/usr/bin/env node
/**
 * Generates baseline snapshot data for pipeline regression tests.
 *
 * This script runs the full pipeline with local fixtures and saves:
 * 1. A copy of the input fixtures (frozen point-in-time input)
 * 2. The pipeline output (expected output for that input)
 *
 * This ensures the baseline is completely self-contained - both input and
 * output are frozen together, so fixture updates don't break tests.
 *
 * Usage:
 *   node scripts/generate-baseline.js [--limit N]
 *
 * Options:
 *   --limit N  Only process the first N items (useful for quick iterations)
 *
 * Output structure:
 *   tests/snapshots/
 *     fixtures/              - Copy of input fixtures at baseline time
 *       canon/
 *         timeline.json
 *         media/
 *         series/
 *         imageinfo/
 *         manifest.json
 *     pipeline-baseline.json - Pipeline output (drafts, seriesDrafts, appearancesDrafts)
 *     baseline-stats.json    - Summary stats for quick verification
 *
 * Note: This script automatically adds --local to process.argv to use fixtures.
 */

// CRITICAL: Add --local flag BEFORE any imports
// This must happen before ES module resolution
if (!process.argv.includes("--local")) {
  process.argv.push("--local");
}

// Keep generated baselines comparable to regression tests. The pipeline marks
// future-dated media as `unreleased` using Date.now(), so baseline output must
// be generated with the same effective clock as the test.
const REGRESSION_TEST_DATE = "2026-01-18T14:14:49.775Z";
Date.now = () => Date.parse(REGRESSION_TEST_DATE);

// Parse --limit before imports too
let limit = 0;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--limit" && process.argv[i + 1]) {
    limit = parseInt(process.argv[i + 1], 10);
    i++;
  }
}

// Now we can use dynamic imports to ensure --local is set first
async function main() {
  // Dynamic imports happen AFTER process.argv is modified
  const { default: envModule } = await import("../src/env.ts");
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { runPipeline } = await import("../src/runPipeline.js");
  const { log } = await import("../src/util.js");

  const SNAPSHOTS_DIR = path.join(process.cwd(), "tests", "snapshots");
  const FIXTURES_SRC = path.join(process.cwd(), "fixtures", "canon");
  const FIXTURES_DEST = path.join(SNAPSHOTS_DIR, "fixtures", "canon");

  async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Copy fixtures to snapshots directory.
   * This freezes the input data alongside the expected output.
   */
  async function copyFixtures() {
    log.info("Copying fixtures to snapshots directory...");

    // Remove old fixtures copy if exists
    try {
      await fs.rm(FIXTURES_DEST, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }

    await ensureDir(FIXTURES_DEST);

    // Copy timeline.json
    await fs.copyFile(
      path.join(FIXTURES_SRC, "timeline.json"),
      path.join(FIXTURES_DEST, "timeline.json"),
    );

    // Copy manifest.json
    await fs.copyFile(
      path.join(FIXTURES_SRC, "manifest.json"),
      path.join(FIXTURES_DEST, "manifest.json"),
    );

    // Copy media/, series/, imageinfo/ directories
    for (const subdir of ["media", "series", "imageinfo"]) {
      const srcDir = path.join(FIXTURES_SRC, subdir);
      const destDir = path.join(FIXTURES_DEST, subdir);

      await ensureDir(destDir);

      const files = await fs.readdir(srcDir);
      for (const file of files) {
        await fs.copyFile(path.join(srcDir, file), path.join(destDir, file));
      }

      log.info(`  Copied ${files.length} files from ${subdir}/`);
    }

    log.info("Fixtures copied successfully.");
  }

  /**
   * Normalize data for consistent snapshots.
   * Removes non-deterministic fields and sorts arrays.
   */
  function normalizeForSnapshot(data) {
    // Deep clone to avoid modifying original
    const clone = JSON.parse(JSON.stringify(data));

    // Sort drafts by _id for consistent ordering
    if (Array.isArray(clone.drafts)) {
      clone.drafts.sort((a, b) => a._id - b._id);
    }

    // Sort series drafts by title
    if (Array.isArray(clone.seriesDrafts)) {
      clone.seriesDrafts.sort((a, b) => a.title.localeCompare(b.title));
    }

    // Sort appearance types and entries
    if (clone.appearancesDrafts) {
      const sorted = {};
      for (const type of Object.keys(clone.appearancesDrafts).sort()) {
        sorted[type] = {};
        for (const name of Object.keys(clone.appearancesDrafts[type]).sort()) {
          sorted[type][name] = clone.appearancesDrafts[type][name];
        }
      }
      clone.appearancesDrafts = sorted;
    }

    return clone;
  }

  log.info("Generating baseline snapshot data...");
  log.info(`Limit: ${limit || "none"}`);

  await ensureDir(SNAPSHOTS_DIR);

  try {
    // First, copy fixtures to snapshots (freeze the input)
    await copyFixtures();

    // Run pipeline with local fixtures, skip images for faster tests
    log.info("Running pipeline...");
    const result = await runPipeline({
      skipImages: true,
      skipValidatePageIds: true,
      limit,
    });

    const normalized = normalizeForSnapshot(result);

    // Write full baseline (compact JSON to save space - 55MB vs 242MB pretty-printed)
    const baselinePath = path.join(SNAPSHOTS_DIR, "pipeline-baseline.json");
    await fs.writeFile(baselinePath, JSON.stringify(normalized));
    log.info(`Wrote baseline to ${baselinePath}`);

    // Write summary stats for quick verification
    const stats = {
      generatedAt: new Date().toISOString(),
      limit: limit || "none",
      counts: {
        drafts: normalized.drafts.length,
        seriesDrafts: normalized.seriesDrafts.length,
        appearanceTypes: Object.keys(normalized.appearancesDrafts).length,
        totalAppearances: Object.values(normalized.appearancesDrafts).reduce(
          (sum, type) => sum + Object.keys(type).length,
          0,
        ),
      },
      // Sample of first few titles for sanity check
      sampleTitles: normalized.drafts.slice(0, 5).map((d) => d.title),
    };

    const statsPath = path.join(SNAPSHOTS_DIR, "baseline-stats.json");
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
    log.info(`Wrote stats to ${statsPath}`);

    log.info("Baseline generation complete!");
    log.info(`  Drafts: ${stats.counts.drafts}`);
    log.info(`  Series: ${stats.counts.seriesDrafts}`);
    log.info(`  Appearance types: ${stats.counts.appearanceTypes}`);
    log.info(`  Total appearances: ${stats.counts.totalAppearances}`);

    // Explicitly exit to ensure clean shutdown
    process.exit(0);
  } catch (err) {
    log.error("Baseline generation failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
