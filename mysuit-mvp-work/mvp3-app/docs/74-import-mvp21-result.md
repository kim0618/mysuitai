# Import MVP 2.1 Result

## Verdict: B

The first external-image benchmark completed Image → Codex DIM → Validator → Freeze → Existing Generator → Viewer → Editor correction → separate Candidates → PDF. Structure and content were fully recovered, and only three geometry corrections were needed for a usable draft. Visual fidelity remains substantially limited by table style capabilities.

## Q1–Q13

1. TEXT recovery was 26/26 logical regions with exact observable content.
2. Yes. One line-item table was detected.
3. Columns, rows, and cells were exact at 4/3/12.
4. Cell text was 12/12.
5. Yes. Layout geometry is suitable as a draft; TEXT container error is not numerically claimed without ground truth.
6. Missing styles include per-cell background/text color, border visibility, vertical alignment, mixed cell bold, font color, and font family.
7. Unsupported elements: two rectangles; images/logos/lines/charts: zero.
8. Yes. The Editor attached directly and discovered the complete logical table.
9. Three manual corrections were required.
10. Yes. PDF returned HTTP 200, 29,572 bytes, one page.
11. The main bottleneck is the DIM table-style contract plus per-cell Generator styling, not Analyzer structure recognition.
12. Next priority should be DIM Style v1.2 and per-cell table style generation, especially backgroundColor, textColor, border visibility/color/width, and verticalAlign.
13. Yes. A convincing structure/content demo is possible today, but it should be presented as an editable draft rather than a style-faithful replica.

The next step should be style expansion before a Visual Refinement Loop or UBImage work: this invoice contains no meaningful image/logo, and its largest fidelity gap is the white borderless body versus the red prototype-styled generated table.
