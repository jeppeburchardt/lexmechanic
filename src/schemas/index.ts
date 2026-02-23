import { z } from "zod";

// ---------------------------------------------------------------------------
// Unit stats (movement, toughness, save, wounds, leadership, objective control)
// ---------------------------------------------------------------------------
export const UnitStatsSchema = z.object({
  movement: z.string().min(1),
  toughness: z.number().int().positive(),
  save: z.string().regex(/^\d+\+$/, "Save must be in the form '2+', '3+', etc."),
  wounds: z.number().int().positive(),
  leadership: z.string().regex(/^\d+\+$/, "Leadership must be in the form '5+', '6+', etc."),
  objectiveControl: z.number().int().nonnegative(),
});

export type UnitStats = z.infer<typeof UnitStatsSchema>;

// ---------------------------------------------------------------------------
// Weapon profile
// ---------------------------------------------------------------------------
export const WeaponProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["ranged", "melee"]),
  range: z.string().optional(),
  attacks: z.string().min(1),
  ballisticOrWeaponSkill: z.string().min(1),
  strength: z.number().int().positive(),
  armorPenetration: z.number().int().nonpositive(),
  damage: z.string().min(1),
  keywords: z.array(z.string()),
});

export type WeaponProfile = z.infer<typeof WeaponProfileSchema>;

// ---------------------------------------------------------------------------
// Ability
// ---------------------------------------------------------------------------
export const AbilitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
});

export type Ability = z.infer<typeof AbilitySchema>;

// ---------------------------------------------------------------------------
// Fully validated Unit (output of Step 2 + 3)
// ---------------------------------------------------------------------------
export const UnitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  faction: z.string().min(1),
  keywords: z.array(z.string()),
  stats: UnitStatsSchema,
  weapons: z.array(WeaponProfileSchema),
  abilities: z.array(AbilitySchema),
  pointsCost: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type Unit = z.infer<typeof UnitSchema>;

// ---------------------------------------------------------------------------
// Raw extracted shapes (before rinse step, values may be strings from XML)
// ---------------------------------------------------------------------------
export const RawWeaponSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  range: z.string().optional(),
  attacks: z.string(),
  skill: z.string(),
  strength: z.string(),
  armorPenetration: z.string(),
  damage: z.string(),
  keywords: z.array(z.string()),
});

export type RawWeapon = z.infer<typeof RawWeaponSchema>;

export const RawEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  faction: z.string(),
  keywords: z.array(z.string()),
  stats: z.object({
    movement: z.string(),
    toughness: z.string(),
    save: z.string(),
    wounds: z.string(),
    leadership: z.string(),
    objectiveControl: z.string(),
  }),
  weapons: z.array(RawWeaponSchema),
  abilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
    })
  ),
  pointsCost: z.string().optional(),
});

export type RawEntry = z.infer<typeof RawEntrySchema>;

export const RawUnitSchema = RawEntrySchema;
export type RawUnit = RawEntry;

// ---------------------------------------------------------------------------
// Manual override shape (stored in data/manual/)
// ---------------------------------------------------------------------------
export const ManualOverrideSchema = z.object({
  id: z.string().min(1),
  notes: z.string().optional(),
  pointsCost: z.number().int().nonnegative().optional(),
  keywords: z.array(z.string()).optional(),
  abilities: z.array(AbilitySchema).optional(),
});

export type ManualOverride = z.infer<typeof ManualOverrideSchema>;

// ---------------------------------------------------------------------------
// Full dataset (output of Step 3, what the package exposes)
// ---------------------------------------------------------------------------
export const DatasetSchema = z.object({
  version: z.string().min(1),
  generatedAt: z.string().datetime(),
  units: z.array(UnitSchema),
});

export type Dataset = z.infer<typeof DatasetSchema>;
