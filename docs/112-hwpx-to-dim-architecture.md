# HWPX to DIM Architecture 0.1

## 1. Decision

Use a new package reader and adapter in front of the existing DIM boundary. Do not create a second UBJF Generator and do not let HWPX-specific IDs or ZIP paths leak into UBJF generation.

The current DIM v1.2 boundary is insufficient for faithful `인사.hwpx` import. Freeze a small, explicit next-version contract first, then extend the existing Validator and existing Generator to consume it. The architecture keeps Import Core ownership of validation, template cloning, ID allocation, serialization, parse-back checks, and atomic publication.

```text
HWPX ZIP bytes
  -> Package Gate / Reader
  -> Manifest Resolver
  -> Header / Style Resolver
  -> Section + Flow Parser
  -> Table Grid Parser
  -> Image Resolver
  -> HWPX Semantic Model
  -> DIM Mapper
  -> existing DIM Validator (extended contract)
  -> existing Import Generator (extended capabilities)
  -> existing parse-back / atomic publication
```

## 2. Boundaries

### New adapter-side modules

| Conceptual module | Responsibility |
|---|---|
| `hwpx-package-reader` | Validate ZIP, entry count/size, `mimetype`, duplicate names, traversal paths, required entries, compression ratio, and XML size limits. Return bytes by canonical package path. |
| `hwpx-manifest-resolver` | Parse `content.hpf`; resolve item IDs to package-local paths/media types; prohibit external and escaping references. |
| `hwpx-header-resolver` | Index fonts, character properties, paragraph properties, styles, and border/fill definitions by typed ID. Resolve effective style with explicit missing-reference errors. |
| `hwpx-section-parser` | Parse section/page settings, paragraphs, runs, text, controls, flow anchors, line segments, and ordered block ownership using namespace URIs. |
| `hwpx-table-parser` | Build a logical occupancy grid from `cellAddr` and `cellSpan`; retain physical master cells; reject overlaps, duplicate addresses, out-of-range spans, and uncovered slots not explained by spans. |
| `hwpx-image-resolver` | Resolve `binaryItemIDRef` through manifest, sniff media type, hash bytes, and retain cell-/paragraph-relative placement. |
| `hwpx-semantic-model` | Package-independent, immutable representation of pages, blocks, tables, master cells, paragraphs/runs, styles, images, source references, and diagnostics. |
| `hwpx-dim-mapper` | Normalize units/page coordinates, classify scalar/repeating candidates, allocate exact row/column totals, and emit only the approved DIM contract. |

These modules do not know UBJF class names, prototype IDs, MySuit numeric data types, or filesystem deployment paths.

### Existing ownership retained

- DIM Validator remains the only accepted import-contract validator.
- Existing Import Generator remains the only DIM-to-UBJF implementation.
- Existing template cloning, ID generation, style mapping, serialization, parse-back validation, integrity hashes, cleanup, and atomic rename remain authoritative.
- Existing Builder binding review remains separate; the adapter emits candidates/metadata but does not create or approve bindings.

## 3. Package reader contract

Input is a byte buffer plus a safe display filename. It is not an already extracted directory.

Required checks:

1. ZIP signature and uncompressed-size/entry-count limits.
2. First-class `mimetype` value exactly `application/hwp+zip`.
3. No absolute names, `..`, backslashes-as-separators, duplicate canonical names, symlinks, encrypted entries, or unsupported compression methods.
4. Required package roots resolved through `META-INF/container.xml` and/or the bounded known paths.
5. `content.hpf` manifest paths must resolve inside the package and agree with media sniffing for binaries.
6. XML parsing must disable DTDs, external entities, and network resolution.
7. Parsed namespace identity uses URI, not source prefix.

The reader returns no host filesystem path. Temporary extraction, if used internally, is implementation detail under an import-owned directory and is deleted on all outcomes.

## 4. HWPX Semantic Model

The model should preserve source evidence before lossy DIM mapping:

```text
HwpxDocument
  packageHash
  producer/version
  manifest[]
  styles
    fonts[]
    charProperties[]
    paragraphProperties[]
    borderFills[]
  sections[]
    page { width, height, margins, orientationLiteral, unit }
    blocks[] in flow order
      Paragraph { id, styleRef, runs[], anchorGeometry }
      Table { id, rowCount, columnCount, physicalCells[], occupancyGrid }
        MasterCell { address, rowSpan, colSpan, size, margins, borderFillRef, paragraphs[] }
      Image { id, binaryRef, mediaType, hash, size, placementContext }
  diagnostics[]
```

The occupancy grid references master cells; it does not manufacture empty continuation cells. Source XML values and normalized values remain separate fields.

## 5. Style resolution

Resolve in this order without guessing:

1. paragraph `styleIDRef` to named style;
2. explicit paragraph `paraPrIDRef`, otherwise style paragraph property;
3. run `charPrIDRef`, otherwise style character property;
4. cell `borderFillIDRef` for border/fill;
5. language-specific font ID through the matching font-face list.

Return both an effective supported style and unsupported source properties. Mixed runs must either remain structured in the next DIM contract or trigger an explicit flattening diagnostic approved by policy.

## 6. Table parsing and merge contract

For each `hp:tbl`:

1. Read declared `rowCnt` and `colCnt`.
2. For every physical `hp:tc`, read `cellAddr`, `cellSpan`, `cellSz`, `cellMargin`, `borderFillIDRef`, and paragraph content.
3. Insert the master cell into every occupied logical slot `[rowAddr,rowAddr+rowSpan) × [colAddr,colAddr+colSpan)`.
4. Reject out-of-bounds spans, duplicate masters, overlapping occupancy, and unexplained holes.
5. Derive grid boundary constraints from all cell widths/heights and table size. Do not select one arbitrary row as column truth.
6. Resolve flow position from page margins, paragraph order/line segments, object position, and offsets.
7. Emit exact normalized totals with the final column/row absorbing deterministic rounding remainder.

Proposed canonical DIM extension uses `rowSpan`/`colSpan` on master cells in a sparse row representation. Do not also introduce an independent `mergedCells` list. If compatibility requires dense rows, continuation entries must be an explicit tagged type and must never carry independent content/style.

`headerRowCount` and optional `titleRowCount` are metadata, not merge substitutes. In this fixture each repeating table has one merged title row followed by one header row.

## 7. Geometry and unit policy

The source page is 59,528×84,188 with margins in the same coordinate family. The current target is 794×1123.

```text
targetX = sourceX * 794 / 59528
targetY = sourceY * 1123 / 84188
targetW = sourceW * 794 / 59528
targetH = sourceH * 1123 / 84188
```

Keep rational numerator/denominator or full precision through mapping. Quantize only at the DIM boundary. For each table:

- column widths must sum exactly to table width;
- row heights must sum exactly to table height;
- merged-cell size must equal the covered boundary interval within an explicit tolerance;
- source anomalies such as `4294966014` must pass a documented signed-value interpretation or fail closed;
- conflicting height constraints must produce diagnostics, never silent first-cell selection.

## 8. Image handling

The proposed image element needs:

```text
id, type=image, x, y, width, height,
assetId, mediaType, sha256, fit/crop,
placementContext
```

`assetId` resolves only inside the import staging context. DIM must not contain arbitrary absolute paths or data URLs. Import Core stages the validated bytes, and the existing Generator extension creates the corresponding UBImage using the same atomic candidate lifecycle.

For `인사.hwpx`, `image1` resolves to an embedded 298×79 GIF and the picture is nested in a merged table cell. Cell-relative composition must be supported before page coordinates are finalized.

## 9. Semantic candidate discovery

Discovery is deterministic but non-binding:

- Scalar label/value candidates come from adjacent cells, merged regions, and empty value cells.
- Repeating candidates require a merged section-title row, a header row with non-empty labels, and two or more compatible subsequent rows.
- Candidate keys use normalized Korean labels plus stable HWPX source identity.
- Confidence/evidence is presented in Binding Review.
- No dataset, parameter, or array binding is emitted until user review.

For the Golden Fixture, candidate regions are 인적사항 scalars and the six repeating tables 개인자격, 봉사활동, 면허/자격, 어학, 연수, 가족사항.

## 10. Error model

Suggested fail-closed categories:

- `HWPX_PACKAGE_INVALID`
- `HWPX_REQUIRED_PART_MISSING`
- `HWPX_NAMESPACE_UNSUPPORTED`
- `HWPX_XML_INVALID`
- `HWPX_REFERENCE_MISSING`
- `HWPX_TABLE_GRID_INVALID`
- `HWPX_TABLE_GEOMETRY_CONFLICT`
- `HWPX_STYLE_UNSUPPORTED`
- `HWPX_IMAGE_INVALID`
- `HWPX_DIM_MAPPING_UNSUPPORTED`

Errors include safe entry names, source IDs, row/column addresses, and validator codes; never XML bodies, binary bytes, host absolute paths, or populated personnel values.

## 11. Phased implementation gate

### Phase 0 — contract fixtures

- Freeze this file by SHA-256 outside production runtime.
- Add focused synthetic fixtures for horizontal span, vertical span, nested merge, image outside table, malformed overlap, missing style ref, multi-page section, and bad ZIP path.
- Freeze expected semantic-model JSON, not a generated Candidate.

### Phase 1 — read-only parser

- Implement Package/Header/Section/Table/Image readers.
- Assert the exact inventory from Audit 0.1: 8 tables, 186 physical cells, 56 merged masters, one image.
- No DIM or UBJF output.

### Phase 2 — DIM contract extension

- Approve span, header metadata, padding/paragraph, image, and page-source metadata.
- Extend the current validator with backward-compatible v1.2 behavior.
- Prove invalid occupancy and asset references fail closed.

### Phase 3 — existing Generator extension

- Add merged-cell and UBImage support inside the existing Generator.
- Preserve prototype cloning, ID allocation, serialization, parse-back, source hashes, and atomic publication.
- Do not create an HWPX-specific UBJF Generator.

### Phase 4 — HWPX mapper and Builder integration

- Map the semantic model into the approved DIM version.
- Show scalar/repeating candidates for review.
- Run Viewer/PDF visual and structural certification, then array-binding certification separately.

## 12. Acceptance criteria for HWPX Import MVP 0.1

Implementation may begin only after contract approval. Completion requires:

- byte-identical source HWPX before/after;
- deterministic semantic output across repeated runs;
- exact table IDs/counts/grid occupancy/spans;
- manifest-to-image hash match;
- no Vision/OCR dependency;
- DIM Validator pass under the approved version;
- existing Generator only, with explicit extensions;
- Viewer and PDF preserve all eight regions, merged layout, image, borders/fills, and populated date;
- no source/fixture/Candidate residue after failed tests;
- all DIM v1.0/v1.1/v1.2 regressions remain green.

Until the merge and image contracts are approved, the readiness state is `BLOCKED_BY_DIM_AND_GENERATOR_CAPABILITY`, not implementation-ready.
