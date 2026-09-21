# Dynamic Import Readiness Result

## Decision: PARTIALLY_READY

`edu_01.ubjf` exposes enough concrete structure to design a narrow manual Dynamic Generator: embedded `UBDmcUser` dataset, seven Band types, table-to-Band membership, simple column bindings, one grouping key, contextual SUM, merged footer cells, and page functions.

It is not `READY` because several renderer contracts are not explicit in this single source: Band ordering priority, DataHeader/DataBand association, dataset resolution for a DataBand without a `dataSet` property, aggregate reset implementation, and pagination behavior.

## What works today

- image to Visual DIM v1.2;
- static TEXT/TABLE generation and per-cell style;
- valid static UBJF serialization;
- Viewer, generic static Editor, History, Candidate, and server PDF;
- atomic project generation and integrity verification.

## What is missing

- Dataset, Band, Binding, Group, Aggregate, expression, merge, repeat, and pagination generation;
- semantic validation and ambiguity confirmation;
- dynamic source-to-many-runtime-instance edit policies;
- dynamic History operations and pagination-stable instance identity.

## Reuse assessment

Direct reuse: UBJF codec, cloning, serialization, ID patterns, table/cell geometry, style mapper, project isolation, Viewer/PDF, and integrity checks.

Generalize: Band-aware discovery, dataset validation, logical table model, Editor capabilities, runtime identity, and History transaction boundaries.

New: Dataset/Band/Binding/Group/Aggregate/Page writers and validators, merge writer, dynamic runtime verification, and user confirmation UX.

## Technical risks

1. **Contextual runtime semantics.** The same `FN.Sum('dataset_0','PAY')` means group sum in GroupFooter and grand total in DataFooter. Correctness depends on Band context and renderer behavior.
2. **Image-only ambiguity.** An image cannot reveal real dataset IDs, column names, queries, grouping intent, aggregate scope, or page policy. Silent inference would create plausible but wrong reports.
3. **Source/runtime cardinality.** One source detail cell expands to many rows and potentially pages. Editing and History must distinguish template-wide changes from runtime-instance data changes.

Secondary risks are pagination contracts, placeholder schema becoming permanent accidentally, and incomplete renderer knowledge about implicit DataBand association.

## Recommended next MVP

Choose **Option A: Dynamic Import MVP 3.1 — Manual Semantic Model → Dynamic UBJF**, but keep its scope strictly aligned to `edu_01`:

- one embedded `UBDmcUser` dataset;
- the seven observed Band types;
- one source detail row;
- `dataType` 1/2/3 bindings;
- one single-column group;
- GroupFooter and DataFooter SUM;
- PageHeader/PageFooter expressions;
- merged five-column footer label;
- read-only Viewer and PDF equivalence checks.

Do not begin image-to-semantic automation until this manual path proves source serialization and runtime scope. If Band creation cannot reproduce `edu_01` without undocumented fields, narrow to Option B and isolate Dataset/Band generation first.

## Required proof for READY

- generate a fresh dynamic project without copying raw `edu_01`;
- source signature matches the intended semantic model;
- 1 detail source row expands to 25 runtime rows;
- eight groups and their subtotals match;
- DataFooter total is 105850;
- PageFooter expression renders correctly;
- multi-page fixture proves pagination and repeated headers;
- source-wide versus runtime-instance Editor policy is enforced;
- Candidate and PDF remain isolated and deterministic.
