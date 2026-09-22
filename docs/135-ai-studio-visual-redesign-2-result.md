# MySuit AI Studio - Reference-Driven Visual Redesign 2.0 Result

**Baseline.** Commit `d27f5df` (2.0). **Reference.** `ss.png` (repository root) is the official visual reference.

This phase changes presentation only. No operation, history, binding, HWPX parser, Viewer rendering, band capability, AI command or LLM change. Screenshots: `mysuit-mvp-work/screenshots/studio-visual-2/` (`before-*`, `after-*`, `after-1366-*`, `after-1920-*`, `after-compare-ss-vs-user-chat.png`).

## Reference (ss.png)

- White sidebar with a mint active row. The brand has a small tagline and a Studio card at the foot.
- The top bar shows the document title with a small breadcrumb under it. The right side has bordered undo/redo, a green cloud save status and a compact green 저장 button.
- A neutral workspace holds floating white cards: the Viewer (toolbar plus page area) and the right column.
- The right column has a pill tab pair with a solid green active tab. Under it: an AI intro card (large avatar and two-line heading), suggestion rows (icon, label, chevron), a composer with a green square send button and a hint, 또는, then a 직접 편집 card with four action tiles.
- Green is used as an accent only, at roughly 10-15% of the screen.

## Before problems

- Everything sat edge to edge: the Viewer and the panel were separated by a single rule, with no workspace around them.
- Brand and navigation:
  - the brand was small and had no tagline;
  - the navigation used glyph icons (↥ ✎ ▤ ▣ ◇ ⚙) crowded at the top.
- Top bar:
  - the breadcrumb came first, then the title, all at the same weight;
  - undo/redo were faint glyphs.
- Tabs:
  - tabs were underlined text, not a segmented control;
  - `grid-template-columns:repeat(3,1fr)` from `ai-builder.css` made two tabs fill only two thirds of the panel.
- Panels:
  - the chat was a single bubble with pill chips;
  - empty states were one line of text;
  - inspector groups were separated only by thin rules.
- The Viewer toolbar was grey (#F5F7F9), and the page area was the same white as the page.
- Band labels (11px, white chips) covered document numbers on the sample.
- Legacy CSS:
  - `styles.css` forces `.primary` blue with `!important`, so Studio buttons carried `primary` and `editing-workspace.css` needed `!important` to fight it;
  - `.brand span{display:none!important}` below 1100px;
  - `header span`/`header button` navy rules;
  - a blue focus ring.

## Tokens (`studio-theme.css`, source of truth)

- Colour:
  - new: `--studio-primary-strong`, `--studio-primary-tint`, `--studio-canvas` (#EEF2F0, the Viewer stage) and `--studio-warning-soft`;
  - existing: primary #087F52, soft/softer mint, bg #F5F7F6 and the text scale.
- Radius:
  - 6 / 8 (controls) / 10 (buttons, rows) / 12 (cards) / 14 (panels).
- Shadow:
  - `--studio-shadow-card` and `-float`: very light;
  - `-primary`: under green buttons;
  - `-knob`: switch knob and pressed pill;
  - `-page`: reserved, not used.
- Type:
  - `--studio-font` is Pretendard, then Apple SD Gothic Neo, Noto Sans KR, Malgun Gothic, Segoe UI and system-ui;
  - scale: title 18, section 13, body 13, caption 12, small 11.
- Layout:

  | Width | Sidebar | Panel | Gutter | Note |
  | --- | --- | --- | --- | --- |
  | Default | 236 | 400 | 16 | |
  | ≤1440 | 196 | 336 | 10 | The Viewer keeps about 800px: UView5 does not fit to width, and an A4 page is 794px. |
  | ≥1680 | 248 | 440 | 20 | |

  The collapsed sidebar is 72 and the top bar 64.
- Component stylesheets:
  - no new hex values; raw rgba values moved into tokens;
  - the only literal colours left are semantic error and warning colours on the create page.

## Changes

- **Sidebar** (`sidebar.js`, `shell.css`):
  - line SVG icons, and the tagline "AI가 만드는 / 더 스마트한 업무의 시작";
  - 48px items with a mint active row and green icon;
  - a Studio card at the foot that links to 생성하기;
  - the icon-only collapse toggle is kept;
  - the card hides when the sidebar is collapsed, below 1120px, and when the window is under 700px tall.
- **Logo:**
  - the brand slots are unchanged (`BRAND.logoMark`, `--studio-logo-mark`);
  - until artwork exists, the M fallback is a small 32px mark next to "MySuit AI Studio".
- **Top bar:**
  - document title (18px) with the breadcrumb `AI Studio › 편집하기` under it;
  - undo/redo are 38px bordered icon buttons;
  - a cloud icon's colour follows the save state (`data-tone` ok / dirty / busy / bad; the text is unchanged);
  - the 저장 button has an icon;
  - the fake "MS" avatar was removed from 생성하기;
  - no notification or user menu was added, because neither exists.
- **Workspace:**
  - the Viewer and the panel are rounded cards (14px) on the neutral workspace, separated by the gutter;
  - the Viewer chrome injection (`themeViewer`) sets the toolbar to white with a hairline and the stage to `--studio-canvas`. The page itself is untouched and reads as a white page.
- **Tabs:** a segmented pill; the active tab is solid green with white text. The three-column bug is fixed.
- **Designer (속성 / 데이터):**
  - Layout:
    - every section is a card with a 16px gap;
    - the 셀/행/열 switch is a small pill group;
    - selected-element card in mint;
    - danger zone stays red.
  - Empty state: a small icon, a title and one line of help.
  - Data:
    - the dataset tree is a clean list;
    - arrays carry a green `[ ]` mark;
    - hover rows are mint;
    - 자동 바인딩 is a secondary green action;
    - status colours: green for auto, amber for review.
  - Designer tools:
    - line icons;
    - at ≤1440 they float as a bottom bar so they do not cover the page header.
- **User Edit:**
  - Chat:
    - intro with a large avatar and "안녕하세요! / 무엇을 도와드릴까요?";
    - three suggestion rows with icon and chevron;
    - bordered composer, green square send button and hint;
    - 또는, then 직접 편집으로 빠르게 수정하기 with four tiles;
    - the tiles only open the 직접 편집 tab.
  - Direct edit with nothing selected: an empty state and a guide of what can be edited. The selection panels are unchanged apart from styling.
  - The fallback reply "AI 연결이 아직 설정되지 않았습니다." is unchanged.
- **AI drawer:** a floating white card with the same chat family (intro, suggestion rows, composer).
- **Band overlay:**
  - labels are small mint chips (10px, green text);
  - the engine name shows only on hover or selection. It stays in the DOM, so labels and tests are unchanged;
  - selected bands get a 1.5px green outline.
- **생성하기:**
  - font stack and token radii;
  - dashed mint dropzone, white icon with a mint ring;
  - token-based primary CTA.

## Legacy CSS conflicts

- The Studio buttons (`json-use`, `auto-binding`, `binding-apply`, `array-apply`) no longer carry the legacy `primary` class. The two `!important` overrides on `.ai-primary` were removed, and plain Studio-scoped rules now apply.
- The top-bar breadcrumb no longer uses `span`, so the `.brand span{display:none!important}` rule below 1100px cannot hide it.
- All new rules are scoped under `.ai-builder`, which overrides the legacy focus ring, `header span` and `header button` by specificity. No new `!important` was added.
- The three existing `!important` rules (`builder-legacy`, `builder-panel[hidden]`, the viewer-pane nav) were kept.
- `ai-builder.css` pinks (#b4232f, #c92736, #be2635, #e6aeb5) were mapped to tokens.
- `styles.css` and `design-system.css` were not changed, because the legacy review screens use them.

## Responsive (verified)

| Viewport | Sidebar | Panel | Viewer iframe | Notes |
| --- | --- | --- | --- | --- |
| 1920×1080 | 248 | 440 | 1172 | |
| 1600×900 | 236 | 400 | 914 | |
| 1440×900 | 196 | 336 | 878 | |
| 1366×768 | 196 | 336 | 802 | Page 794 fits. Brand overflow 0. The chat fits without cutting the greeting. Tools move to a bottom bar. |

## Tests

- **E2E, all pass:**
  - AI Studio UI (11);
  - Designer 2.0 (14): save/reload, bands, data, auto binding;
  - Interaction 3.2 (17);
  - Selection Lifecycle;
  - Structure 3;
  - Editing V2, V2 UX, Editing Workspace;
  - Upload UI, Upload Refinement.
- **Import MVP 1.2 editor:** passes with the browser library path set.
- **Unit tests:** 221 pass, 3 skipped (HWPX fixtures).
- **HWPX:** 12 pass plus the 3 fixture tests, run with the original files, so 15/15.
- **Not run:** `e2e-ai-builder-mvp01` needs `chromium-1234`, which is not installed on this PC.
- **Fixtures.** `test-input/hwpx/` is not present on this PC. The tests were run with the originals recovered from `uploads/ai-builder` through a scratch runner that changes only the fixture path.
- **`10_sharedCoreUndoRedoSave`** failed once during the first, loaded batch (while CSS was being edited). It then passed three times in a row. It is timing-sensitive, not a regression.
- **Test expectations changed for intended visual changes only:**
  - Layout constants:
    - sidebar 184 → 196 (≤1440) / 248 (≥1680);
    - panel 380 → 336 / 440;
    - collapsed width 64 → 72;
    - top bar 52 → 64;
    - viewer width = W − sidebar − panel − 3 × gutter;
    - brand box height 36 → 40.
  - The designer top-bar list reads the aria-label for the icon-only undo/redo.
  - Theme: the active tab is checked as a green background with white text.
  - The user chat suggestions and placeholder follow the reference copy.

## Remaining visual issues

- The approved logo artwork is still missing; the M fallback is shown.
- The title has no rename pencil. Renaming does not exist, so none is drawn.
- The UView5 toolbar keeps its own icon set and density. It is busier than the reference, where the toolbar is a separate card.
- The page has no drop shadow, because the chrome style does not target the canvas container. The stage tone separates the page instead.
- The save status shows the existing states ("저장 안 됨", "저장 완료"), not "자동 저장됨 · 방금 전", because there is no autosave timestamp.
- At 1366, the designer tool bar floats over the bottom of the page.
