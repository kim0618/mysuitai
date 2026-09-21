# MySuit AI Studio - Developer Studio Designer 2.0 Result

**Baseline.** Commit `4016711` (feat(ai-studio): introduce studio shell and user edit workspace) freezes the state before this work.

This phase turns 편집하기 (developer surface) into a designer. It adds no new engine, LLM, HWPX parser change or dataset/binding rewrite. Every edit still goes through the existing Operation, History and Materializer path. 사용자 편집 (user surface) is unchanged.

## Screen

| Area | Before | Designer 2.0 |
| --- | --- | --- |
| Right panel | 채팅 · 직접 편집 · 데이터 연결 | **속성 · 데이터** (default 속성) |
| Chat | a tab | **AI 도우미** drawer, opened from the top bar (`✦ AI 도우미`); same chat panel and API |
| Top bar | ↶ ↷ 저장 | ↶ ↷ **✦ AI 도우미 · 미리보기** · 저장 |
| Tools | none | 선택, 밴드 보기, 추가 (준비 중, disabled) |
| Viewer toolbar | pink active state | studio green (chrome only) |

- **미리보기.** Switches the workspace mode to `preview` on the same Viewer: the side panel and the tools are hidden, clicks select nothing and the button reads 편집으로 돌아가기.
- **Tools.** Only supported tools are active. 밴드 보기 is disabled for free-form (imported) documents. Adding objects is not implemented and says so.
- **Viewer chrome.** `themeViewer()` injects a `<style id="studio-viewer-chrome">` into the Viewer frame that maps the UView5 chrome variables (`--viewer-btn-active`, `--font-point`, `--bg-point`, `--viewer-themeB-icon-point`) to the Studio tokens. Document rendering is not touched.

## Properties (context sensitive)

| Selection | Sections |
| --- | --- |
| Nothing | 문서 (title, page size, origin) and 구조 (band list, or "밴드가 없는 자유 배치 서식입니다" for free form) |
| Text | 텍스트 · 글꼴 · 위치 및 크기 (collapsible) |
| Table cell | 셀 편집 · **표** (rows/columns, 이 행 편집 / 이 열 편집) · 표시 · 표 위치 및 크기 |
| Row / column | the existing row/column editor (move, multi-select, hide, width) |
| Image | **이미지** first, then 크기 · 위치 · 표시 and 이미지 교체 |
| Band | band kind, engine name, dataset, object count, design box |

The selection card no longer shows source IDs (`IMPIMG…`, `IMPTB…`); they stay under 고급 설정.

## Bands

- `GET /api/ai-builder/bands?projectName&formName&viewProject` reads the bands (`UB*Band` page items) of the form the Viewer is showing.
  - `viewProject` must be the project itself or a candidate derived from it (`<project>_…`) under the projects root.
  - It returns each band's kind, Korean label, engine name, design box, dataset and object count, plus the form datasets and `freeForm`.
- `designer-bands.js` draws the overlay inside the Viewer frame.
  - A band's area is the union of the objects rendered for it (repeated DataBand rows included); otherwise its design box.
  - Only the label chip takes clicks, so the band never blocks document selection. Clicking it selects the band and shows its properties.
  - Colours come from the Studio tokens (`color-mix` tints of `--studio-primary`).
  - It is drawn only on the developer surface, in edit mode, with 밴드 보기 on.
- Imported HWPX forms have no bands. None are invented; the document card says the form is free form.

## 데이터

- **Dataset tree.** Built from the Import Context JSON schema, or from the form datasets for the sample.
- **자동 바인딩.** One button runs the existing proposal flow (`applyProposals`). Each proposal row shows its confidence (for example 문서번호 → `$.documentNumber` 92%). Results are applied through the same binding operation and history as before.

## Also fixed

- `/api/ai-builder/context` failed for the built-in sample (`IMPORT_TEMPLATE_INVALID`) because it read an Import Context that only imported documents have. It now reads it only for `origin === 'IMPORTED'`.
- Band datasets named `'null'` are treated as no dataset.

## Verification

- **Designer E2E (`e2e-ai-studio-designer.test.js`): 14/14.** Real 발주서.hwpx flow, the sample for bands, 인사.hwpx + JSON for data.
  - Layout, free form without bands.
  - Cell and image properties.
  - Row editing with undo/redo, multi-select.
  - Preview, Viewer toolbar theme, AI 도우미 drawer, save and reload.
  - Band visualization and selection, data panel, auto binding applied.
  - No page errors.
- **Regression.** See the report; existing E2E tests were updated only where the intended UI changed:
  - 채팅 tab → drawer;
  - tab names 속성 · 데이터;
  - new top bar buttons;
  - the table card replaces the 셀/행/열 편집 buttons in the cell panel;
  - isolation checks use 미리보기.
- **Unit tests:** 223/224 (the pre-existing `data/`-dependent mvp042 test fails). **HWPX tests:** 15/15.

## Not in scope / remaining (Designer 2.1)

- Adding objects (text, image, table, band) from the palette.
- Editing band properties (height, dataset, repeat) and moving objects between bands.
- Linked header/body column moves.
- Multi-page designer.
- A layer/object tree.
- Grid and rulers.
- Precise geometry input with units.
- Replacing the chat drawer's rule-based responses with the AI Command Layer.
