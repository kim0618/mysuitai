# AI Builder — Direct Edit UX & Structure Editing 3.0 Result

## Interaction model

Imported tables get a 셀 / 행 / 열 switch at the top of 직접 편집. The default is 셀, and the panel shows one editor for the current selection.

| Mode | Viewer click on a table cell | Viewer overlay | Right panel |
| --- | --- | --- | --- |
| 셀 | Selects the cell. The floating text toolbar works. | Cell highlight only. No R/C/TABLE labels. | 셀 편집 (내용, 글자 크기, 굵게, 정렬) + 표시 |
| 행 | Selects that cell's row. No cell selection, toolbar, inline edit or context menu. | One band around the row and a small position marker | 행 편집: 현재 행 n / total, ↑↓, 행 높이, 자동 맞춤, 행 숨김, 위험 작업 › 행 삭제 |
| 열 | Selects that cell's column. Same isolation. | One band around the column and a marker | 열 편집: 현재 열 n / total, ←→, 열 너비, 자동 맞춤, 열 숨김 |

Images and free text keep their editors, without the mode switch. Switching mode clears the other kind of selection. When a cell was selected, switching to 행/열 selects that cell's row/column. The panel shows no table ids or R/C labels; the source id stays under the collapsed 고급 설정.

Selection mode is routed where the clicks happen:

- `MvpTableSelection.claims/intercept` (`static-single-table-controller.js`) is consulted by the Viewer click handler (`viewer-inspector.js`).
- The same hook covers the text toolbar's double-click and context menu (`direct-editor.js`).

## Root causes

**Row move.** `capability-service` blocked `moveRow` whenever the row was covered by any rowSpan (`rowSpanDependent`). In 발주서's item table, 순번 spans the two lines of every item, so all 26 rows were blocked before the structure adapter ran. The adapter already had the exact rule (`assertPermutable`): a permutation must stay inside a merge block or clear of it. That rule was never reached.

**Column move.** Static-table `moveColumn` was stored as an upsert per column. The next move of the same column rewrote the earlier step in place, at its old sequence position. Moving a column back to where it started became `from === to` and failed with `INVALID_VISUAL_INDEX`. With later moves of other columns, it could also resolve to a different order than the one on screen.

**Repaint (found during acceptance).** The Viewer's Fabric build has no `canvas.requestRenderAll`, so the table controller's `requestRenderAll?.()` did nothing. Moved cells had the right coordinates but were only repainted when another component happened to call `renderAll`.

## Merge dependency rule

- **Before:** any row covered by a rowSpan could not move at all.
- **After:** a swap of positions `p` and `p±1` is allowed unless it cuts through a merge. A merge blocks the swap when exactly one of the two positions lies inside its range; a swap inside a merge is fine. rowSpans never block column moves, and colSpans never block row moves.
- **Behavior inside a merge:** after a swap inside a merge, the anchor returns to the block's top-left.
- **Movability:** `layout().rowMoves / columnMoves` expose per-direction movability. The panel disables a direction with 「병합된 셀이 나뉘게 되어 아래로 옮길 수 없습니다.」, and the server returns the same wording.
- **Unchanged:** hide/delete of merged rows keeps the previous guard.

## Changed files

- `src/server/services/static-table-structure-adapter.js`: `permutable` and movability in the layout; plain messages; merge anchors excluded from row identity after in-merge swaps.
- `src/server/services/capability-service.js`: no coarse `moveRow` block for static tables; plain reasons.
- `src/server/services/structure-operation-service.js`: static `moveColumn` recorded once per action.
- `src/server/routes/structure-operation-routes.js`: history "before" index taken from the client.
- `src/client/static-single-table-controller.js`: selection modes, band + marker instead of global R/C/TABLE grips, `renderAll` fallback.
- `src/client/viewer-inspector.js`, `src/client/direct-editor.js`: mode-aware click, double-click and context menu.
- `src/client/ai-builder/ai-builder-shell.js`, `editing-workspace.css`: mode switch, single editor, row/column panels, danger zone.
- Tests:
  - New: `tests/static-table-move-rule.test.js`, `tests/e2e-ai-builder-structure-3.test.js`.
  - Updated to the mode model: `tests/e2e-ai-builder-editing-v2*.test.js`.

## Verification

- `e2e-ai-builder-structure-3`, run on the real flow (생성하기 → 발주서.hwpx → 생성 → 편집하기 → 직접 편집): 12/12. It covers cell mode, mode switching, row/column moves, undo/redo, the merge block, save, reload, a new browser context and tab isolation. The moves are also checked on painted pixels, and that check fails if the repaint fix is reverted.
- Unit: 215/216. The remaining failure is the pre-existing `ai-builder-mvp042-integration`, which needs local `data/` state.
- Regression E2E: editing-v2 passes every step except `sidebarVisualConsistency`, a font-environment check that fails identically without these changes. editing-v2-ux, editing-workspace, upload-ui, import-mvp12-editor, mvp01 and mvp44 pass.

## Limitations

- In 발주서, an item can only reorder its own two lines. Moving a whole item past another item would split the 순번 merge, so it is refused. Moving a merge block as a unit is not implemented.
- 발주서's column headers are a separate table (IMPTB0004), so moving a body column does not move its header.
- After a structure change the Viewer may briefly redraw (history reload); the final state is correct.
