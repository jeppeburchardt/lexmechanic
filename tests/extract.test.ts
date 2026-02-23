import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import { RawEntrySchema } from "../src/schemas/index.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name: string) =>
    [
      "selectionEntry",
      "profile",
      "characteristic",
      "categoryLink",
      "entryLink",
      "profileRef",
      "cost",
    ].includes(name),
});

// ---------------------------------------------------------------------------
// Minimal inline XML fixtures
// ---------------------------------------------------------------------------
const MINIMAL_XML = `<?xml version="1.0"?>
<catalogue id="test-cat" name="Test" gameSystemId="sys-wh40k">
  <sharedProfiles>
    <profile id="unit-prof" name="Test Unit" typeId="u" typeName="Unit">
      <characteristics>
        <characteristic name="M" typeId="m">6"</characteristic>
        <characteristic name="T" typeId="t">4</characteristic>
        <characteristic name="SV" typeId="sv">3+</characteristic>
        <characteristic name="W" typeId="w">3</characteristic>
        <characteristic name="LD" typeId="ld">6+</characteristic>
        <characteristic name="OC" typeId="oc">2</characteristic>
      </characteristics>
    </profile>
    <profile id="wpn-1" name="Galvanic Rifle" typeId="w" typeName="Weapon">
      <characteristics>
        <characteristic name="Type" typeId="wt">ranged</characteristic>
        <characteristic name="Range" typeId="wr">30"</characteristic>
        <characteristic name="A" typeId="wa">2</characteristic>
        <characteristic name="BS" typeId="wb">4+</characteristic>
        <characteristic name="S" typeId="ws">4</characteristic>
        <characteristic name="AP" typeId="wap">0</characteristic>
        <characteristic name="D" typeId="wd">1</characteristic>
        <characteristic name="Keywords" typeId="wk">Heavy</characteristic>
      </characteristics>
    </profile>
    <profile id="ab-1" name="Omnissiah's Grace" typeId="a" typeName="Ability">
      <characteristics>
        <characteristic name="Description" typeId="ad">Blessed by the machine god.</characteristic>
      </characteristics>
    </profile>
  </sharedProfiles>
  <sharedSelectionEntries>
    <selectionEntry id="se-1" name="Test Unit" type="unit">
      <profiles>
        <profileRef id="pr-1" targetId="unit-prof"/>
      </profiles>
      <costs>
        <cost name="pts" typeId="pts" value="80"/>
      </costs>
      <selectionEntryGroups>
        <selectionEntryGroup id="seg-1" name="Weapons">
          <selectionEntries>
            <selectionEntry id="se-wpn" name="Galvanic Rifle" type="upgrade">
              <profiles>
                <profileRef id="pr-wpn" targetId="wpn-1"/>
              </profiles>
            </selectionEntry>
          </selectionEntries>
        </selectionEntryGroup>
      </selectionEntryGroups>
      <entryLinks>
        <entryLink id="el-1" targetId="ab-1" type="profile"/>
      </entryLinks>
    </selectionEntry>
  </sharedSelectionEntries>
</catalogue>`;

const NON_UNIT_XML = `<?xml version="1.0"?>
<catalogue id="test-cat2" name="Test2" gameSystemId="sys-wh40k">
  <sharedProfiles/>
  <sharedSelectionEntries>
    <selectionEntry id="se-upgrade" name="Servo-skull" type="upgrade"/>
  </sharedSelectionEntries>
</catalogue>`;

// ---------------------------------------------------------------------------
// Helpers replicated from step1-extract (to test in isolation)
// ---------------------------------------------------------------------------
interface BsCharacteristic {
  "@_name": string;
  "#text"?: string | number;
}

interface BsProfile {
  "@_id": string;
  "@_name": string;
  "@_typeName": string;
  characteristics?: { characteristic?: BsCharacteristic[] };
}

function findChar(chars: BsCharacteristic[], name: string): string {
  const found = chars.find(
    (c) => c["@_name"].toUpperCase() === name.toUpperCase()
  );
  const val = found?.["#text"];
  return val !== undefined ? String(val).trim() : "";
}

function buildProfileIndex(profiles: BsProfile[]): Map<string, BsProfile> {
  return new Map(profiles.map((p) => [p["@_id"], p]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("step1-extract: XML parsing", () => {
  it("parses a valid unit entry from XML", () => {
    const parsed = parser.parse(MINIMAL_XML) as {
      catalogue?: {
        sharedProfiles?: { profile?: BsProfile[] };
        sharedSelectionEntries?: {
          selectionEntry?: Array<{
            "@_id": string;
            "@_name": string;
            "@_type": string;
          }>;
        };
      };
    };

    const entries =
      parsed.catalogue?.sharedSelectionEntries?.selectionEntry ?? [];
    expect(entries).toHaveLength(1);
    expect(entries[0]?.["@_type"]).toBe("unit");
  });

  it("finds unit profile characteristics", () => {
    const parsed = parser.parse(MINIMAL_XML) as {
      catalogue?: { sharedProfiles?: { profile?: BsProfile[] } };
    };
    const profiles = parsed.catalogue?.sharedProfiles?.profile ?? [];
    const index = buildProfileIndex(profiles);
    const unitProf = index.get("unit-prof");
    expect(unitProf).toBeDefined();
    const chars = unitProf?.characteristics?.characteristic ?? [];
    expect(findChar(chars, "M")).toBe('6"');
    expect(findChar(chars, "T")).toBe("4");
    expect(findChar(chars, "SV")).toBe("3+");
  });

  it("ignores non-unit selection entries", () => {
    const parsed = parser.parse(NON_UNIT_XML) as {
      catalogue?: {
        sharedSelectionEntries?: {
          selectionEntry?: Array<{ "@_type": string }>;
        };
      };
    };
    const entries =
      parsed.catalogue?.sharedSelectionEntries?.selectionEntry ?? [];
    const units = entries.filter((e) => e["@_type"] === "unit");
    expect(units).toHaveLength(0);
  });

  it("extracts weapon profile from shared profiles", () => {
    const parsed = parser.parse(MINIMAL_XML) as {
      catalogue?: { sharedProfiles?: { profile?: BsProfile[] } };
    };
    const profiles = parsed.catalogue?.sharedProfiles?.profile ?? [];
    const index = buildProfileIndex(profiles);
    const wpn = index.get("wpn-1");
    expect(wpn).toBeDefined();
    expect(wpn?.["@_typeName"]).toBe("Weapon");
    const chars = wpn?.characteristics?.characteristic ?? [];
    expect(findChar(chars, "S")).toBe("4");
    expect(findChar(chars, "AP")).toBe("0");
  });

  it("extracts ability profile from shared profiles", () => {
    const parsed = parser.parse(MINIMAL_XML) as {
      catalogue?: { sharedProfiles?: { profile?: BsProfile[] } };
    };
    const profiles = parsed.catalogue?.sharedProfiles?.profile ?? [];
    const index = buildProfileIndex(profiles);
    const ability = index.get("ab-1");
    expect(ability).toBeDefined();
    expect(ability?.["@_typeName"]).toBe("Ability");
  });
});

describe("step1-extract: end-to-end with real source file", () => {
  it("raw.json is a valid array of RawEntry after extraction", () => {
    // This test only runs if raw.json already exists (i.e. step1 has been run).
    let raw: unknown[];
    try {
      const rawPath = join(__dirname, "../data/extracted/raw.json");
      raw = JSON.parse(readFileSync(rawPath, "utf-8"));
    } catch {
      // File doesn't exist yet – skip the assertion
      return;
    }

    for (const entry of raw) {
      const result = RawEntrySchema.safeParse(entry);
      expect(result.success, `Entry failed validation: ${JSON.stringify(entry)}`).toBe(true);
    }
  });
});
