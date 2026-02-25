/**
 * Step 0 – Fetch
 *
 * Clones the BSData/adeptus-titanicus repository and copies the catalogue files
 * to data/source/ for processing by step1-extract.
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

  // Ensure source directory exists
  fs.mkdirSync(SOURCE_DIR, { recursive: true });

  // Find all .gst and .cat files in the temp directory
  const files = fs.readdirSync(TEMP_DIR);
  const catalogueFiles = files.filter(
    (file) => file.endsWith(".gst") || file.endsWith(".cat")
  );

  if (catalogueFiles.length === 0) {
    throw new Error("[step0-fetch] No catalogue files (.gst or .cat) found");
  }

  console.log(
    `[step0-fetch] Found ${catalogueFiles.length} catalogue file(s)`
  );

  // Copy each catalogue file to the source directory
  for (const file of catalogueFiles) {
    const sourcePath = join(TEMP_DIR, file);
    const destPath = join(SOURCE_DIR, file.replace(/\.(gst|cat)$/, ".xml"));

    const content = fs.readFileSync(sourcePath, "utf-8");
    fs.writeFileSync(destPath, content, "utf-8");
    console.log(`[step0-fetch]   → Copied ${file} to ${destPath}`);
  }

  // Clean up temp directory
  console.log("[step0-fetch] Cleaning up temp directory…");
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  console.log("[step0-fetch] Fetch completed successfully");
}

run().catch((error) => {
  console.error("[step0-fetch] Fatal error:", error);
  process.exit(1);
});
