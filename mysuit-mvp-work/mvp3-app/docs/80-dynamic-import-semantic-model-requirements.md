# Dynamic Import Semantic Model Requirements

## 1. Two pipelines

Static Import remains necessary for certificates, applications, and fixed forms. Dynamic Import is an additional pipeline for lists, grouped reports, statistics, and pagination.

```text
Image → Visual DIM v1.2 → Static UBJF
Image + user confirmation → Semantic Report Model + Visual DIM → Dynamic UBJF
```

Visual DIM owns geometry and style. The Semantic Report Model owns datasets, repetition, grouping, expressions, scope, and page behavior. Keeping them separate avoids pretending that a visual subtotal proves a GroupFooter.

## 2. Minimum models

### Dataset

Required fields: stable ID, source kind (`embedded`, `placeholder`, future external source), columns, declared value type, optional samples, and optional embedded rows. Source/query credentials must never be inferred from an image.

### Band

Required fields: stable ID, type, source order, geometry, child visual element IDs, dataset/group references where explicit, repeat/page policy, and confidence. Supported first types should match the seven `edu_01` classes.

### Binding

Required fields: target cell/element, binding kind (`static`, `datasetColumn`, `systemFunction`, `parameter`), dataset, column, expression, formatter, and scope. The writer must reproduce MySuit `dataType`, `dataSet`, `column`, `systemFunction`, and encoded `text` consistently.

### Group

Required fields: group ID, dataset, ordered key columns, ordering/numeric flags, header Band, footer Band, visible-header depth, and reset scope. `edu_01` proves that the group definition can be invisible.

### Aggregate

Required fields: function, dataset, target column, containing Band, semantic scope (`group` or `dataset`), formatter, and target cell. Scope cannot be derived from the `FN.Sum` string alone.

### Repeat and page

Required fields: detail template Band, dataset, source template row count, header repetition policy, split/keep policy, PageHeader/PageFooter policy, and page expressions. Pagination settings remain a discovery gap.

### Visual relation

Every semantic target must reference a Visual DIM element or table cell. Merged cells need an explicit master/continuation model matching `colSpan`, `MS`, and `MC`, not a painted approximation.

## 3. Illustrative ground-truth representation

This is a design example, not an implemented schema:

```json
{
  "visualModelRef": "visual-dim-v1.2",
  "datasets": [{
    "id": "dataset_0",
    "sourceKind": "embedded",
    "columns": ["NAME", "DEP", "POSITION", "PHONE", "ADDRESS", "PAY"]
  }],
  "bands": [
    { "id": "UPHB0981", "type": "pageHeader" },
    { "id": "UDHB3351", "type": "dataHeader" },
    { "id": "UGHB0811", "type": "groupHeader", "dataset": "dataset_0", "height": 0 },
    { "id": "UDB6169", "type": "data", "dataset": "dataset_0", "templateRows": 1 },
    { "id": "UGFB4830", "type": "groupFooter", "group": "position_group" },
    { "id": "UDFB9389", "type": "dataFooter" },
    { "id": "UPFB4921", "type": "pageFooter" }
  ],
  "groups": [{ "id": "position_group", "dataset": "dataset_0", "columns": ["POSITION"] }],
  "aggregates": [
    { "targetBand": "UGFB4830", "function": "sum", "column": "PAY", "scope": "group" },
    { "targetBand": "UDFB9389", "function": "sum", "column": "PAY", "scope": "dataset" }
  ]
}
```

## 4. Visual-to-semantic ambiguity

| Visual evidence | Competing meanings |
|---|---|
| repeated rows | static rows or one DataBand template |
| dark subtotal | static/merged row or GroupFooter |
| table header | static row or DataHeaderBand |
| grand total | literal value, formula, or DataFooter aggregate |
| `1 / 1` | literal or page expression |
| group-like order | intentional grouping or coincidental sort |

AI may assign high confidence to repeated geometry and subtotal patterns, medium confidence to group boundaries, and low confidence to real dataset/column identities, query source, aggregate scope, and page policy. Low-confidence semantics require user confirmation.

## 5. Placeholder dataset strategy

When no real schema is available, use a non-production embedded placeholder dataset with stable semantic names when labels are clear (`name`, `position`, `pay`) and neutral names (`col_1`) otherwise.

Advantages: dynamic structure can be previewed; binding and grouping can be tested; later source mapping is explicit. Risks: guessed names may become accidental API contracts, inferred data types may be wrong, and placeholder rows may hide pagination issues. The UI must label placeholders and require mapping before production use.

## 6. Required generator primitives

- `createDataset()`
- `createPageHeaderBand()` / `createDataHeaderBand()` / `createDataBand()`
- `createGroupHeaderBand()` / `createGroupFooterBand()`
- `createDataFooterBand()` / `createPageFooterBand()`
- `attachTableToBand()`
- `bindCell()` and `bindParameter()`
- `createGroup()`
- `createAggregate()` with explicit semantic scope
- `createSystemFunction()` and `createPageNumberExpression()`
- `createMergedCell()` with master/continuation wrappers
- `validateDynamicSource()` and `validateRuntimeExpansion()`

## 7. Editor and runtime identity

The existing render key already contains page, source, band, row, and render index, so it is a useful basis. Dynamic forms change cardinality: one source cell can produce 25 or more runtime instances.

Source edits such as font, width, binding, and formatter should apply to every instance. Editing the literal text of one bound runtime row is generally invalid unless a data override mechanism exists. Capabilities must expose `SOURCE_TEMPLATE_ALL_INSTANCES` separately from `RUNTIME_INSTANCE`, and reject instance text edits on bound cells.

Pagination can move a runtime row to another page, so row identity should include a stable dataset row key when available; render index alone is insufficient.

## 8. History, Candidate, and PDF

Candidate project isolation, atomic copy, Viewer launch, and PDF export are reusable. History needs semantic transaction types for dataset, Band, group, binding, aggregate, and page-policy changes. A semantic operation must be validated and materialized atomically because partial Band/group changes can invalidate the entire report.

The `edu_01` upload was not deployed during this audit, so PDF reuse is supported by the existing generic MySuit path but not newly runtime-proven for this exact hash.

## 9. Recommended user flow

```text
Upload document
→ detect repeating report pattern
→ show proposed Header / Detail / Group / Footer / Page structure
→ ask user to confirm dataset columns, grouping, totals, and page policy
→ generate placeholder-backed dynamic preview
→ map placeholder schema to the real source
→ validate Viewer and PDF
```

Static generation must remain an explicit alternative when the user wants only a visual snapshot.
