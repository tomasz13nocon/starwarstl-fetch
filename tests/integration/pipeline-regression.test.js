/**
 * Pipeline regression test - re-runs the pipeline and compares to baseline.
 *
 * This is the core regression test for the refactoring. It:
 * 1. Loads the snapshotted fixtures (frozen input)
 * 2. Runs the full pipeline against them
 * 3. Compares the output to the stored baseline (expected output)
 *
 * If output differs from baseline, the refactoring introduced a regression.
 *
 * This test is slower (processes ~2700 articles) so it's in a separate file
 * that can be run independently: npm test -- tests/integration/pipeline-regression.test.js
 *
 * To update the baseline after intentional changes:
 *   npm run baseline
 */

import "../../src/env.ts";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

const SNAPSHOTS_DIR = path.join(process.cwd(), "tests", "snapshots");
const BASELINE_PATH = path.join(SNAPSHOTS_DIR, "pipeline-baseline.json");
const SNAPSHOT_FIXTURES_PATH = path.join(SNAPSHOTS_DIR, "fixtures");
const REGRESSION_TEST_DATE = new Date("2026-01-18T14:14:49.775Z");

// Set longer timeout for this test file (pipeline takes several minutes)
// vitest.config.js has testTimeout: 60000, but we may need more
describe("pipeline regression - full run", { timeout: 600000 }, () => {
  let baseline;
  let pipelineResult;
  let originalFixturesPath;

  beforeAll(async () => {
    // Some pipeline output, notably `unreleased`, depends on Date.now(). Freeze
    // time to the baseline generation time so frozen fixtures stay deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(REGRESSION_TEST_DATE);

    // Load baseline
    try {
      const baselineContent = await fs.readFile(BASELINE_PATH, "utf-8");
      baseline = JSON.parse(baselineContent);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw new Error("Baseline not found. Run 'npm run baseline' first to generate it.");
      }
      throw err;
    }

    // Verify snapshotted fixtures exist
    try {
      await fs.access(SNAPSHOT_FIXTURES_PATH);
    } catch (err) {
      throw new Error("Snapshotted fixtures not found. Run 'npm run baseline' first.");
    }

    // Set FIXTURES_PATH to use snapshotted fixtures
    originalFixturesPath = process.env.FIXTURES_PATH;
    process.env.FIXTURES_PATH = SNAPSHOT_FIXTURES_PATH;

    // Add --local flag if not present
    if (!process.argv.includes("--local")) {
      process.argv.push("--local");
    }

    // Reset the local fixture indexes to pick up the new path
    const { resetLocalIndexes } = await import("../../src/fetchLocal.js");
    resetLocalIndexes();

    // Run the pipeline
    const { runPipeline } = await import("../../src/runPipeline.js");
    pipelineResult = await runPipeline({
      skipImages: true,
      skipValidatePageIds: true,
      limit: 0,
    });

    // Normalize for comparison (same as baseline generation)
    pipelineResult = normalizeForComparison(pipelineResult);
  }, 600000); // 10 minute timeout for beforeAll

  afterAll(() => {
    vi.useRealTimers();

    // Restore original FIXTURES_PATH
    if (originalFixturesPath !== undefined) {
      process.env.FIXTURES_PATH = originalFixturesPath;
    } else {
      delete process.env.FIXTURES_PATH;
    }
  });

  function normalizeForComparison(data) {
    const clone = JSON.parse(JSON.stringify(data));

    if (Array.isArray(clone.drafts)) {
      clone.drafts.sort((a, b) => a._id - b._id);
    }

    if (Array.isArray(clone.seriesDrafts)) {
      clone.seriesDrafts.sort((a, b) => a.title.localeCompare(b.title));
    }

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

  it("produces same number of drafts", () => {
    expect(pipelineResult.drafts.length).toBe(baseline.drafts.length);
  });

  it("produces same number of series drafts", () => {
    expect(pipelineResult.seriesDrafts.length).toBe(baseline.seriesDrafts.length);
  });

  it("produces same appearance categories", () => {
    expect(Object.keys(pipelineResult.appearancesDrafts).sort()).toEqual(
      Object.keys(baseline.appearancesDrafts).sort(),
    );
  });

  it("drafts match baseline exactly", () => {
    // Compare each draft individually for better error messages
    for (let i = 0; i < baseline.drafts.length; i++) {
      const expected = baseline.drafts[i];
      const actual = pipelineResult.drafts[i];

      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        // Find what differs
        const diffs = [];
        const allKeys = new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})]);
        for (const key of allKeys) {
          if (JSON.stringify(expected?.[key]) !== JSON.stringify(actual?.[key])) {
            diffs.push(
              `  ${key}: expected ${JSON.stringify(expected?.[key])} but got ${JSON.stringify(actual?.[key])}`,
            );
          }
        }

        throw new Error(
          `Draft mismatch at index ${i} (title: "${expected?.title || actual?.title}"):\n${diffs.join("\n")}`,
        );
      }
    }
  });

  it("series drafts match baseline exactly", () => {
    for (let i = 0; i < baseline.seriesDrafts.length; i++) {
      const expected = baseline.seriesDrafts[i];
      const actual = pipelineResult.seriesDrafts[i];

      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        const diffs = [];
        const allKeys = new Set([...Object.keys(expected || {}), ...Object.keys(actual || {})]);
        for (const key of allKeys) {
          if (JSON.stringify(expected?.[key]) !== JSON.stringify(actual?.[key])) {
            diffs.push(
              `  ${key}: expected ${JSON.stringify(expected?.[key])} but got ${JSON.stringify(actual?.[key])}`,
            );
          }
        }

        throw new Error(
          `Series draft mismatch at index ${i} (title: "${expected?.title || actual?.title}"):\n${diffs.join("\n")}`,
        );
      }
    }
  });

  it("appearances match baseline exactly", () => {
    expect(pipelineResult.appearancesDrafts).toEqual(baseline.appearancesDrafts);
  });
});
