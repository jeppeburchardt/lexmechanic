/**
 * Step 1 – Extract
 *
 * Reads XML source files from data/source/ and converts them into a
 * normalised intermediate JSON format stored in data/extracted/raw.json.
 *
 * Supported XML schema: Battlescribe catalogue format (*.xml / *.cat).
 *
 * This implementation uses camaro (XPath-based) for declarative XML transformation
 * of profiles, combined with DOM parsing for complex nested structures.
 */

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "camaro";
import { XMLParser } from "fast-xml-parser";
import { type RawEntry } from "../schemas/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const SOURCE_DIR = join(__dirname, "../../data/source");
const EXTRACTED_DIR = join(__dirname, "../../data/extracted");

// ---------------------------------------------------------------------------
// XML parser for nested structures
// ---------------------------------------------------------------------------
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    [
      "selectionEntry",
      "selectionEntryGroup",
      "profileRef",
      "entryLink",
    ].includes(name),
});

// ---------------------------------------------------------------------------
// XPath templates for extracting profiles (declarative)
// ---------------------------------------------------------------------------

const profilesTemplate = {
  unitProfiles: [
    '//sharedProfiles/profile[@typeName="Unit"]',
    {
      id: "@id",
      name: "@name",
      movement: 'characteristics/characteristic[@name="M"]',
      toughness: 'characteristics/characteristic[@name="T"]',
      save: 'characteristics/characteristic[@name="SV"]',
      wounds: 'characteristics/characteristic[@name="W"]',
      leadership: 'characteristics/characteristic[@name="LD"]',
      objectiveControl: 'characteristics/characteristic[@name="OC"]',
    },
  ],
  weaponProfiles: [
    '//sharedProfiles/profile[@typeName="Weapon"]',
    {
      id: "@id",
      name: "@name",
      type: 'characteristics/characteristic[@name="Type"]',
      range: 'characteristics/characteristic[@name="Range"]',
      attacks: 'characteristics/characteristic[@name="A"]',
      ballisticSkill: 'characteristics/characteristic[@name="BS"]',
      weaponSkill: 'characteristics/characteristic[@name="WS"]',
      strength: 'characteristics/characteristic[@name="S"]',
      armorPenetration: 'characteristics/characteristic[@name="AP"]',
      damage: 'characteristics/characteristic[@name="D"]',
      keywords: 'characteristics/characteristic[@name="Keywords"]',
    },
  ],
  abilityProfiles: [
    '//sharedProfiles/profile[@typeName="Ability"]',
    {
      id: "@id",
      name: "@name",
      description: 'characteristics/characteristic[@name="Description"]',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helper types and functions for DOM parsing
// ---------------------------------------------------------------------------

interface ProfileData {
  unitProfiles: Array<{
    id: string;
    movement: string;
    toughness: string;
    save: string;
    wounds: string;
    leadership: string;
    objectiveControl: string;
  }>;
  weaponProfiles: Array<{
    id: string;
    name: string;
    type: string;
    range?: string;
    attacks: string;
    ballisticSkill?: string;
    weaponSkill?: string;
    strength: string;
    armorPenetration: string;
    damage: string;
    keywords?: string;
  }>;
  abilityProfiles: Array<{
    id: string;
    name: string;
    description: string;
  }>;
}

/**
 * Extracts units using DOM parsing for complex nested structures
 */
function extractUnitsDOM(
  xml: string,
  profiles: ProfileData
): RawEntry[] {
  const parsed = parser.parse(xml) as any;
  const catalogue = parsed.catalogue;
  if (!catalogue) return [];

  // Build profile lookup maps
  const unitProfileMap = new Map(profiles.unitProfiles.map((p) => [p.id, p]));
  const weaponProfileMap = new Map(profiles.weaponProfiles.map((p) => [p.id, p]));
  const abilityProfileMap = new Map(profiles.abilityProfiles.map((p) => [p.id, p]));

  const entries: RawEntry[] = [];
  const selectionEntries = catalogue.sharedSelectionEntries?.selectionEntry ?? [];

  for (const entry of selectionEntries) {
    if (entry["@_type"] !== "unit") continue;

    // Get unit profile reference
    const unitProfileRef = entry.profiles?.profileRef?.[0]?.["@_targetId"];
    const unitProfile = unitProfileMap.get(unitProfileRef);

    const stats = unitProfile
      ? {
          movement: unitProfile.movement || "",
          toughness: unitProfile.toughness || "",
          save: unitProfile.save || "",
          wounds: unitProfile.wounds || "",
          leadership: unitProfile.leadership || "",
          objectiveControl: unitProfile.objectiveControl || "",
        }
      : {
          movement: "",
          toughness: "",
          save: "",
          wounds: "",
          leadership: "",
          objectiveControl: "",
        };

    // Extract weapon references from selectionEntryGroups
    const weapons: RawEntry["weapons"] = [];
    const groups = entry.selectionEntryGroups?.selectionEntryGroup ?? [];
    for (const group of groups) {
      const subEntries = group.selectionEntries?.selectionEntry ?? [];
      for (const subEntry of subEntries) {
        const weaponRefs = subEntry.profiles?.profileRef ?? [];
        for (const ref of weaponRefs) {
          const weaponId = ref["@_targetId"];
          const profile = weaponProfileMap.get(weaponId);
          if (profile) {
            const skill =
              profile.type === "melee"
                ? profile.weaponSkill || ""
                : profile.ballisticSkill || "";

            const keywordsStr = profile.keywords || "";
            const keywords = keywordsStr
              ? keywordsStr.split(",").map((k) => k.trim()).filter(Boolean)
              : [];

            weapons.push({
              id: profile.id,
              name: profile.name,
              type: profile.type || "",
              range: profile.type === "ranged" ? profile.range : undefined,
              attacks: profile.attacks || "",
              skill,
              strength: profile.strength || "",
              armorPenetration: profile.armorPenetration || "",
              damage: profile.damage || "",
              keywords,
            });
          }
        }
      }
    }

    // Extract ability references from entryLinks
    const abilities: RawEntry["abilities"] = [];
    const links = entry.entryLinks?.entryLink ?? [];
    for (const link of links) {
      if (link["@_type"] === "profile") {
        const abilityId = link["@_targetId"];
        const profile = abilityProfileMap.get(abilityId);
        if (profile) {
          abilities.push({
            id: profile.id,
            name: profile.name,
            description: profile.description.replace(/\s+/g, " ").trim(),
          });
        }
      }
    }

    // Extract points cost
    const costs = Array.isArray(entry.costs?.cost)
      ? entry.costs.cost
      : entry.costs?.cost
      ? [entry.costs.cost]
      : [];
    const ptsCost = costs.find((c: any) => c["@_name"] === "pts");
    const pointsCost = ptsCost ? ptsCost["@_value"] : undefined;

    entries.push({
      id: entry["@_id"],
      name: entry["@_name"],
      faction: "Adeptus Mechanicus",
      keywords: [],
      stats,
      weapons,
      abilities,
      pointsCost,
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Main extraction logic
// ---------------------------------------------------------------------------

async function extractCatalogue(xml: string): Promise<RawEntry[]> {
  // Extract profiles using declarative XPath templates
  const profiles: ProfileData = await transform(xml, profilesTemplate);

  // Extract units using DOM parsing (for complex nested structures)
  return extractUnitsDOM(xml, profiles);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
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
    const entries = await extractCatalogue(xml);
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

run().catch((err) => {
  console.error("[step1-extract] Fatal error:", err);
  process.exit(1);
});
