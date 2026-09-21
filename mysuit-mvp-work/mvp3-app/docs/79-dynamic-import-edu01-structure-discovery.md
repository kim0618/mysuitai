# Dynamic Import: edu_01 Source Structure Discovery

## 1. Scope and evidence

This audit is read-only. It does not create a dynamic UBJF or modify `edu_01.ubjf`, the Import Generator, Editor, candidates, or patches.

Ground truth is `/home/tjd618/mysuit-ai-viewer/test-input/edu_01.ubjf`, SHA-256 `deb72e9f5b1a0ecc7963700905b1564c07e42bae902f739f5a0f21a741529717`. The parsed root identifies project `edu`, form `edu_01`, project type `3`, one 794×1123 page, and parameter `name`. No matching runtime project copy with the same hash was found, so no temporary deployment was made.

## 2. Source inventory

| Type | Count |
|---|---:|
| Page | 1 |
| Dataset | 1 |
| Band | 7 |
| UBTable | 8 |
| Physical source cells | 22 |
| Standalone UBLabel | 0 |
| UBImage / Shape | 0 |

Merged continuation wrappers are not counted as physical cells. The two footer tables each have one five-column master cell (`MS`) plus four continuation wrappers (`MC`).

## 3. Dataset

The dataset is stored in the root `datasets[]` array.

- `id`: `dataset_0`
- `className`: `UBDmcUser`
- `typeName`: `user`
- `dataStructureType`: `0`
- `reference`: `true`
- columns: `NAME`, `DEP`, `POSITION`, `PHONE`, `ADDRESS`, `PAY`
- embedded data: Base64-encoded zlib payload containing a JSON array
- embedded row count: 25

All six column declarations have source `type: "0"`; this file supplies no richer nullable/default/display-type contract. `dataField` and `header` are identical. `totalCount` is zero despite 25 embedded rows, so it is not the runtime row count source for this user dataset.

The embedded data contains eight consecutive `POSITION` groups with row counts 1, 2, 2, 2, 3, 1, 2, and 12. The `PAY` total is 105850.

## 4. Band inventory and order

| Source index | Band | Type | y / height | Children | Semantic role |
|---:|---|---|---|---|---|
| 0 | `UPHB0981` | `UBPageHeaderBand` | 0 / 106.1 | `TB9069`, `TB8383`, `TB2902157` | title, parameter, date/time |
| 1 | `UDHB3351` | `UBDataHeaderBand` | 195 / 25 | `TB5066` | six-column header |
| 2 | `UGHB0811` | `UBGroupHeaderBand` | 308 / 0 | none | invisible `POSITION` grouping definition |
| 3 | `UDB6169` | `UBDataBand` | 384 / 25 | `TB1414542` | one repeating detail template |
| 4 | `UGFB4830` | `UBGroupFooterBand` | 503 / 25 | `TB2630981` | group label and subtotal |
| 5 | `UDFB9389` | `UBDataFooterBand` | 626 / 25 | `TB1418363` | dataset grand total |
| 6 | `UPFB4921` | `UBPageFooterBand` | 1073 / 50 | `TB4312` | total/current page |

Band membership is bidirectional in practice: each Band has `bandItems[]`, and each UBTable has `band`, plus band-relative `band_x`/`band_y`.

The source band array and y coordinates agree with the observed semantic order. No explicit sequence/index property exists. A single form cannot distinguish whether the renderer uses array order, y order, or class priority; that renderer contract remains unresolved rather than inferred.

`UBDataHeaderBand` and `UBDataBand` have no explicit mutual reference and neither has a `dataSet` field in this source. The detail cells identify `dataset_0`; the adjacent group definition also identifies it. Their association is therefore observable but its renderer-internal resolution rule is not explicit in this file.

## 5. UBTable to Band mapping

| UBTable | Band | Purpose |
|---|---|---|
| `TB9069` | `UPHB0981` | title |
| `TB8383` | `UPHB0981` | `name` parameter |
| `TB2902157` | `UPHB0981` | current date/time |
| `TB5066` | `UDHB3351` | detail headers |
| `TB1414542` | `UDB6169` | repeating detail row |
| `TB2630981` | `UGFB4830` | group subtotal |
| `TB1418363` | `UDFB9389` | grand total |
| `TB4312` | `UPFB4921` | page number |

## 6. Binding contract

Four binding forms occur:

1. Static text is URL-encoded in `Cell.text` with no binding data type.
2. Dataset columns use `dataType: "1"`, `dataSet`, and `column`; `text` mirrors `{dataset_0.COLUMN}`.
3. Expressions use `dataType: "2"` and `systemFunction`; `text` is a URL-encoded mirror.
4. Parameters use `dataType: "3"` and text such as `{param:name}`.

Representative detail mappings:

| Cell | Dataset | Column | Runtime role |
|---|---|---|---|
| `UB1468793` | `dataset_0` | `NAME` | name |
| `UB1423663` | `dataset_0` | `POSITION` | position/group key |
| `UB1440256` | `dataset_0` | `PHONE` | phone |
| `UB1446223` | `dataset_0` | `ADDRESS` | address |
| `UB1457186` | `dataset_0` | `PAY` | formatted numeric pay |

The sequence cell `UB1470692` uses `FN.RowNum('dataset_0')`. `PAY` uses `MaskNumber` with thousand separators and one decimal place.

## 7. Group and aggregate contract

`UGHB0811` defines grouping with `dataSet: dataset_0`, `column: POSITION`, and `columns: [{ column: POSITION, orderBy: false, numeric: false }]`. It has height zero and no child table, so it establishes group boundaries without a visible group-header row.

`UGFB4830` points back through `groupHeader: UGHB0811` and carries `columns: [POSITION]`. Its table contains:

- label: `FN.getDataSetValue('dataset_0','POSITION') + " 합계"`
- subtotal: `FN.Sum('dataset_0','PAY')`

The label cell spans five columns. The same `FN.Sum('dataset_0','PAY')` expression appears in `UDFB9389` for the grand total. Because the expression has no explicit scope argument, the different result is supplied by Band context: GroupFooter scope versus DataFooter scope. This is a critical dynamic-generation contract.

## 8. Page header and footer

The PageHeader holds a static title, `{param:name}`, and `FN.Today() + FN.Now()` formatted as `yyyy-MM-dd HH:mm:ss`. The PageFooter uses:

```text
FN.TotalPage() + " / " + FN.CurrentPage()
```

Thus the visible `1 / 1` is not static text.

## 9. Runtime repetition reconstruction

The source has one detail-table row, not 25 or 35 rows. Embedded data and grouping reconstruct the visible table as:

```text
DataHeader: 1
for each of 8 POSITION groups:
  DataBand: one source row × group row count
  GroupFooter: 1
DataFooter: 1
```

That produces `1 + 25 + 8 + 1 = 35` visible table rows. The zero-height GroupHeader creates boundaries but no visible row. This exactly explains why the screenshot has 35 rows while the dynamic source contains only one detail template.

## 10. Static flattened comparison

| Capability | Dynamic `edu_01` | MVP 2.2 static import |
|---|---|---|
| Dataset | 1, 25 embedded rows | none |
| Bands | 7 | none |
| Tables | 8 semantic templates | one 35-row table |
| Detail source rows | 1 | 25 copied rows plus footer rows |
| Binding | dataset/column | literal text |
| Group | `POSITION` | visual subtotal rows only |
| Aggregate | contextual `FN.Sum` | literal values |
| Page number | dynamic expression | literal `1 / 1` |
| Data changes | rerender from dataset | no effect |

The static result is a valid visual snapshot but not a semantic equivalent.

## 11. Unresolved contracts

- exact renderer decision between source array, y order, and Band-type priority;
- how a DataBand without its own `dataSet` property chooses the dataset from bound children/group context;
- explicit DataHeader-to-DataBand association rule;
- pagination, split, keep-together, and header-repeat behavior beyond this one-page sample;
- why identical `FN.Sum` expressions receive different scopes internally, beyond the proven Band context;
- external query/datasource contracts, because this ground truth uses embedded `UBDmcUser` data.

These gaps justify `PARTIALLY_READY`, not `READY`.
