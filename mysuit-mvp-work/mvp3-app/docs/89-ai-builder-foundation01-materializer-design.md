# AI Builder Foundation 0.1 — Unified Materializer Design

## Problem and boundary

The editor previously had separate Source Patch and Static Structure writers, while Binding existed only in the Dynamic generator. Mixed Source/Structure saves were explicitly blocked and no canonical three-domain candidate writer existed. Foundation 0.1 adds only the save foundation; it does not add Builder UI, matching, JSON analysis, or AI features.

## Canonical domains and contract

`materializeUnifiedCandidate({ baseProject, baseForm, sourcePatches, structureOperations, bindingOperations, datasets, destinationProject })` returns the candidate identity, preview URL, normalized operation counts, validation result, SHA-256 and semantic signature. Existing operation shapes are accepted and normalized internally into `SOURCE`, `STRUCTURE`, and `BINDING`.

The normalizer folds repeated changes for the same semantic target while retaining the first `before` and the final `after`. It never rewrites History events.

## Apply order

The order is `Base clone → Dataset preparation → STRUCTURE → SOURCE → BINDING → final validation`. The verified Static Table adapter preserves Cell IDs during resize, hide, and reorder, so structure can establish the final geometry first. Source and Binding then resolve stable object/Cell IDs against that final structure. This also makes removal conflicts fail before a dangling binding can be written.

## Conflict and error rules

- Removed target plus Binding: `TARGET_REMOVED_BEFORE_BINDING`.
- Removed target plus Source update: `SOURCE_TARGET_NOT_FOUND`.
- Missing domain target: `SOURCE_TARGET_NOT_FOUND`, `STRUCTURE_TARGET_NOT_FOUND`, or `BINDING_TARGET_NOT_FOUND`.
- Missing Dataset/column: `BINDING_DATASET_NOT_FOUND` or `BINDING_COLUMN_NOT_FOUND`.
- Invalid identity, geometry, binding, or duplicate ID: `FINAL_SOURCE_INVALID`.
- Parse-back mismatch: `PARSE_BACK_VALIDATION_FAILED`.
- Publication failure: `ATOMIC_PUBLISH_FAILED`.

Column reorder/resize plus Binding is allowed because identity is preserved. Hide plus Binding is structurally allowed.

## Binding support

`bindField` and `unbindField` support `UBLabel` and `Cell`. Dataset binding writes `dataType="1"`, `dataSet`, `column`, and encoded `{dataset.column}` text. Parameter binding writes `dataType="3"`, `parameter`, and encoded `{param:name}` text. Dataset binding reuses the Dynamic dataset encoder/writer.

## Atomicity and validation

The service hashes Base `form.ubjf` and `info.xml`, copies the Base to a uniquely named temporary project, applies all changes there, validates identities/geometry/bindings, serializes, reparses, compares semantic signatures, rechecks Base hashes, and only then atomically renames the temporary directory. Any failure removes the temporary tree and publishes no candidate; editor stores and History are not mutated.

The semantic signature covers object/cell IDs, classes, text, bindings, geometry, visibility, table geometry, datasets, columns, and embedded data. It avoids treating codec wrapping differences as semantic changes.

## Limitations

Foundation 0.1 accepts explicit Binding operations but does not introduce a Binding Store or add bindings to History snapshots. Structure materialization uses the currently verified single Static UBTable adapter. General object/row/column removal and multi-table/dynamic authoring remain outside this slice.
