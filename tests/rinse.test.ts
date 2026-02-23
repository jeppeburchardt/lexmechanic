import { describe, it, expect } from "vitest";
import { type RawEntry, type Unit, UnitSchema } from "../src/schemas/index.js";

// ---------------------------------------------------------------------------
// Replicated rinse helpers (tested in isolation)
// ---------------------------------------------------------------------------
function normaliseMovement(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.endsWith('"') ? trimmed : `${trimmed}"`;
}

function parsePositiveInt(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseNonNegativeInt(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseAP(raw: string): number | null {
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) && n <= 0 ? n : null;
}

function normalisePlusStat(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d+\+$/.test(trimmed)) return trimmed;
  if (/^\d+$/.test(trimmed)) return `${trimmed}+`;
  return null;
}

type RawWeapon = RawEntry["weapons"][number];
type RinsedWeapon = Unit["weapons"][number];

function rinseWeapon(raw: RawWeapon): RinsedWeapon | null {
  const type = raw.type === "melee" ? ("melee" as const) : ("ranged" as const);
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

// ---------------------------------------------------------------------------
// Tests for normalisation helpers
// ---------------------------------------------------------------------------
describe("normaliseMovement", () => {
  it("keeps movement that already has a quote", () => {
    expect(normaliseMovement('6"')).toBe('6"');
  });

  it('appends " to bare number', () => {
    expect(normaliseMovement("6")).toBe('6"');
  });

  it("trims whitespace", () => {
    expect(normaliseMovement('  8"  ')).toBe('8"');
  });
});

describe("normalisePlusStat", () => {
  it("keeps stats already in plus format", () => {
    expect(normalisePlusStat("5+")).toBe("5+");
  });

  it("appends + to bare number", () => {
    expect(normalisePlusStat("5")).toBe("5+");
  });

  it("returns null for non-numeric input", () => {
    expect(normalisePlusStat("N/A")).toBeNull();
  });
});

describe("parsePositiveInt", () => {
  it("parses a positive integer string", () => {
    expect(parsePositiveInt("4")).toBe(4);
  });

  it("returns null for zero", () => {
    expect(parsePositiveInt("0")).toBeNull();
  });

  it("returns null for negative value", () => {
    expect(parsePositiveInt("-1")).toBeNull();
  });

  it("returns null for non-numeric", () => {
    expect(parsePositiveInt("N/A")).toBeNull();
  });
});

describe("parseAP", () => {
  it("parses zero AP", () => {
    expect(parseAP("0")).toBe(0);
  });

  it("parses negative AP", () => {
    expect(parseAP("-2")).toBe(-2);
  });

  it("returns null for positive AP", () => {
    expect(parseAP("1")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rinseWeapon
// ---------------------------------------------------------------------------
describe("rinseWeapon", () => {
  const rawRanged: RawWeapon = {
    id: "wpn-1",
    name: "  Radium Carbine  ",
    type: "ranged",
    range: '18"',
    attacks: "3",
    skill: "4+",
    strength: "3",
    armorPenetration: "0",
    damage: "1",
    keywords: ["Rapid Fire 1"],
  };

  const rawMelee: RawWeapon = {
    id: "wpn-2",
    name: "Servo-arm",
    type: "melee",
    attacks: "1",
    skill: "4+",
    strength: "6",
    armorPenetration: "-2",
    damage: "2",
    keywords: [],
  };

  it("rinses a ranged weapon correctly", () => {
    const result = rinseWeapon(rawRanged);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Radium Carbine");
    expect(result?.strength).toBe(3);
    expect(result?.armorPenetration).toBe(0);
    expect(result?.type).toBe("ranged");
  });

  it("rinses a melee weapon correctly", () => {
    const result = rinseWeapon(rawMelee);
    expect(result).not.toBeNull();
    expect(result?.armorPenetration).toBe(-2);
    expect(result?.type).toBe("melee");
    expect(result?.range).toBeUndefined();
  });

  it("returns null when strength is invalid", () => {
    expect(rinseWeapon({ ...rawRanged, strength: "N/A" })).toBeNull();
  });

  it("returns null when AP is positive", () => {
    expect(rinseWeapon({ ...rawRanged, armorPenetration: "2" })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Full unit rinse via Zod validation
// ---------------------------------------------------------------------------
describe("step2-rinse: unit conversion", () => {
  const validUnit: Unit = {
    id: "tpd",
    name: "Tech-Priest Dominus",
    faction: "Adeptus Mechanicus",
    keywords: ["Infantry", "Character"],
    stats: {
      movement: '6"',
      toughness: 4,
      save: "2+",
      wounds: 5,
      leadership: "5+",
      objectiveControl: 1,
    },
    weapons: [],
    abilities: [
      {
        id: "ab-1",
        name: "Bionics",
        description: "This unit has a 6+ invulnerable save.",
      },
    ],
    pointsCost: 95,
  };

  it("validates a rinsed unit with Zod", () => {
    const result = UnitSchema.safeParse(validUnit);
    expect(result.success).toBe(true);
  });

  it("rinsed unit fails if save is in wrong format", () => {
    const bad = { ...validUnit, stats: { ...validUnit.stats, save: "2" } };
    expect(UnitSchema.safeParse(bad).success).toBe(false);
  });
});
