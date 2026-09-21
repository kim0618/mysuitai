# HWPX Import Readiness Audit 0.1

## 1. Scope and decision

- Source: `C:\Users\jinsung\Desktop\시연\인사.hwpx`
- SHA-256: `b49ac82af8351b16e252f594805f7c418234fa10d21623abb8186dcdeed6312b`
- Size: 57,206 bytes
- Audit method: ZIP entry enumeration plus namespace-aware XML parsing. `Preview/PrvImage.png` was used only to visually cross-check the parsed inventory; it was not used as geometry or OCR input.
- Product code, DIM schema, Generator, Import Core, source HWPX, fixtures, and Candidates were not modified.
- Final decision: **C — faithful import requires material DIM and Generator changes.** A lossy text/table snapshot is possible today, but it would discard 56 merged master cells and the embedded image and therefore is not an acceptable direct-structure import.

## 2. Package inventory

The package identifies itself as `application/hwp+zip`. `mimetype` and `version.xml` are stored without compression; the main XML and binary payloads are normal ZIP entries.

| Entry | Bytes | Observed role |
|---|---:|---|
| `mimetype` | 19 | Package media-type marker: `application/hwp+zip`. |
| `version.xml` | 309 | Producer/version declaration: HCF `5.1.0.1`, XML `1.2`, Hancom Office Hangul `11, 0, 0, 2129`. The source attribute is spelled `tagetApplication`. |
| `Contents/header.xml` | 34,642 | Shared reference dictionaries: fonts, 12 character properties, 13 paragraph properties, 11 border/fill definitions, 14 styles, tab and numbering data. |
| `Contents/section0.xml` | 159,266 | The single section body: page settings, 193 paragraphs, 196 runs, 80 text nodes, 8 tables, 47 rows, 186 physical cells, and one picture. |
| `Contents/content.hpf` | 1,794 | Package metadata and manifest. It maps `header`, `section0`, `settings`, and embedded `image1`; the spine orders `header` and `section0`. |
| `BinData/image1.gif` | 4,018 | The only embedded document image, GIF 89a, 298×79, SHA-256 `7b2ab5b3b5c89fc55cffa6278cf49ca78b2a042d3340ee597ff00cd84b1a88c2`. |
| `Preview/PrvText.txt` | 1,202 | Derived plain-text preview. It contains the visible field labels and the one populated employment date. It is not structural authority. |
| `Preview/PrvImage.png` | 37,447 | Derived 724×1024 PNG preview, SHA-256 `b2672977f6e305cda8bc58fcb78964bdef66ff9eb68a981a8b94018ac5378a9b`. It is not structural authority. |
| `settings.xml` | 279 | Application state only: caret `listIDRef=0`, `paraIDRef=6`, `pos=16`. |
| `META-INF/container.xml` | 475 | Declares `Contents/content.hpf`, preview text, and RDF as package roots. |
| `META-INF/container.rdf` | 867 | Classifies `header.xml` and `section0.xml` and declares the package as a document. |
| `META-INF/manifest.xml` | 134 | Empty ODF manifest element in this fixture. |

There are no additional sections and no external image links.

## 3. Namespaces and page model

The parser must match namespace URIs rather than literal prefixes. The active structural namespaces are:

- `hp`: `http://www.hancom.co.kr/hwpml/2011/paragraph`
- `hs`: `http://www.hancom.co.kr/hwpml/2011/section`
- `hh`: `http://www.hancom.co.kr/hwpml/2011/head`
- `hc`: `http://www.hancom.co.kr/hwpml/2011/core`
- `hpf`: `http://www.hancom.co.kr/schema/2011/hpf`
- `opf`: `http://www.idpf.org/2007/opf/`

The package also declares `ha`, `hp10`, `hhs`, `hm`, `dc`, `ooxmlchart`, `epub`, and `config`; their prefix spelling must not be used as identity.

`hp:pagePr` contains these exact values:

| Property | XML value |
|---|---:|
| width | 59,528 |
| height | 84,188 |
| landscape | `WIDELY` |
| gutterType | `LEFT_ONLY` |
| left/right margin | 1,984 / 1,984 |
| top/bottom margin | 1,417 / 1,417 |
| header/footer margin | 1,417 / 1,417 |
| gutter | 0 |

The numeric dimensions correspond to approximately 210.002×296.997 mm when interpreted as 1/7200 inch and therefore match portrait A4 despite the literal `landscape="WIDELY"`. The adapter must treat numeric width/height as geometry authority and retain the orientation literal as source metadata/risk evidence.

For the current 794×1123 DIM page, the deterministic normalization factors are:

```text
sx = 794 / 59528 = 0.013338260986426556
sy = 1123 / 84188 = 0.013339193234190146
```

The factors are deliberately separate. Rounding must be deferred until table column/row totals can absorb the remainder exactly, because the current Generator compares accumulated dimensions with strict equality.

## 4. Parsed structural facts

### 4.1 Paragraphs, runs, and styles

- Paragraphs: 193
- Runs: 196
- Text nodes: 80
- Outer table-anchor paragraphs: 8, all `paraPrIDRef=3`
- Cell paragraphs: 185, all `paraPrIDRef=12`
- `paraPr 3`: horizontal `JUSTIFY`, vertical `BASELINE`, 160% line spacing
- `paraPr 12`: horizontal `CENTER`, vertical `BASELINE`, 160% line spacing
- Run character references: charPr `6` ×165, `0` ×15, `11` ×6, `9` ×4, `7` ×2, `8` ×2, `10` ×1, `5` ×1

The header contains seven language font-face lists; every list maps ID 0=`굴림`, 1=`함초롬돋움`, 2=`함초롬바탕`. Character properties resolve font reference, height, color, bold, and borderFill reference. Observed character heights are 900, 1000, 1600, and 2300; observed text colors are black, white, and red. Mixed run styling is structurally available in HWPX but DIM v1.2 has one style per text element or cell.

### 4.2 Tables, rows, cells, merge, and geometry

Every table is an inline/flow object with these common position facts:

```text
treatAsChar=1, flowWithText=1, vertRelTo=PARA, horzRelTo=PARA,
vertAlign=TOP, horzAlign=LEFT, vertOffset=0, horzOffset=0
```

Therefore table x/y are not standalone absolute attributes. The deterministic page placement is resolved from page margins, paragraph flow, and the anchor paragraph's terminal line segment. The inventory below records both source units and the calculated DIM candidate geometry. Candidate x is the explicit left margin plus zero horizontal offset; candidate y is the explicit top margin plus the terminal `lineseg.vertpos`. No preview pixels were used.

| # | HWPX table ID | Section/title | rowCnt×colCnt | Physical cells | Merged masters | Source `(x,y,w,h)` | DIM candidate `(x,y,w,h)` | Representative text |
|---:|---|---|---:|---:|---:|---|---|---|
| 1 | `1106664773` | 문서정보 | 4×5 | 11 | 3 | `(1984,0,54881,9656)` | `(26.463,18.902,732.017,128.803)` | 인사기록부, 문서번호, UB-HR-001, 보존년한, 영구, 문서관리, 업무담당자, 보안관리, 인비(人祕) |
| 2 | `1106664874` | 인적사항 | 11×16 | 58 | 47 | `(1984,10822,55002,14986)` | `(26.463,163.258,733.631,199.901)` | 성명, 한글/영문/한자, 군번, 입대일, 생년월일, 전화번호, 비상연락처, 이메일, 주민등록번호, 주소, 결혼여부, 종교, 보훈, 장애, 병역 |
| 3 | `1106664872` | 개인자격 | 6×6 | 31 | 1 | `(1984,26974,54984,8258)` | `(26.463,378.713,733.391,110.155)` | 근무처, 근무기간, 직급, 담당부서, 담당업무, 상벌사항; one value `2019-01-01~2019-01-01` |
| 4 | `1106664888` | 봉사활동 | 6×3 | 16 | 1 | `(1984,36114,55093,8258)` | `(26.463,500.633,734.845,110.155)` | 기관명, 봉사기간, 봉사내용 |
| 5 | `1106664890` | 면허/자격 | 6×3 | 16 | 1 | `(1984,45254,55093,8258)` | `(26.463,622.553,734.845,110.155)` | 자격명, 취득일, 발행처 |
| 6 | `1106664892` | 어학 | 4×4 | 13 | 1 | `(1984,54394,55108,5694)` | `(26.463,744.474,735.045,75.953)` | 언어명, 공인시험명, 점수, 취득일 |
| 7 | `1106664895` | 연수 | 4×3 | 10 | 1 | `(1984,60970,55124,5694)` | `(26.463,832.192,735.258,75.953)` | 국가/교육기관명, 교육기간, 내용 |
| 8 | `1106664893` | 가족사항 | 6×6 | 31 | 1 | `(1984,67546,55060,8258)` | `(26.463,919.911,734.405,110.155)` | 관계, 성명, 생년월일, 학력, 직업, 동거여부 |

Totals: 8 tables, 47 physical row elements, 186 physical cells, 56 cells with `rowSpan>1` or `colSpan>1`. The complete logical grids contain 332 slots; continuation slots are implicit rather than emitted as `hp:tc` nodes.

All 186 cells carry the same explicit margin: left/right 510 and top/bottom 141. Each cell has `cellAddr(colAddr,rowAddr)`, `cellSpan(colSpan,rowSpan)`, `cellSz(width,height)`, `borderFillIDRef`, and a `subList` containing paragraph/run/text structure.

Representative exact column widths for the regular repeating tables are:

- 개인자격: `8948, 13947, 6448, 7698, 11550, 6393`
- 봉사활동: `8947, 17908, 28238`
- 면허/자격: `8947, 17877, 28269`
- 어학: `8947, 13946, 19213, 13002`
- 연수: `18286, 18191, 18647`
- 가족사항: `6366, 11304, 10520, 7283, 11589, 7998`

Title rows have height 1848. Normal body cells mostly report height 1282. A repeatable source anomaly exists: the first column of regular body rows reports height 318 while peer cells report 1282, and one merged military cell reports unsigned-looking height `4294966014`. The table's own height and flow line segment are internally usable, but a production adapter must define and test a signed/overflow and inconsistent-cell-height policy rather than silently trusting any single cell.

### 4.3 Border and fill

`header.xml` has 11 `borderFill` definitions. Cells reference:

- ID 3: 117 cells, solid black 0.12 mm on all sides
- ID 11: 54 cells, solid black 0.12 mm with `#CCCCCC` fill
- ID 9: 7 cells, solid black 0.12 mm with `#636363` fill
- IDs 4–8 and 10: 8 cells, edge-specific 0.12/1.0 mm solid borders; ID 10 has `#CCCCCC` fill

This reference resolution is deterministic. DIM can preserve solid color/fill and per-side visibility/width after unit conversion, but it cannot preserve arbitrary HWPX line types if future fixtures contain them.

### 4.4 Embedded image

The single `hp:pic` has:

- picture ID `1106664907`, `numberingType=PICTURE`, `treatAsChar=1`, `flowWithText=1`
- size/original size `11089×2943`
- image rectangle points `(0,0)`, `(11089,0)`, `(11089,2943)`, `(0,2943)`
- `binaryItemIDRef=image1`, brightness 0, contrast 0, alpha 0, effect `REAL_PIC`
- `content.hpf` maps `image1` to embedded `BinData/image1.gif`, media type `image/gif`
- GIF pixel size 298×79

The picture is nested in the first merged cell of the document-information table. Its page position therefore depends on that table/cell flow context, not a standalone absolute x/y. Binary resolution and size are deterministic; current DIM has no image element or image-source field.

## 5. Scalar and repeating candidates

No Binding Plan is created by this audit. These are semantic candidates derived from visible header cells and row structure only.

### Scalar candidates

- Document metadata: 문서번호, 보존년한, 문서관리, 보안관리
- Identity: 성명(한글/영문/한자), 군번, 입대일, 생년월일, 주민등록번호
- Contact: 전화번호, 이메일, 비상연락처 C/P, 비상연락처 관계, 거주지 주소
- Personal: 혈액형, 형제관계, 결혼여부, 종교
- Veteran/disability: 보훈대상, 보훈구분, 보훈번호, 장애대상, 장애등급, 장애유형, 장애인정일
- Military: 계급, 군별, 복무기간, 미필사유

### Repeating candidates

| Candidate | Source table | Header columns | Blank/data capacity in fixture |
|---|---|---|---:|
| 개인자격 | `1106664872` | 근무처, 근무기간, 직급, 담당부서, 담당업무, 상벌사항 | 4 rows; one row contains a period value |
| 봉사활동 | `1106664888` | 기관명, 봉사기간, 봉사내용 | 4 rows |
| 면허/자격 | `1106664890` | 자격명, 취득일, 발행처 | 4 rows |
| 어학 | `1106664892` | 언어명, 공인시험명, 점수, 취득일 | 2 rows |
| 연수 | `1106664895` | 국가/교육기관명, 교육기간, 내용 | 2 rows |
| 가족사항 | `1106664893` | 관계, 성명, 생년월일, 학력, 직업, 동거여부 | 4 rows |

The title row is a merged presentational row, the next row is the header, and remaining rows are repeat slots. That is a strong candidate pattern, not an applied binding contract.

## 6. HWPX to current DIM v1.2 mapping

The comparison is against the actual validator in `src/server/import/dim-validator.js`, not a proposed schema.

| Information | Status | Evidence and limitation |
|---|---|---|
| text | SUPPORTED | DIM text elements and table-cell strings exist. Multiple HWPX runs must be flattened, losing mixed style. |
| geometry | SUPPORTED | DIM has numeric x/y/width/height. Flow anchors must first be resolved and normalized to 794×1123. |
| font | PARTIAL | DIM supports size, bold, and text color; font family, run-level variation, kerning, and other HWPX character properties are absent. |
| alignment | PARTIAL | left/center/right plus vertical top/middle/bottom exist. HWPX `JUSTIFY`, baseline semantics, line spacing, and per-paragraph runs are not equivalent. |
| background | SUPPORTED | The observed solid fills map to `backgroundColor`; patterns/alpha beyond solid color are not modeled. |
| border | PARTIAL | Per-side visible/color/width exists. HWPX line type, shared-edge policy, and exact mm semantics need normalization. |
| table | PARTIAL | Rectangular unmerged tables are supported. The validator requires every row to have exactly the declared column count. |
| row | SUPPORTED | DIM rows and row heights exist, subject to resolving the fixture's inconsistent cell-height values. |
| column | SUPPORTED | DIM columns and widths exist; accumulated width must equal table width exactly. |
| merged cell | UNSUPPORTED | No merged-cell model. |
| rowSpan | UNSUPPORTED | Validator explicitly rejects `rowSpan`. |
| colSpan | UNSUPPORTED | Validator explicitly rejects `colSpan`. |
| image | UNSUPPORTED | Allowed element types are only `text` and `table`. |
| image source | UNSUPPORTED | No binary/media reference or payload contract. |
| paragraph | PARTIAL | Text can be flattened, but paragraph boundaries, line spacing, style references, and run styling are not first-class. |
| page | PARTIAL | DIM has one width/height pair only; margins, orientation, sections, flow anchors, headers/footers, and multi-page structure are absent. |

## 7. Minimum extension assessment

For faithful import of this fixture, the minimum proposed contract additions are:

1. Table cells gain `rowSpan` and `colSpan` with an explicit sparse/master-cell grid contract. A `mergedCells` side list is not needed if spans are canonical; supporting both would create two sources of truth.
2. Table metadata gains `headerRowCount` and optionally `titleRowCount`/semantic role so the six repeating regions can be recognized without encoding title rows as ordinary data.
3. Cell style gains padding `{left,right,top,bottom}`. Existing `border` can carry the observed solid edges after normalization.
4. Text/cell content gains paragraph blocks or a deliberately constrained `paragraphAlign`/line-break contract. A single cell-wide style cannot reproduce mixed runs.
5. Add an `image` element with geometry, media type, package-local asset ID/hash, and an import-owned binary source handle. Do not put arbitrary filesystem paths into DIM.
6. Page metadata should retain source width/height, margins, orientation literal, and unit mapping while still producing the fixed 794×1123 current target page.

These are not schema-only changes. The current table Generator assumes a dense rectangle and clones one cell per grid slot; the current label/table-only materializer cannot create an image. Both Validator and Generator need changes. Therefore the audit does not classify this as a small adapter-only extension.

## 8. Golden Fixture evaluation

`인사.hwpx` is a strong **readiness/gap Golden Fixture** because it contains:

- 8 tables covering scalar and six repeating-table patterns;
- both horizontal and vertical merges, including 47 merges in the most important scalar table;
- deterministic style references, solid fills, and edge-specific border widths;
- one embedded image with a complete manifest-to-binary reference chain;
- a portrait A4 layout that maps closely to the existing 794×1123 page;
- sufficient empty rows to test future array binding without depending on OCR;
- one populated repeating value for preservation checks.

It is not sufficient as the only production fixture: it has one section/page, one inline image, no floating objects, no multi-page table split, no external binary, no nested table, and no rich mixed-run content. Use it as Golden Fixture 1 plus smaller focused fixtures for each missing feature.

## 9. Implementation difficulty and risks

| Risk | Finding | Required control |
|---|---|---|
| Namespace handling | Multiple 2011/2016 namespaces and arbitrary prefixes are declared. | URI-aware parsing; reject unknown structural namespace versions explicitly. |
| Header style reference | Section nodes store IDs, not resolved visual style. | Immutable indexed resolver for font/char/para/borderFill references with missing-ID errors. |
| `borderFill` reference | 11 definitions and 7 referenced IDs occur. | Resolve before mapping; normalize solid colors/widths; preserve unsupported types in diagnostics. |
| Character style | 12 char properties and mixed run refs occur. | Define flattening precedence or extend content runs; never silently choose the first run. |
| Paragraph style | Cell paragraphs resolve to centered paraPr 12; anchors use justified paraPr 3. | Resolve effective alignment and retain unsupported JUSTIFY/line spacing warnings. |
| Unit conversion | Page and object geometry are integer source units; current DIM target is fixed. | Rational page-scale conversion, deferred rounding, exact row/column remainder allocation. |
| Table cell geometry | Spans make physical cell count differ from logical slots; source has inconsistent cell heights and an unsigned-looking value. | Build occupancy grid from address/span; validate overlap/gaps; use table/row constraints and fail closed on irreconcilable geometry. |
| Embedded image | Image is referenced through `content.hpf` and nested in a merged table cell. | Manifest allowlist, ZIP-slip defense, media sniffing, size/hash limits, cell-relative placement resolution. |
| Page layout | Tables are flow objects, not absolute-positioned objects. | Resolve anchor order and line-segment positions; test against preview only as secondary evidence. |
| Security/privacy | The form includes resident-registration and personnel fields. | No content logging beyond fixture evidence; redact populated PII in future runtime logs. |

## 10. Final answers

- **Q1. Can Table / Cell / Merge / Geometry be extracted deterministically?** **YES, with a geometry validation caveat.** IDs, row/column counts, addresses, spans, sizes, margins, and flow anchors are explicit. The adapter must fail closed on the observed height anomalies rather than invent values.
- **Q2. Can DIM be made from original structure without Vision?** **YES.** Structure, text, style references, image reference, and layout data are in the package. Preview/Vision is unnecessary for structural extraction.
- **Q3. Is current DIM v1.2 sufficient?** **NO.** Merge/span and image/source are absent; paragraph/run and page metadata are only partial.
- **Q4. Can only an HWPX→DIM Adapter be added without changing Import Core?** **NO for faithful import.** A lossy flatten/omit adapter could pass today's validator, but faithful handling needs Validator/Generator support for sparse merged grids and images.
- **Q5. Is `인사.hwpx` suitable as an HWPX Import Golden Fixture?** **YES, as the first gap/readiness fixture, not the sole conformance suite.**
- **Q6. Should implementation proceed directly to HWPX Import MVP 0.1?** **NO.** First freeze a bounded DIM extension and prove merged-table/image generation in isolated fixtures; then implement the adapter against that contract.

## 11. Gate to the next phase

Proceed only after approving all four items:

1. whether MVP 0.1 is intentionally lossy or fidelity-preserving;
2. canonical sparse merge representation and overlap/gap validation;
3. image asset ownership and materialization contract;
4. row-height anomaly policy and exact unit/rounding rules.

No Binding Plan, DIM, UBJF, Candidate, or source mutation was produced by this audit.
