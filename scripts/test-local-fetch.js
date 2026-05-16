#!/usr/bin/env node
/**
 * Test script to verify local fetch mode works correctly.
 * Usage: node scripts/test-local-fetch.js --local
 *
 * This script tests the fetchLocal module directly without requiring
 * MongoDB or other infrastructure.
 */

import "../src/env.ts";
import config from "../src/config.js";
import { fetchWookieeLocal, fetchImageInfoLocal } from "../src/fetchLocal.js";

const cfg = config();
const legends = cfg.LEGENDS;

console.log("Config LEGENDS:", legends);
console.log("\nTesting local fixtures directly (no network, no DB required).\n");

// Try fetching timeline
console.log("--- Fetching timeline ---");
for await (const page of fetchWookieeLocal("Timeline of canon media", true, legends)) {
  console.log("Got page:", page.title);
  console.log("  pageid:", page.pageid);
  console.log("  has wikitext:", !!page.wikitext);
  console.log("  wikitext length:", page.wikitext?.length);
}

// Try fetching a media article
console.log("\n--- Fetching media article ---");
for await (const page of fetchWookieeLocal("Destroy Malevolence", true, legends)) {
  console.log("Got page:", page.title);
  console.log("  pageid:", page.pageid);
  console.log("  has wikitext:", !!page.wikitext);
}

// Try fetching multiple articles
console.log("\n--- Fetching multiple articles ---");
const titles = ["A New Dawn", "Ahsoka (novel)", "Nonexistent Page That Should Be Missing"];
for await (const page of fetchWookieeLocal(titles, true, legends)) {
  console.log("Got page:", page.title);
  console.log("  missing:", page.missing ?? false);
  console.log("  pageid:", page.pageid);
}

// Try fetching image info with underscore (tests normalization)
console.log("\n--- Fetching image info (testing underscore normalization) ---");
for await (const img of fetchImageInfoLocal(["File:The_Clone_Wars_film_poster.jpg"], legends)) {
  console.log("Got image:", img.title);
  console.log("  pageid:", img.pageid);
  console.log("  sha1:", img.sha1);
  console.log("  url:", img.url?.substring(0, 60) + "...");
}

console.log("\n=== All tests passed! ===");
