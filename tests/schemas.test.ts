import { describe, it, expect } from "vitest";
import {
  UnitStatsSchema,
  WeaponProfileSchema,
  AbilitySchema,
  UnitSchema,
  DatasetSchema,
  ManualOverrideSchema,
  RawEntrySchema,
} from "../src/schemas/index.js";

// ---------------------------------------------------------------------------
// UnitStats
// ---------------------------------------------------------------------------
describe("UnitStatsSchema", () => {
  const valid = {
    movement: '6"',
    toughness: 4,
    save: "2+",
    wounds: 5,
    leadership: "5+",
    objectiveControl: 1,
  };

  it("accepts valid stats", () => {
    expect(UnitStatsSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects non-plus-format save", () => {
    expect(UnitStatsSchema.safeParse({ ...valid, save: "2" }).success).toBe(
      false
    );
  });

  it("rejects negative toughness", () => {
    expect(
      UnitStatsSchema.safeParse({ ...valid, toughness: -1 }).success
    ).toBe(false);
  });

  it("rejects negative wounds", () => {
    expect(UnitStatsSchema.safeParse({ ...valid, wounds: 0 }).success).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// WeaponProfile
// ---------------------------------------------------------------------------
describe("WeaponProfileSchema", () => {
  const validRanged = {
    id: "wpn-1",
    name: "Radium Carbine",
    type: "ranged" as const,
    range: '18"',
    attacks: "3",
    ballisticOrWeaponSkill: "4+",
    strength: 3,
    armorPenetration: 0,
    damage: "1",
    keywords: ["Rapid Fire 1"],
  };

  const validMelee = {
    id: "wpn-2",
    name: "Servo-arm",
    type: "melee" as const,
    attacks: "1",
    ballisticOrWeaponSkill: "4+",
    strength: 6,
    armorPenetration: -2,
    damage: "2",
    keywords: [],
  };

  it("accepts valid ranged weapon", () => {
    expect(WeaponProfileSchema.safeParse(validRanged).success).toBe(true);
  });

  it("accepts valid melee weapon without range", () => {
    expect(WeaponProfileSchema.safeParse(validMelee).success).toBe(true);
  });

  it("rejects positive armorPenetration", () => {
    expect(
      WeaponProfileSchema.safeParse({ ...validRanged, armorPenetration: 1 })
        .success
    ).toBe(false);
  });

  it("rejects invalid weapon type", () => {
    expect(
      WeaponProfileSchema.safeParse({ ...validRanged, type: "artillery" })
        .success
    ).toBe(false);
  });

  it("rejects zero strength", () => {
    expect(
      WeaponProfileSchema.safeParse({ ...validRanged, strength: 0 }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ability
// ---------------------------------------------------------------------------
describe("AbilitySchema", () => {
  const valid = {
    id: "ab-1",
    name: "Doctrina Imperatives",
    description: "Choose a doctrine.",
  };

  it("accepts valid ability", () => {
    expect(AbilitySchema.safeParse(valid).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(AbilitySchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects empty description", () => {
    expect(
      AbilitySchema.safeParse({ ...valid, description: "" }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------
describe("UnitSchema", () => {
  const validUnit = {
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
    abilities: [],
    pointsCost: 95,
  };

  it("accepts a valid unit", () => {
    expect(UnitSchema.safeParse(validUnit).success).toBe(true);
  });

  it("accepts a unit without optional fields", () => {
    const { pointsCost: _, notes: __, ...rest } = { ...validUnit, notes: undefined };
    expect(UnitSchema.safeParse(rest).success).toBe(true);
  });

  it("rejects empty id", () => {
    expect(UnitSchema.safeParse({ ...validUnit, id: "" }).success).toBe(false);
  });

  it("rejects empty faction", () => {
    expect(UnitSchema.safeParse({ ...validUnit, faction: "" }).success).toBe(
      false
    );
  });
});

// ---------------------------------------------------------------------------
// ManualOverride
// ---------------------------------------------------------------------------
describe("ManualOverrideSchema", () => {
  it("accepts minimal override (id only)", () => {
    expect(ManualOverrideSchema.safeParse({ id: "tpd" }).success).toBe(true);
  });

  it("accepts full override", () => {
    const override = {
      id: "tpd",
      notes: "Great HQ",
      pointsCost: 95,
      keywords: ["Infantry", "Character"],
      abilities: [
        { id: "ab-1", name: "Ability", description: "Does something." },
      ],
    };
    expect(ManualOverrideSchema.safeParse(override).success).toBe(true);
  });

  it("rejects empty id", () => {
    expect(ManualOverrideSchema.safeParse({ id: "" }).success).toBe(false);
  });

  it("rejects negative pointsCost", () => {
    expect(
      ManualOverrideSchema.safeParse({ id: "tpd", pointsCost: -1 }).success
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RawEntry
// ---------------------------------------------------------------------------
describe("RawEntrySchema", () => {
  const valid = {
    id: "tpd",
    name: "Tech-Priest Dominus",
    faction: "Adeptus Mechanicus",
    keywords: [],
    stats: {
      movement: '6"',
      toughness: "4",
      save: "2+",
      wounds: "5",
      leadership: "5+",
      objectiveControl: "1",
    },
    weapons: [],
    abilities: [],
    pointsCost: "95",
  };

  it("accepts valid raw entry", () => {
    expect(RawEntrySchema.safeParse(valid).success).toBe(true);
  });

  it("accepts raw entry without pointsCost", () => {
    const { pointsCost: _, ...rest } = valid;
    expect(RawEntrySchema.safeParse(rest).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dataset
// ---------------------------------------------------------------------------
describe("DatasetSchema", () => {
  const validDataset = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    units: [],
  };

  it("accepts valid empty dataset", () => {
    expect(DatasetSchema.safeParse(validDataset).success).toBe(true);
  });

  it("rejects invalid datetime", () => {
    expect(
      DatasetSchema.safeParse({ ...validDataset, generatedAt: "not-a-date" })
        .success
    ).toBe(false);
  });

  it("rejects empty version", () => {
    expect(
      DatasetSchema.safeParse({ ...validDataset, version: "" }).success
    ).toBe(false);
  });
});
