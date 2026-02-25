/**
 * Step 0 – Fetch
 *
 * Clones the BSData/adeptus-titanicus repository and copies the .gst catalogue
 * file to data/source/ for processing by step1-extract.
 *
 * This step is run before the main build pipeline to fetch fresh data from
 * the upstream BSData repository.
 */

import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const TEMP_DIR = join(__dirname, "../../temp");
const SOURCE_DIR = join(__dirname, "../../data/source");
const REPO_URL = "https://github.com/BSData/adeptus-titanicus.git";
const CATALOGUE_FILE = "Adeptus Titanicus 2018.gst";

// ---------------------------------------------------------------------------
// Main fetch logic
// ---------------------------------------------------------------------------
async function run(): Promise<void> {
  console.log("[step0-fetch] Starting fetch from BSData repository…");

  // Clean up temp directory if it exists
  if (fs.existsSync(TEMP_DIR)) {
    console.log("[step0-fetch] Cleaning up existing temp directory…");
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }

  // Clone the BSData repository
  console.log(`[step0-fetch] Cloning ${REPO_URL}…`);
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  try {
    await git.clone({
      fs,
      http,
      dir: TEMP_DIR,
      url: REPO_URL,
      depth: 1, // Shallow clone to save time and space
      singleBranch: true,
    });
    console.log("[step0-fetch] Repository cloned successfully");
  } catch (error) {
    console.error("[step0-fetch] Failed to clone repository:", error);
    throw error;
  }

  // Read the catalogue file
  const cataloguePath = join(TEMP_DIR, CATALOGUE_FILE);
  if (!fs.existsSync(cataloguePath)) {
    throw new Error(
      `[step0-fetch] Catalogue file not found: ${CATALOGUE_FILE}`
    );
  }

  console.log(`[step0-fetch] Reading ${CATALOGUE_FILE}…`);
  const catalogueData = fs.readFileSync(cataloguePath, "utf-8");

  // Ensure source directory exists
  fs.mkdirSync(SOURCE_DIR, { recursive: true });

  // Write to source directory with .xml extension for consistency
  const outputPath = join(SOURCE_DIR, "adeptus-titanicus.xml");
  fs.writeFileSync(outputPath, catalogueData, "utf-8");
  console.log(`[step0-fetch] Wrote catalogue to ${outputPath}`);

  // Clean up temp directory
  console.log("[step0-fetch] Cleaning up temp directory…");
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log("[step0-fetch] Fetch completed successfully");
}

run().catch((error) => {
  console.error("[step0-fetch] Fatal error:", error);
  process.exit(1);
});
