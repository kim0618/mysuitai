# AI Builder MVP 0.4 Array Binding Design

## Scope

MVP 0.4 supports one top-level `Array<Object<Scalar>>` and one imported static `UBTable`. Nested, primitive, mixed, and schema-less empty arrays fail closed.

## Pipeline

1. `json-schema-analyzer` emits deterministic array models and explicit unsupported states.
2. `table-target-resolver` resolves stable source `UBTable` IDs and first-row headers.
3. `array-binding-matcher` scores table/header coverage, field coverage, alias/token matches, and column-count similarity.
4. `array-dataset-mapper` creates a deterministic `ai_<array-key>` embedded dataset and canonical column map.
5. Review state persists beside scalar proposals in the import context as `scalarProposals` and `arrayProposals`.
6. Confirm invokes one atomic static-to-dynamic transformation. The existing Dynamic MVP 3.1 dataset encoder, binding writer, and real band prototypes are reused.

## Safety policy

- AUTO requires confidence `>= 0.88`; ambiguous competing pairs are demoted to review.
- AUTO assignment is one table to one array.
- Every detail column must resolve before apply.
- Candidate construction occurs in a temporary project and publishes by rename only after parse-back validation.
- The source table is replaced with one header template and one detail template. Dataset row count never changes source detail row count.
- Source hashes are checked before publish and again on failure.

## Dynamic source contract

- `UBDataHeaderBand` + cloned header row
- `UBDataBand` + exactly one cloned detail row
- detail cells use `dataType=1`, dataset, column, and `{dataset.column}` text
- imported header/detail geometry and supported cell style properties remain on cloned cells
- scalar datasets already in the form are retained

## Editor policy

The Builder edits the source header/detail templates. Runtime repeated instances are preview output and are not individual source objects.

