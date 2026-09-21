# AI Builder MVP 0.4.2 — Dynamic Source Template Editor Design

## Contract

Dynamic rendering has two identities. `SOURCE_TEMPLATE` is the single UBJF Cell inside the DataHeader/DataBand UBTable and is editable. `RUNTIME_INSTANCE` is a viewer occurrence identified by `sourceId + bandId + rowIndex`; it is never edited as dataset data. A runtime click resolves through its source ID and band to the one source Cell. Missing or ambiguous resolution fails closed.

## Identity model

- Header: `UBDataHeaderBand → UBTable → Cell`.
- Detail: `UBDataBand(dataset) → UBTable(one source row) → Cell(dataSet,column)`.
- Runtime: `<cellId>_<bandId>_ROW<n>` and render instance key.
- Logical column: paired header/detail cells at the same column index.

No DOM text or screen coordinate is used to choose a source target.

## Mutation policy

- Header text/style mutates only the header source Cell.
- Detail text is unavailable when it is a binding expression; style mutates the detail template Cell.
- Width is a logical-column property. A width mutation updates both header/detail wrapper widths, both Cell widths, following-cell X positions, and both table widths.
- Dataset ID, column, binding expression, band/table/cell IDs and the one-row detail template remain unchanged.

All edits remain ordinary Source Patch history events. The history cursor selects the static or dynamic structural snapshot first; Unified Materializer then applies source edits to that snapshot. Thus array apply, dynamic edits, undo and redo remain one transaction timeline.

## Capability matrix

| Target | Text | Width | Height | Style | Binding | Move |
|---|---:|---:|---:|---:|---:|---:|
| Header Cell | YES | YES, paired | YES | YES | NO | LIMITED |
| Detail Template Cell | NO | YES, paired | YES | YES | READ | LIMITED |
| Runtime Detail Instance | REDIRECT | REDIRECT | REDIRECT | REDIRECT | READ | NO |
| Dynamic Table | NO | through columns | LIMITED | N/A | READ | LIMITED |

Manual array-field rebinding and generalized dynamic table movement are outside this MVP.

## Failure contract

The catalog includes `DYNAMIC_SOURCE_TARGET_NOT_FOUND`, `DYNAMIC_RUNTIME_INSTANCE_NOT_EDITABLE`, `DYNAMIC_TEMPLATE_RESOLUTION_FAILED`, `DYNAMIC_COLUMN_PAIRING_FAILED`, `DYNAMIC_EDIT_VALIDATION_FAILED`, and `DYNAMIC_EDIT_MATERIALIZATION_FAILED`. Pairing and atomic publish failures do not publish a candidate.
