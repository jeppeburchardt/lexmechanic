/**
 * Step 1 – Extract
 *
 * Reads XML source files from data/source/ and converts them into a
 * normalised intermediate JSON format stored in data/extracted/raw.json.
 *
 * Supported XML schema: Battlescribe catalogue format (*.xml / *.cat).
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { type RawEntry } from "../schemas/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_DIR = join(__dirname, "../../data/source");
const EXTRACTED_DIR = join(__dirname, "../../data/extracted");

// ---------------------------------------------------------------------------
// XML parser configuration
// ---------------------------------------------------------------------------
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    [
      "selectionEntry",
      "selectionEntryGroup",
      "profile",
      "profileRef",
      "characteristic",
      "categoryLink",
      "categoryEntry",
      "entryLink",
      "cost",
    ].includes(name),
});

// ---------------------------------------------------------------------------
// Helper types for the raw Battlescribe XML structure
// ---------------------------------------------------------------------------
interface BsCharacteristic {
  "@_name": string;
  "@_typeId": string;
  "#text"?: string | number;
}

interface BsProfile {
  "@_id": string;
  "@_name": string;
  "@_typeId": string;
  "@_typeName": string;
  characteristics?: { characteristic?: BsCharacteristic[] };
}

interface BsEntryLink {
  "@_id": string;
  "@_targetId": string;
  "@_type": string;
}

interface BsSelectionEntry {
  "@_id": string;
  "@_name": string;
  "@_type": string;
  costs?: { cost?: Array<{ "@_name": string; "@_value": string }> };
  categoryLinks?: { categoryLink?: Array<{ "@_id": string; "@_targetId": string }> };
  entryLinks?: { entryLink?: BsEntryLink[] };
  selectionEntryGroups?: {
    selectionEntryGroup?: Array<{
      "@_name": string;
      selectionEntries?: {
        selectionEntry?: Array<{
          "@_id": string;
          "@_name": string;
          profiles?: { profileRef?: Array<{ "@_targetId": string }> };
        }>;
      };
    }>;
  };
  profiles?: { profileRef?: Array<{ "@_targetId": string }> };
}

interface BsCatalogue {
  catalogue?: {
    sharedProfiles?: { profile?: BsProfile[] };
    sharedSelectionEntries?: { selectionEntry?: BsSelectionEntry[] };
  };
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
function findCharacteristic(
  chars: BsCharacteristic[],
  name: string
): string {
  const found = chars.find(
    (c) => c["@_name"].toUpperCase() === name.toUpperCase()
  );
  const val = found?.["#text"];
  return val !== undefined ? String(val).trim() : "";
}

function buildProfileIndex(
  profiles: BsProfile[]
): Map<string, BsProfile> {
  const map = new Map<string, BsProfile>();
  for (const p of profiles) {
    map.set(p["@_id"], p);
  }
  return map;
}

function extractWeaponFromProfile(profile: BsProfile): RawEntry["weapons"][number] {
  const chars = profile.characteristics?.characteristic ?? [];
  const type = findCharacteristic(chars, "Type");
  const skill =
    type === "melee"
      ? findCharacteristic(chars, "WS")
      : findCharacteristic(chars, "BS");
  const keywordsRaw = findCharacteristic(chars, "Keywords");
  const keywords = keywordsRaw
    ? keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean)
    : [];
  return {
    id: profile["@_id"],
    name: profile["@_name"],
    type,
    range: type === "ranged" ? findCharacteristic(chars, "Range") : undefined,
    attacks: findCharacteristic(chars, "A"),
    skill,
    strength: findCharacteristic(chars, "S"),
    armorPenetration: findCharacteristic(chars, "AP"),
    damage: findCharacteristic(chars, "D"),
    keywords,
  };
}

function extractAbilityFromProfile(
  profile: BsProfile
): RawEntry["abilities"][number] {
  const chars = profile.characteristics?.characteristic ?? [];
  const description = findCharacteristic(chars, "Description");
  return {
    id: profile["@_id"],
    name: profile["@_name"],
    description: description.replace(/\s+/g, " ").trim(),
  };
}

function extractUnitFromProfile(profile: BsProfile): RawEntry["stats"] {
  const chars = profile.characteristics?.characteristic ?? [];
  return {
    movement: findCharacteristic(chars, "M"),
    toughness: findCharacteristic(chars, "T"),
    save: findCharacteristic(chars, "SV"),
    wounds: findCharacteristic(chars, "W"),
    leadership: findCharacteristic(chars, "LD"),
    objectiveControl: findCharacteristic(chars, "OC"),
  };
}

// ---------------------------------------------------------------------------
// Main extraction logic
// ---------------------------------------------------------------------------
function extractCatalogue(xml: string): RawEntry[] {
  const parsed = parser.parse(xml) as BsCatalogue;
  const catalogue = parsed.catalogue;
  if (!catalogue) return [];

  const allProfiles = catalogue.sharedProfiles?.profile ?? [];
  const profileIndex = buildProfileIndex(allProfiles);

  const entries: RawEntry[] = [];

  for (const entry of catalogue.sharedSelectionEntries?.selectionEntry ?? []) {
    if (entry["@_type"] !== "unit") continue;

    // Find the unit stats profile referenced directly or via profileRef
    const unitProfileRefs = entry.profiles?.profileRef ?? [];
    let statsProfile: BsProfile | undefined;
    for (const ref of unitProfileRefs) {
      const p = profileIndex.get(ref["@_targetId"]);
      if (p?.["@_typeName"] === "Unit") {
        statsProfile = p;
        break;
      }
    }

    // Fall back: look for a profile whose id matches by convention
    if (!statsProfile) {
      for (const p of allProfiles) {
        if (p["@_typeName"] === "Unit" && p["@_name"] === entry["@_name"]) {
          statsProfile = p;
          break;
        }
      }
    }

    if (!statsProfile) continue;

    const stats = extractUnitFromProfile(statsProfile);

    // Collect weapons referenced in selectionEntryGroups
    const weapons: RawEntry["weapons"] = [];
    for (const group of entry.selectionEntryGroups?.selectionEntryGroup ?? []) {
      for (const subEntry of group.selectionEntries?.selectionEntry ?? []) {
        const refs = subEntry.profiles?.profileRef ?? [];
        for (const ref of refs) {
          const p = profileIndex.get(ref["@_targetId"]);
          if (p?.["@_typeName"] === "Weapon") {
            weapons.push(extractWeaponFromProfile(p));
          }
        }
      }
    }

    // Collect abilities from entryLinks (type="profile")
    const abilities: RawEntry["abilities"] = [];
    for (const link of entry.entryLinks?.entryLink ?? []) {
      if (link["@_type"] === "profile") {
        const p = profileIndex.get(link["@_targetId"]);
        if (p?.["@_typeName"] === "Ability") {
          abilities.push(extractAbilityFromProfile(p));
        }
      }
    }

    // Points cost
    const costEntry = entry.costs?.cost?.find((c) => c["@_name"] === "pts");
    const pointsCost = costEntry ? costEntry["@_value"] : undefined;

    // Keywords come from category names (faction-related ones)
    const keywords: string[] = [];

    const rawEntry: RawEntry = {
      id: entry["@_id"],
      name: entry["@_name"],
      faction: "Adeptus Mechanicus",
      keywords,
      stats,
      weapons,
      abilities,
      pointsCost,
    };

    entries.push(rawEntry);
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function run(): void {
  const extensions = new Set([".xml", ".cat"]);
  const files = readdirSync(SOURCE_DIR).filter((f) =>
    extensions.has(extname(f).toLowerCase())
  );

  if (files.length === 0) {
    console.warn(
      `[step1-extract] No XML/CAT files found in ${SOURCE_DIR}. Skipping.`
    );
    return;
  }

  const allEntries: RawEntry[] = [];

  for (const file of files) {
    const filePath = join(SOURCE_DIR, file);
    console.log(`[step1-extract] Parsing ${file}…`);
    const xml = readFileSync(filePath, "utf-8");
    const entries = extractCatalogue(xml);
    console.log(`[step1-extract]   → ${entries.length} unit(s) found`);
    allEntries.push(...entries);
  }

  mkdirSync(EXTRACTED_DIR, { recursive: true });
  const outPath = join(EXTRACTED_DIR, "raw.json");
  writeFileSync(outPath, JSON.stringify(allEntries, null, 2), "utf-8");
  console.log(
    `[step1-extract] Wrote ${allEntries.length} entries to ${outPath}`
  );
}

run();
