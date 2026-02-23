# LexMechanic

A strictly-typed npm package providing a curated dataset for the **Adeptus Mechanicus** faction from Warhammer 40,000.

Data is sourced from Battlescribe XML catalogue files, cleaned, and enriched with manually maintained overrides – all validated at build time with [Zod](https://zod.dev).

---

## Installation

```bash
npm install lexmechanic
```

---

## Usage

### TypeScript / JavaScript – typed API

```ts
import { loadDataset, type Unit } from "lexmechanic";

const dataset = loadDataset();
console.log(`${dataset.units.length} units loaded`);

dataset.units.forEach((unit: Unit) => {
  console.log(`${unit.name} – ${unit.pointsCost ?? "?"}pts`);
});
```

### JSON – language-agnostic

The built dataset is also available as a plain JSON file at `node_modules/lexmechanic/data/output/dataset.json`, making it usable from any language.

```json
{
  "version": "1.0.0",
  "generatedAt": "2026-02-23T…",
  "units": [ … ]
}
```

---

## Data Model

All types are inferred from Zod schemas (see [`src/schemas/index.ts`](src/schemas/index.ts)).

| Type | Description |
|---|---|
| `Dataset` | Top-level container (`version`, `generatedAt`, `units[]`) |
| `Unit` | A single unit with stats, weapons, abilities, and optional notes |
| `UnitStats` | Movement, toughness, save, wounds, leadership, objective control |
| `WeaponProfile` | Ranged or melee weapon with full stat line |
| `Ability` | Named ability with description |
| `ManualOverride` | Shape of entries in `data/manual/units.json` |

---

## Build Pipeline

The dataset is produced by a **three-step build pipeline**, each step runnable independently:

```bash
# Step 1 – Extract: parse XML source files → data/extracted/raw.json
npm run build:step1

# Step 2 – Rinse: clean & validate raw data → data/extracted/rinsed.json
npm run build:step2

# Step 3 – Merge: apply manual overrides → data/output/dataset.json
npm run build:step3

# Run all three steps in sequence
npm run build:data

# Also compile TypeScript type declarations
npm run build
```

### Step 1 – Extract (`src/build/step1-extract.ts`)

Reads all `.xml` / `.cat` files in `data/source/` and converts Battlescribe catalogue XML into a raw JSON structure (`data/extracted/raw.json`).

Place your own Battlescribe data files in `data/source/` and re-run `build:step1`.

### Step 2 – Rinse (`src/build/step2-rinse.ts`)

Applies TypeScript transformation functions to the raw JSON:
- Parses numeric strings into proper numbers
- Normalises movement (`6` → `6"`) and save/leadership (`5` → `5+`) formats
- Removes incomplete or invalid entries (logged as warnings)
- Validates every entry with Zod

### Step 3 – Merge (`src/build/step3-merge.ts`)

Reads `data/manual/units.json` and merges its entries into the rinsed data:
- Manual entries are matched by `id`
- Manual values take precedence over extracted values
- Scalar fields (`notes`, `pointsCost`) are overwritten if present
- Array fields (`keywords`, `abilities`) are replaced entirely if present
- Orphaned manual entries (no matching rinsed unit) produce a warning

---

## Adding / Updating Manual Data

Edit `data/manual/units.json`. Each entry must have an `id` that matches a unit extracted from the XML sources:

```json
[
  {
    "id": "tpd",
    "notes": "Essential HQ choice.",
    "pointsCost": 95,
    "keywords": ["Infantry", "Character", "Epic Hero", "Tech-Priest", "Dominus"],
    "abilities": [
      {
        "id": "ab-lords",
        "name": "Lords of the Mechanicus",
        "description": "Re-roll hit rolls of 1 for nearby friendly units."
      }
    ]
  }
]
```

Then re-run `npm run build:data` to regenerate `data/output/dataset.json`.

---

## Validation

All data is validated with [Zod](https://zod.dev) at every stage of the build pipeline. You can also use the exported schemas in your own code:

```ts
import { UnitSchema, DatasetSchema } from "lexmechanic";

const result = UnitSchema.safeParse(someData);
if (!result.success) {
  console.error(result.error.flatten());
}
```

---

## Development

```bash
# Install dependencies
npm install

# Run the full test suite (62 tests)
npm test

# TypeScript type check
npm run lint

# Run the full build (data + types)
npm run build
```

---

## License

BSD 2-Clause – see [LICENSE](LICENSE).
