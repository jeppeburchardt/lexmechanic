/**
 * Step 3 – Merge
 *
 * Reads:
 *  - data/extracted/rinsed.json   (output of step2-rinse.ts)
 *  - data/manual/units.json       (manually maintained overrides)
 *
 * Merges the two: manual data takes precedence over extracted data.
 * Validates the final dataset with Zod and writes data/output/dataset.json.
 *
 * Merge strategy:
 *  - Manual entries are matched to rinsed entries by `id`.
 *  - Scalar fields (`notes`, `pointsCost`) are overwritten if present in manual.
 *  - Array fields (`keywords`, `abilities`) are overwritten (not appended).
 *  - Rinsed entries with no corresponding manual entry are kept as-is.
 *  - Manual entries with no matching rinsed entry are currently ignored
 *    (they would be orphaned overrides – a warning is emitted).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ManualOverrideSchema,
  DatasetSchema,
  UnitSchema,
  type Unit,
  type ManualOverride,
  type Dataset,
} from "../schemas/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EXTRACTED_DIR = join(__dirname, "../../data/extracted");
const MANUAL_DIR = join(__dirname, "../../data/manual");
const OUTPUT_DIR = join(__dirname, "../../data/output");

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------
function applyOverride(unit: Unit, override: ManualOverride): Unit {
  return {
    ...unit,
    notes: override.notes ?? unit.notes,
    pointsCost: override.pointsCost ?? unit.pointsCost,
    keywords:
      override.keywords !== undefined ? override.keywords : unit.keywords,
    abilities:
      override.abilities !== undefined ? override.abilities : unit.abilities,
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function run(): void {
  // Load rinsed units
  const rinsedPath = join(EXTRACTED_DIR, "rinsed.json");
  const rinsedJson = readFileSync(rinsedPath, "utf-8");
  const rinsedUnits: Unit[] = JSON.parse(rinsedJson);

  // Load manual overrides
  const manualPath = join(MANUAL_DIR, "units.json");
  const manualJson = readFileSync(manualPath, "utf-8");
  const rawOverrides: unknown[] = JSON.parse(manualJson);

  const overrideMap = new Map<string, ManualOverride>();
  for (const raw of rawOverrides) {
    const result = ManualOverrideSchema.safeParse(raw);
    if (!result.success) {
      console.warn(
        "[step3-merge] Skipping invalid manual override:",
        result.error.flatten().fieldErrors
      );
      continue;
    }
    overrideMap.set(result.data.id, result.data);
  }

  // Merge
  const merged: Unit[] = [];
  for (const unit of rinsedUnits) {
    const override = overrideMap.get(unit.id);
    const finalUnit = override ? applyOverride(unit, override) : unit;

    // Validate merged result
    const result = UnitSchema.safeParse(finalUnit);
    if (!result.success) {
      console.warn(
        `[step3-merge] Merged unit "${unit.name}" failed validation – keeping pre-merge version:`,
        result.error.flatten().fieldErrors
      );
      merged.push(unit);
    } else {
      merged.push(result.data);
    }

    overrideMap.delete(unit.id);
  }

  // Warn about orphaned overrides
  for (const [id] of overrideMap) {
    console.warn(
      `[step3-merge] Manual override for id "${id}" has no matching rinsed unit – ignoring.`
    );
  }

  // Build and validate the final dataset
  const dataset: Dataset = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    units: merged,
  };

  const datasetResult = DatasetSchema.safeParse(dataset);
  if (!datasetResult.success) {
    console.error(
      "[step3-merge] Final dataset failed validation:",
      datasetResult.error.flatten()
    );
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, "dataset.json");
  writeFileSync(outPath, JSON.stringify(datasetResult.data, null, 2), "utf-8");
  console.log(
    `[step3-merge] Wrote dataset with ${datasetResult.data.units.length} unit(s) to ${outPath}`
  );
}

run();
