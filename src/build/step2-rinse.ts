/**
 * Step 2 – Rinse
 *
 * Reads data/extracted/raw.json (produced by step1-extract.ts), applies
 * TypeScript transformation functions to normalise and clean each entry,
 * then writes data/extracted/rinsed.json.
 *
 * "Rinsing" covers:
 *  - Parsing numeric strings into proper numbers
 *  - Normalising stat formats (e.g. ensuring movement has a trailing `"`)
 *  - Filtering out incomplete or invalid entries
 *  - Validating each entry with Zod after transformation
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  RawEntrySchema,
  UnitSchema,
  type RawEntry,
  type Unit,
  type WeaponProfile,
} from "../schemas/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const EXTRACTED_DIR = join(__dirname, "../../data/extracted");

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Ensure movement always has a trailing `"`, e.g. `6` → `6"`. */
function normaliseMovement(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.endsWith('"') ? trimmed : `${trimmed}"`;
}

/**
 * Parse a stat value that should be a positive integer.
 * Returns `null` if the string cannot be parsed.
 */
function parsePositiveInt(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parse a stat value that should be a non-negative integer.
 * Returns `null` if the string cannot be parsed.
 */
function parseNonNegativeInt(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Parse an armour-penetration value.
 * AP values are zero or negative (e.g. `"0"` or `"-2"`).
 */
function parseAP(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n <= 0 ? n : null;
}

/** Ensure a save/leadership stat has a trailing `+`. */
function normalisePlusStat(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d+\+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `${trimmed}+`;
  return null;
}

// ---------------------------------------------------------------------------
// Per-field rinse functions
// ---------------------------------------------------------------------------

function rinseWeapon(
  raw: RawEntry["weapons"][number]
): WeaponProfile | null {
  const type = raw.type === "melee" ? "melee" : "ranged";
  const strength = parsePositiveInt(raw.strength);
  const ap = parseAP(raw.armorPenetration);

  if (strength === null || ap === null) return null;

  return {
    id: raw.id,
    name: raw.name.trim(),
    type,
    range: raw.range ? raw.range.trim() : undefined,
    attacks: raw.attacks.trim(),
    ballisticOrWeaponSkill: raw.skill.trim(),
    strength,
    armorPenetration: ap,
    damage: raw.damage.trim(),
    keywords: raw.keywords.map((k) => k.trim()).filter(Boolean),
  };
}

function rinseUnit(raw: RawEntry): Unit | null {
  const movement = normaliseMovement(raw.stats.movement);
  const toughness = parsePositiveInt(raw.stats.toughness);
  const save = normalisePlusStat(raw.stats.save);
  const wounds = parsePositiveInt(raw.stats.wounds);
  const leadership = normalisePlusStat(raw.stats.leadership);
  const objectiveControl = parseNonNegativeInt(raw.stats.objectiveControl);

  if (
    toughness === null ||
    save === null ||
    wounds === null ||
    leadership === null ||
    objectiveControl === null
  ) {
    return null;
  }

  const weapons: WeaponProfile[] = [];
  for (const rawWeapon of raw.weapons) {
    const rinsed = rinseWeapon(rawWeapon);
    if (rinsed) weapons.push(rinsed);
  }

  const unit: Unit = {
    id: raw.id,
    name: raw.name.trim(),
    faction: raw.faction.trim(),
    keywords: raw.keywords.map((k) => k.trim()).filter(Boolean),
    stats: {
      movement,
      toughness,
      save,
      wounds,
      leadership,
      objectiveControl,
    },
    weapons,
    abilities: raw.abilities.map((a) => ({
      id: a.id,
      name: a.name.trim(),
      description: a.description.trim(),
    })),
    pointsCost: raw.pointsCost
      ? (parseNonNegativeInt(raw.pointsCost) ?? undefined)
      : undefined,
  };

  // Validate with Zod before accepting
  const result = UnitSchema.safeParse(unit);
  if (!result.success) {
    console.warn(
      `[step2-rinse] Skipping "${raw.name}" – validation failed:`,
      result.error.flatten().fieldErrors
    );
    return null;
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function run(): void {
  const rawPath = join(EXTRACTED_DIR, "raw.json");
  const rawJson = readFileSync(rawPath, "utf-8");
  const rawEntries: unknown[] = JSON.parse(rawJson);

  const rinsed: Unit[] = [];
  let skipped = 0;

  for (const rawEntry of rawEntries) {
    const parseResult = RawEntrySchema.safeParse(rawEntry);
    if (!parseResult.success) {
      console.warn(
        "[step2-rinse] Could not parse raw entry, skipping:",
        parseResult.error.flatten().fieldErrors
      );
      skipped++;
      continue;
    }

    const unit = rinseUnit(parseResult.data);
    if (unit) {
      rinsed.push(unit);
    } else {
      skipped++;
    }
  }

  const outPath = join(EXTRACTED_DIR, "rinsed.json");
  writeFileSync(outPath, JSON.stringify(rinsed, null, 2), "utf-8");
  console.log(
    `[step2-rinse] Wrote ${rinsed.length} unit(s) to ${outPath}` +
      (skipped > 0 ? ` (${skipped} skipped)` : "")
  );
}

run();
