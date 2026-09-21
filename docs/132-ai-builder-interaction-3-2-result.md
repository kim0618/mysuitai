# AI Builder — Direct Edit Interaction 3.2 Result

This release adds multi-select, drag & drop and snapping to Direct Edit, and fixes a pointer that could stay attached to an object after a drag.

## Pointer lifecycle

**Root causes**

- A free move started on every selectable object, including table cells, and ended only on the Viewer's own `mouse:up`/`mouseup`. The move handler ignored the button state. After a release that the Viewer never saw, plain mouse movement kept dragging the object.
- Mouse events of a drag that started inside the Viewer frame keep arriving in the frame (implicit capture). A release over the Builder panel was therefore treated as a normal drop, possibly off the page.

**Fixes**

- Table cells never start a free move. Their position belongs to the table, so row/column structure moves them.
- A move with no button pressed finishes the drag.
- A release outside the Viewer viewport cancels the drag: the object returns to where the drag started and nothing is recorded. While the pointer is outside, the object stays at its last position inside.
- A drag is cancelled only when the browser window really loses focus (`document.hasFocus()`). Focus moving from the Builder into the Viewer frame on mousedown is not a loss of focus; treating it as one broke image dragging during development.
- `drag-session.js` gives structural drags one lifecycle: `start → update → finish | cancel`.
  - It listens on the Builder window and the Viewer frame for `pointermove`, `pointerup`, `pointercancel`, real blur and Esc.
  - Every end releases pointer capture, resets the cursor and removes the drag overlays (insertion line).

## Selection

Selection sets (row and column modes):

| Input | Result |
| --- | --- |
| click | the clicked merge group |
| Shift+click | a contiguous range from the anchor, widened to whole groups |
| Ctrl/Cmd+click | toggles the clicked group |

- The Viewer draws one band and one marker per contiguous run, labelled like `3–4`. It does not show R/C labels.
- A drag handle (⋮⋮ for rows, ⋯ for columns) appears only when the selection is a single contiguous run.

**Merge groups.** `layout().rowGroups/columnGroups` are the smallest runs closed under merges that span that axis. In 발주서, every item (two lines plus the 순번 rowspan) is one group, so selection and moves act on whole items. A merge that covers the whole axis is ignored, for example a title row spanning every column. It stays contiguous under any order, so the columns under it still move one by one.

## Drag and snap

- **Drag and drop.** Dragging a handle shows an insertion line. The drop point snaps to the nearest allowed boundary: a group boundary outside the dragged run. Boundaries inside a merge group are never offered. A drop commits `moveRows` or `moveColumns` as one operation.
- **Buttons.** The ↑↓ / ←→ buttons move the selection past the neighbouring group with the same operation.
- **Server check.** The server accepts a set move only if every merge still occupies a contiguous run afterwards. Otherwise it returns `ROWSPAN_DEPENDENCY` or `COLSPAN_DEPENDENCY` with a plain message.
- **Free-object magnet.** While an image or text is dragged, it snaps to page edges and centres and to nearby object edges and centres. Table cells are not free objects. `object-snap.js` defines the distance setting `SNAP.distance = 6` px, a magnet toggle (`setEnabled`) and dashed guide lines that are cleared on drop or cancel.

## History

A drop or button move is one `moveRows` / `moveColumns` operation, so it is one history event: Undo restores the whole move and Redo reapplies it. Resizing several selected rows or columns uses `PUT /api/structure-operations/batch`, which applies all operations inside one `history.transact`. If any operation fails, the whole batch is rolled back.

## Right panel

The row/column editor is one card with separate groups: 이동, 크기 and 표시. A single physical track also gets a separate 위험 작업 zone. For several tracks, 크기 applies to all of them; 표시 and 삭제 require exactly one track.

## Changed files

- **Server**
  - `static-table-structure-adapter.js`: groups and set moves (`moveRows`, `moveColumns`).
  - `structure-operation-service.js`, `operation-registry.js`, `capability-service.js`, `operation-validator.js`: the set moves are validated and registered.
  - `routes/structure-operation-routes.js`: batch endpoint and history descriptors.
  - `history-service.js`: labels for the new operations.
- **Client**
  - `drag-session.js`, `object-snap.js`: new.
  - `static-single-table-controller.js`: selection sets, handles, drag.
  - `viewer-inspector.js`: pointer lifecycle and magnet.
  - `ai-builder/ai-builder-shell.js`, `editing-workspace.css`: panel card.
  - `index.html`: loads the new scripts.
- **Tests**
  - New: `e2e-ai-builder-interaction-3-2.test.js`, `object-snap.test.js`, `structure-batch-route.test.js`, and additions to `static-table-move-rule.test.js`.
  - Updated for merge groups: `e2e-ai-builder-structure-3.test.js`, `e2e-ai-builder-editing-v2.test.js`.
  - Updated for the new operation count (34): `mvp59-artifacts.test.js`.

## Verification

**Interaction 3.2 E2E on the real 발주서 flow: 17/17.**

- Pointer: no stuck pointer, drags end on outside release and on blur.
- Selection: single, Shift and Ctrl selection.
- Drag: insertion line; a boundary inside an item is skipped; whole-item drop; one undo / one redo; column drag; free-object magnet.
- Batch: multi-row resize is one history step.
- Persistence: save, reload and a new browser context keep the result.
- UI: no stale overlay after a mode switch, blank-click focus-out, the sectioned panel.

**Regression.**

- Pass: selection-lifecycle 16/16, structure-3, editing-v2-ux, editing-workspace, import-mvp12-editor, upload-ui, mvp01, mvp44, mvp57, pre-ai-v11-row-pointer.
- editing-v2 fails only the font-environment `sidebarVisualConsistency` check.
- Unit tests: 223/224. The remaining failure is the pre-existing `data/`-dependent `ai-builder-mvp042-integration`.
- HWPX tests: 15/15.

**Legacy sample-form E2Es.** mvp41, mvp411, mvp51, mvp53, rendered-row-drag, unified-ux, data-band-click and pre-ai-v11-row-resize fail. They fail identically on the untouched HEAD code, checked against a HEAD worktree served at the same path, so they are pre-existing.

## Limitations

- A non-contiguous selection (Ctrl) cannot be moved; the panel says so. Size changes still apply to all selected tracks.
- With merge groups, the two lines of one item can no longer be swapped from the UI. The adapter still accepts that move (`moveRow`) through the API.
- Header and body tables in 발주서 remain separate tables; moving a body column does not move the header column.
- The magnet does not snap a resize, only a move. There is no UI toggle yet; `MvpObjectSnap.setEnabled` is the hook for one.
