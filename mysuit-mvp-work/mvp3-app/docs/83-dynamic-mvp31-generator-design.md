# Dynamic MVP 3.1 Generator Design

## Pipeline

```text
Manual Semantic Model
→ Semantic Validator
→ Dataset/Band/Binding/Aggregate/Page writers
→ explicit new Form root/page assembly
→ serialize/reparse
→ flatten guard
→ atomic dynamic_mvp31 project
```

The generator never clones the full `edu_01` Form. It reads `edu_01` as a protected source of individual Dataset, Band, Table, Cell, binding, and merge prototypes. A new root and page are assembled explicitly. All Band, Table, and Cell IDs are regenerated, membership references are rewritten, and the Ground Truth hash is asserted after generation.

`createImportedDataset()` emits `UBDmcUser`, maps Semantic columns, serializes rows as JSON, then zlib/Base64 encodes them. `writeDatasetBinding()` writes the proven dataset/column contract. Central expression writers translate Semantic SUM and page-number concepts into MySuit syntax.

Seven Band prototypes are independently cloned and ordered using the audited source order. The invisible GroupHeader references `employees.POSITION`; GroupFooter references the generated GroupHeader ID. Footer merged cells preserve the Ground Truth `colSpan: 5`, `MS`, and `MC` wrapper contract.

The flatten guard requires exactly one DataBand source row and six bound cells, while the embedded dataset contains 25 rows. It rejects a source detail row count equal to dataset cardinality.

Primitive maturity:

| Primitive | Maturity |
|---|---|
| Embedded Dataset | STABLE for `UBDmcUser` fixture |
| Seven Band assembly | LIMITED to audited order/contracts |
| Dataset Binding | STABLE for simple column binding |
| Single-column Group | LIMITED |
| SUM Aggregate | LIMITED to Group/Data Footer context |
| Page expression | LIMITED to `TOTAL_CURRENT` |
| Five-column merge | POC_ONLY |

Static Import files and services remain independent and unchanged in behavior.
