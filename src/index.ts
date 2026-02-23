/**
 * Main package entry point.
 *
 * Exposes the fully validated dataset and all TypeScript types/schemas
 * so consumers can work with the data in a type-safe manner.
 *
 * Usage:
 *   import { loadDataset, UnitSchema, type Unit } from "lexmechanic";
 *   import dataset from "lexmechanic/data";
 */

export {
  // Zod schemas for consumers who want to validate their own data
  UnitStatsSchema,
  WeaponProfileSchema,
  AbilitySchema,
  UnitSchema,
  DatasetSchema,
  ManualOverrideSchema,
  RawEntrySchema,
  RawWeaponSchema,
} from "./schemas/index.js";

export type {
  UnitStats,
  WeaponProfile,
  Ability,
  Unit,
  RawUnit,
  RawWeapon,
  RawEntry,
  Dataset,
  ManualOverride,
} from "./types/index.js";

// ---------------------------------------------------------------------------
// Runtime dataset loader
// ---------------------------------------------------------------------------
import { createRequire } from "node:module";
import { type Dataset } from "./schemas/index.js";

const require = createRequire(import.meta.url);

/**
 * Loads the pre-built dataset from data/output/dataset.json.
 *
 * Throws if the dataset file does not exist (i.e. the build has not been run).
 */
export function loadDataset(): Dataset {
  // Use require() so the JSON is resolved relative to this module at runtime.
  const raw: unknown = require("../data/output/dataset.json");
  return raw as Dataset;
}
