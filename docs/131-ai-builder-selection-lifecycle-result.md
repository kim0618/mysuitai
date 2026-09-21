# AI Builder — Direct Edit Selection Lifecycle 3.0.1 Result

## Selection ownership

| Layer | Created by | Owner | Cleared by |
| --- | --- | --- | --- |
| Cell/object selection + orange highlight | `viewer-inspector` `mouse:down` handler | inspector `selected`, app `state.selection/source` | `clearSelection()` via `mvp:clear-object-selection` |
| Floating text toolbar | `DirectEditor.select()` from the same handler | `direct-editor` | `direct.clear()` (inside `clearSelection()`) |
| Fabric active object + borders/handles | Fabric 1.5 itself on `mouse:down` (`setActiveObject`) | Fabric canvas `_activeObject` and each object's `active` flag | `clearNativeSelection()`: `discardActiveObject()` and reset of `active` flags |
| Row/column selection, band, marker | `static-single-table-controller` `intercept()` / `selectRow` / `selectColumn` | controller `selection` | `clearSelection()`, `setMode()`, leaving 직접 편집 |
| Right panel target | Builder shell | `state.selection`, `state.source`, `state.staticSelection` | `clearViewerSelection()` |

## Root cause of the handle artifact

Fabric 1.5 makes the clicked object active on `mouse:down` and paints borders/handles for it. In 셀 mode the inspector path discards it afterwards. In 행/열 mode (3.0), a cell click was intercepted as a row/column selection, and that path never discarded the Fabric selection. The cell stayed `_activeObject`, and its handles (□) and border were painted next to the row band. The artifact was never a separate object or DOM element: canvas objects and DOM nodes showed nothing extra, while the Fabric state showed the active cell. Other layers were cleared by different code paths, and nothing cleared all of them in one place.

## Contract

- **Single active selection.** Every transition runs `clearViewerSelection()` first; it clears the object selection, toolbar, Fabric native selection, row/column band and panel state.
- **Focus-out.** The following end the selection and keep the 셀/행/열 mode:
  - A `mouse:down` on the canvas with no selectable target (blank paper).
  - A `mousedown` in `#canvasArea` outside `.canvas-container` (the grey area around the page).
  
  The panel then shows the mode's empty state (표에서 편집할 셀/행/열을 선택하세요.) and the last cell is forgotten, so a later mode switch does not bring the selection back.
- **Clicks that keep the selection.** The right panel, its steppers, toggles and inputs, the floating toolbar (it stops `mousedown` propagation), and Save/Undo/Redo. They are outside the canvas, so they never reach the Viewer handlers.
- **Mode switch.** The switch clears everything first. In 행/열 mode the last selected or clicked cell seeds the row or column; 셀 mode starts empty.
- **Another object.** Selecting another object replaces the previous one. An object selection also clears a row/column band.
- **Leaving 직접 편집 (채팅/데이터 연결).** Every layer is cleared and the last cell is forgotten. The 셀/행/열 mode is kept for the return.
- **Mode switch visibility.** The 셀/행/열 switch is always shown when the document has tables, including while an image is selected.

## Changed files

- `src/client/viewer-inspector.js`: `clearNativeSelection()`; row/column intercept clears it; blank paper/grey-area focus-out event; listener removed on detach.
- `src/client/static-single-table-controller.js`: `clearSelection(forget)`, last-cell tracking, `selectCell` drops a row/column band.
- `src/client/ai-builder/ai-builder-shell.js`: central `clearViewerSelection()` / `clearDirectSelection()`, mode transitions, focus-out handling, mode switch always visible.
- `tests/e2e-ai-builder-selection-lifecycle.test.js`: new.

## Verification

- **Selection-lifecycle E2E, run on the real 발주서.hwpx flow: 16/16.** Beyond visible state it checks Fabric `_activeObject`, `active` flags, upper-canvas ink and stale lower-canvas pixels (`renderAll()` must change nothing). Removing the intercept fix makes B/D/F fail.
- **Regression:** structure-3, editing-v2-ux, editing-workspace, import-mvp12-editor, upload-ui, mvp01 and mvp44 pass. editing-v2 fails only the font-environment `sidebarVisualConsistency`.
- **Unit tests:** 215/216. The remaining failure is the pre-existing `data/`-dependent `ai-builder-mvp042-integration`.
- **HWPX tests:** 15/15.

## Limitations

- A blank click on a non-selectable object counts as blank; for example, an empty label that is not an imported cell.
- The Viewer's own toolbar (`HEADER.edit-tool-wrap`) is not treated as focus-out.
- The legacy sample form's row/column grips use their own selection and were not changed.
