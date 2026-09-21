# HWPX Import — Page Geometry Fidelity Result

## Root cause

HWPX object placement was lost in the native parser (`semantic-parser.js`), before the semantic model was built. DIM, the UBJF generator and the Viewer passed coordinates through 1:1 both before and after the fix.

- `position()` read `x`/`y` attributes from `hp:pos`. HWPX stores placement in `hp:pos@horzOffset/vertOffset`, qualified by `horzRelTo/vertRelTo`, `horzAlign/vertAlign` and `treatAsChar`. Every top-level object therefore got `x = 0` and a synthetic `y` from a flow counter (`flowY`, starting at a hard-coded 1800 HWPUNIT, +500 per table).
- `pagePr/margin` (left/top/header/gutter) was never read, so inline (`treatAsChar=1`) objects ignored the body area and the paragraph `linesegarray` positions.
- On 발주서.hwpx the flow counter pushed the UBI STORM image to `y = 85798` (below the 84224 paper). The DIM mapper clipped it to `y = 1122, height = 1`, so the image existed but was invisible.

The `pageBorderFill/offset` (1417 on each side of 발주서) is only the page border line position (`textBorder="PAPER"`). It is not a layout inset. The HWPX Preview confirms this: 발주서 objects sit exactly at their PAPER offsets.

## Page geometry contract

The semantic model (`HWPX_SEMANTIC_0.2`) now carries:

```text
page.width / page.height          paper, HWPUNIT
page.margins                      left, right, top, bottom, header, footer, gutter
page.gutterType                   LEFT_ONLY | LEFT_RIGHT | TOP_BOTTOM
page.body                         x = left (+gutter), y = top + header (+gutter for TOP_BOTTOM),
                                  width/height = paper minus margins, header, footer
page.pageBorder                   type, textBorder, fillArea, offset, layoutEffect = NONE
<object>.placement                ANCHORED | INLINE | LINESEG lineage
```

Top-level placement rules (`page-geometry.js`):

| Case | Resolution |
| --- | --- |
| `treatAsChar=0` | reference box by `horzRelTo` PAPER=paper, PAGE/COLUMN=body, PARA=paragraph; `vertRelTo` PAPER=paper, PAGE=body, PARA=paragraph. `LEFT/TOP` add offset, `CENTER` centers, `RIGHT/BOTTOM/OUTSIDE` subtract from the far edge |
| `treatAsChar=1` | body origin + the `lineseg` containing the control's text position + `outMargin`; objects on the same line advance a cursor. Run-level controls count 8 text positions |
| text paragraph with `linesegarray` | body origin + first line `horzpos/vertpos`, height from the line span |
| no `hp:pos` / no lineseg | previous behavior (flow counter now starts at `page.body.y`) |

DIM 1.3 is unchanged. DIM coordinates remain paper-absolute on the normalized 794×1123 page, so manual DIM, image-verified DIM and other import paths are not affected.

## Coordinate lineage (발주서.hwpx)

Before → after, format `x,y,width,height`. Semantic values are HWPUNIT; DIM, UBJF and Viewer values are px. UBJF and Viewer equal DIM in every row, before and after.

| Object | HWPX `hp:pos` | Semantic before | Semantic after | DIM/UBJF/Viewer before | DIM/UBJF/Viewer after |
| --- | --- | --- | --- | --- | --- |
| 발 주 서 title | PAPER 20399, 1874 | 0,1800,18749,3000 | 20399,1874,18749,3000 | 0,24,250,40 | 272,25,250,40 |
| 발주번호 / 공급받는자·공급자 table | PAPER 1500, 5924 | 0,5300,56400,7500 | 1500,5924,56400,7500 | 0,71,752,100 | 20,79,752,100 |
| Main item table (26×9) | PAPER 1500, 21149 | 0,20300,56393,39000 | 1500,21149,56393,39000 | 0,271,752,520 | 20,282,752,520 |
| 발주약정 | PAPER 1500, 67650 | 0,68300,56398,14924 | 1500,67650,56398,14924 | 0,911,752,199 | 20,902,752,199 |
| UBI STORM image | COLUMN 42224 / PAPER 2399 | 0,85798,14999,1874 | 42224,2399,14999,1874 | 0,1122,200,1 | 563,32,200,25 |

Paper: 59549×84224. Margins: all 0. Body = paper.

For 인사.hwpx (margins L/R 1984, T/B 1417, header/footer 1417), the body origin is (1984, 2834). Tables moved from x = 0 to 28–30 px, and from y = 24…882 to 42…941 px. That matches the HWPX Preview.

## Image

- UBI STORM: `BinData/image1.png` → manifest `image1` → `hc:img@binaryItemIDRef="image1"`. The asset extraction, DIM asset manifest, UBImage generation and Viewer render were already intact. The only failure was the geometry above. Fixed.
- The second picture (PAPER 46724, 61049, 10875×6374) has `binaryItemIDRef=""` in the source: it is an empty picture frame, drawn by Hancom as a dashed placeholder. It stays reported as `IMAGE_REFERENCE_MISSING`, now with its placement.

## Tests

- `npm run test:hwpx`: 15/15, including new `hwpx-page-geometry.test.js` (synthetic placement semantics) and `hwpx-geometry-fixtures.test.js`. The fixture tests cover 발주서 geometry, UBJF save/reload and determinism, plus 인사 Golden structure. Originals go in `test-input/hwpx/`. That path is gitignored, and the fixture tests skip when the originals are absent.
- Unit suite: 199/200. The remaining failure is `ai-builder-mvp042-integration`, which needs local `data/` draft state. It failed identically before this change.
- Viewer E2E (puppeteer + Chrome 146, same gates as `run-hwpx-mvp01-e2e.js`): 발주서 and 인사 Viewer 200, fatal 0, reload ×3, new context ×2 and server PDF all PASS. The pre-fix 인사 project reproduced the Golden DIM signature `87ab9c13…` and the PDF size of 63,747 bytes.

## Remaining fidelity differences

- Text: rendered font sizes are smaller than in Hancom. Multi-line cell text (for example 발주약정) loses its line breaks. The vertical label "공급받는자" wraps differently.
- The empty picture frame is not rendered.
- Paragraph alignment is not applied to inline objects. Multi-column sections map COLUMN to the body. Only the first page is laid out: `vertpos` of later pages is not paginated.
- Objects nested inside table cells keep their previous cell-relative placement.
- `pagePr@landscape` is recorded but width/height are used as stored. Both fixtures are portrait.

## AI Builder integration check

The editing workspace first showed the old placement: logo at `0,1122,200,1` and title at `0,24`. The cause was a stale dev-server process, not routing or the materializer. The AI Builder import route calls the same `analyzeHwpx()`, but the running `node src/server/index.js` had been started before the parser change and does not reload modules. Builder project `import_mvp13_20260921_192636_52bd39` carried DIM signature `a59dfbe7…`, which is the pre-fix signature. After restarting the dev server, the real flow (생성하기 → 발주서.hwpx → 생성 → 편집하기) produced DIM `681354cb…`. It showed title `272,25,250,40` and logo `563,32,200,25` in the Viewer iframe, and the same values held after Direct Edit → Save (Candidate `…_builder_…`), reload and a new browser context.

**Always restart the dev server after changing server code.**

Two notes:

- The header shows `SampleReport_FreeForm` because every import materializes into a unique `import_mvp*` project whose form folder is the template name. The header renders `metadata.title || formName`, and imports set no title. It is a display name only; the right project is loaded.
- `index.html` starts the Viewer iframe at `projectName=sample`, and `app.js` replaces it immediately. `app.js` still falls back to `sample` for project names outside its allow-list.
