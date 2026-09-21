# AI Builder Foundation 0.2 — Binding History Design

## Scope

Foundation 0.2 adds Binding to the existing Source/Render/Structure History timeline. It does not create a second timeline, change the UI, or add matching/analyzer/AI behavior. The imported form after import is the History base; import itself is not undoable.

The older `42-mvp58-history-design.md` and `43-mvp58-history-result.md` references were not present in this workspace. The implementation in `history-service.js`, its routes, and the MVP 5.8 tests were therefore treated as authoritative.

## Existing History implementation

- Service: `src/server/services/history-service.js`
- Controller/API: `src/server/routes/history-routes.js`
- Persistence: `data/history.json`, schema version 1, atomically replaced through a temporary file
- Scope key: `layoutDraftId|projectName|formName`
- Snapshot before Foundation 0.2: `sourcePatches`, `renderPositionPatches`, `structureOperations`
- Cursor state: base snapshot at cursor 0; each event owns complete `beforeState` and `afterState`
- Undo/redo: deterministic snapshot restore rather than inverse operations
- Redo branch: events after the cursor are sliced before a new event is appended
- Limit: one shared maximum of 200 events per draft
- Failure: store state is restored and the cursor is not published if mutation/restore/persistence fails

## Binding state model

`src/server/services/binding-operation-service.js` is the scoped Binding Store. It persists canonical operations in `data/binding-operations.json` and isolates them by the same draft/project/form identity as History.

Each target has at most one current canonical operation:

- bind: `bindField`, `before: null|Binding`, `after: Binding`
- rebind: `bindField`, `before: Binding A`, `after: Binding B`
- unbind: `unbindField`, `before: Binding`, `after: null`

Target identity is `target.objectId` (with `sourceObjectId` accepted as the existing materializer fallback). Supported targets are exactly one `UBLabel` or `Cell` in the scoped base form. Missing or ambiguous targets fail with `BINDING_TARGET_NOT_FOUND`; restore never silently skips them.

Dataset bindings use `dataType="1"`, `dataSet`, `column`, and optional expression text. Parameter bindings use `dataType="3"` and `parameter`. Dataset/column existence remains a final materializer validation because dataset definitions are candidate inputs, not draft Binding Store data.

## Snapshot contract

The History snapshot is now:

```json
{
  "sourcePatches": [],
  "renderPositionPatches": [],
  "structureOperations": [],
  "bindingOperations": []
}
```

Capture and restore cover all four stores. Old persisted snapshots without `bindingOperations` restore it as an empty array. Public History responses still omit internal snapshots, so the existing API contract is preserved.

## Transaction and event contract

`PUT /api/binding-operations` executes Binding mutation inside `history.transact`. Events use the existing generic schema with `scope="BINDING"`, `operation`, `target`, `before`, and `after`. `GET /api/binding-operations` returns only the requested scope.

One API call is one user action and one History transaction. No extra Binding coalescing is introduced. Repeated materializer inputs may still be normalized per target without rewriting History events.

## Cursor materialization

`src/server/ai-builder/history-materializer.js` obtains a complete snapshot through `rebuildEditorStateFromHistory(scope, cursor)` and passes its Source, Structure, and Binding arrays to the Foundation 0.1 unified materializer. Candidate publication and parse-back validation remain atomic and retain the existing apply order:

`Base clone → Dataset preparation → Structure → Source → Binding → validation → atomic publish`.

## Failure and identity rules

- Forced undo/redo failure occurs before restore and preserves cursor plus all stores.
- Restore failure triggers restoration of the pre-transaction complete snapshot.
- Binding targets are validated on write and restore.
- Removed-target conflicts remain fail-closed in the unified materializer.
- Structure operations preserve verified Cell identity, so undoing a later removal can restore the earlier bound target deterministically.
- The shared 200-event policy applies to Binding without a second quota.

