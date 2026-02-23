import { describe, it, expect } from "vitest";
import { type Unit, type ManualOverride, UnitSchema } from "../src/schemas/index.js";

// ---------------------------------------------------------------------------
// Replicated merge logic (tested in isolation)
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
// Fixtures
// ---------------------------------------------------------------------------
const baseUnit: Unit = {
  id: "tpd",
  name: "Tech-Priest Dominus",
  faction: "Adeptus Mechanicus",
  keywords: ["Infantry"],
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
  pointsCost: 90,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("applyOverride", () => {
  it("overwrites notes when present in override", () => {
    const override: ManualOverride = { id: "tpd", notes: "Great choice" };
    const result = applyOverride(baseUnit, override);
    expect(result.notes).toBe("Great choice");
  });

  it("keeps existing notes when not in override", () => {
    const unitWithNotes: Unit = { ...baseUnit, notes: "Original note" };
    const override: ManualOverride = { id: "tpd", pointsCost: 95 };
    const result = applyOverride(unitWithNotes, override);
    expect(result.notes).toBe("Original note");
  });

  it("overwrites pointsCost when present in override", () => {
    const override: ManualOverride = { id: "tpd", pointsCost: 95 };
    const result = applyOverride(baseUnit, override);
    expect(result.pointsCost).toBe(95);
  });

  it("keeps existing pointsCost when not in override", () => {
    const override: ManualOverride = { id: "tpd", notes: "Note" };
    const result = applyOverride(baseUnit, override);
    expect(result.pointsCost).toBe(90);
  });

  it("overwrites keywords when present in override", () => {
    const override: ManualOverride = {
      id: "tpd",
      keywords: ["Infantry", "Character", "Epic Hero"],
    };
    const result = applyOverride(baseUnit, override);
    expect(result.keywords).toEqual(["Infantry", "Character", "Epic Hero"]);
  });

  it("keeps existing keywords when not in override", () => {
    const override: ManualOverride = { id: "tpd", notes: "Note" };
    const result = applyOverride(baseUnit, override);
    expect(result.keywords).toEqual(["Infantry"]);
  });

  it("overwrites abilities when present in override", () => {
    const newAbility = {
      id: "ab-new",
      name: "Lords of the Mechanicus",
      description: "Re-roll hit rolls of 1 for nearby units.",
    };
    const override: ManualOverride = {
      id: "tpd",
      abilities: [newAbility],
    };
    const result = applyOverride(baseUnit, override);
    expect(result.abilities).toHaveLength(1);
    expect(result.abilities[0]?.name).toBe("Lords of the Mechanicus");
  });

  it("keeps existing abilities when not in override", () => {
    const unitWithAbilities: Unit = {
      ...baseUnit,
      abilities: [
        { id: "ab-1", name: "Bionics", description: "6+ invulnerable save." },
      ],
    };
    const override: ManualOverride = { id: "tpd", notes: "Note" };
    const result = applyOverride(unitWithAbilities, override);
    expect(result.abilities).toHaveLength(1);
  });

  it("merged result passes Zod validation", () => {
    const override: ManualOverride = {
      id: "tpd",
      notes: "Essential HQ",
      pointsCost: 95,
      keywords: ["Infantry", "Character", "Epic Hero", "Tech-Priest", "Dominus"],
      abilities: [
        {
          id: "ab-lords",
          name: "Lords of the Mechanicus",
          description: "Re-roll hit rolls of 1.",
        },
      ],
    };
    const merged = applyOverride(baseUnit, override);
    const result = UnitSchema.safeParse(merged);
    expect(result.success).toBe(true);
  });
});

describe("step3-merge: merge strategy edge cases", () => {
  it("empty override (id only) leaves unit unchanged", () => {
    const override: ManualOverride = { id: "tpd" };
    const result = applyOverride(baseUnit, override);
    expect(result).toMatchObject({
      id: baseUnit.id,
      keywords: baseUnit.keywords,
      abilities: baseUnit.abilities,
      pointsCost: baseUnit.pointsCost,
    });
  });

  it("undefined abilities in override preserves unit abilities", () => {
    const unitWithAbilities: Unit = {
      ...baseUnit,
      abilities: [{ id: "a1", name: "Test", description: "Desc" }],
    };
    const override: ManualOverride = { id: "tpd", notes: "Note" };
    const result = applyOverride(unitWithAbilities, override);
    expect(result.abilities).toHaveLength(1);
  });

  it("empty abilities array in override clears abilities", () => {
    const unitWithAbilities: Unit = {
      ...baseUnit,
      abilities: [{ id: "a1", name: "Test", description: "Desc" }],
    };
    const override: ManualOverride = { id: "tpd", abilities: [] };
    const result = applyOverride(unitWithAbilities, override);
    expect(result.abilities).toHaveLength(0);
  });
});
