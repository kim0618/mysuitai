# AI Builder Implementation Readiness Audit

AI Builder Readiness 최종 판정: **PARTIALLY_READY**

Audit date: 2026-09-16 (Asia/Seoul)  
Method: source, fixture, generated evidence, and test-code review only. No tests or state-changing scripts were executed.

## A. Current Architecture

The browser app is already a shell: `src/client/index.html` places the existing UView5 URL in `iframe#viewer` and an editor in the sibling `aside`. `src/client/app.js` selects the runtime project from query parameters, constructs `/mysuit/UView5/index.jsp?projectName=...&formName=...`, and the Node server proxies `/mysuit/*` to Tomcat. The parent attaches only after a stable Fabric canvas exists.

Selection and preview are implemented by `viewer-inspector.js`. It directly accesses the same-origin iframe's `canvasModule`, subscribes to Fabric events, parses runtime IDs, and calls the parent selection callback. `direct-editor.js` injects the inline editor and toolbar into the iframe document. There is no product-level `postMessage` protocol.

The editor state is split into three persisted stores: Source Patches in `changesets.json`, render-position patches in `render-patches.json`, and structural operations in `structure-operations.json`. `history-service.js` captures/restores all three as one transaction snapshot. Candidate materialization is separate: source-property candidates use `patchFormProperties`; static structure candidates use `static-table-structure-adapter`. A mixed source+structure candidate is explicitly rejected.

Static Import is a server library and script pipeline: DIM validation, prototype cloning, UBLabel/UBTable generation, UBJF serialization, project creation, direct UView5 rendering, and server PDF. There is no upload/import HTTP route. The image side is frozen evidence: the repository defines an analyzer contract and checked-in DIM artifacts, but contains no general runtime OCR/image analyzer.

Dynamic MVP 3.1 is an independent generator path. It validates a rigid Semantic Model, creates one compressed embedded dataset, seven bands and eight tables from one fixed ground-truth form, writes dataset/system bindings, serializes a new project, and has unit/runtime evidence. It is not admitted by the current FormContext, editor, stores, or candidate services.

## B. REUSE

- UBJF codec: `form-patch-service.readForm/writeForm`.
- DIM v1.2 validation, text/table generation, style mapping, stable imported IDs, atomic imported-project creation.
- Embedded Dataset compression/row encoding.
- Existing dataset and system-function binding writers.
- UView5 URL/proxy, toolbar, navigation, zoom, continuous scroll, dialogs, export and server PDF.
- The iframe/Fabric selection proof, imported raw Source IDs, render-instance identity, direct property-edit operations, static logical table discovery, operation validation, history transaction mechanics, and store scoping by draft/project/form.

## C. MODIFY

- Extract the current editor shell into a Builder route while retaining the Viewer iframe.
- Replace the hard-coded project-name allow lists and single imported form-name assumption with metadata-derived, safe contexts.
- Turn the private same-origin inspector callback into a small documented Viewer Bridge contract.
- Add Import HTTP orchestration around the existing validator/generator/project service; keep mutation in the new project only.
- Extend target discovery to include decoded label/cell text, table roles, binding metadata, and label-to-value relationships.
- Generalize the binding writer for parameter/scalar bindings and arbitrary cell counts/datasets.
- Extend History snapshots with a binding store.
- Replace the split source/structure candidate paths with one canonical ordered materializer before claiming combined Save/Reload.
- Add a Band-aware dynamic context/model before allowing array-table editing or dynamic candidate/history.

## D. NEW

- JSON Schema Analyzer and validator.
- Binding Target Resolver layer above raw object/table discovery.
- Deterministic Binding Matcher and alias dictionary.
- Binding Review Store/API and review panel.
- Scalar/array runtime-data normalization into MySuit parameter/dataset models.
- Binding materialization adapter and canonical candidate materializer.
- AI Builder route, import screen, workspace controller, and documented Viewer Bridge facade.

## E. DO NOT TOUCH

- UView5 core renderer and Fabric implementation under Tomcat.
- UView5 toolbar/navigation/zoom/dialog/export implementation.
- Server PDF engine and request format.
- Original `form.ubjf`, `info.xml`, ground-truth UBJF, imported bases, existing candidates, PRE-AI fixtures/baseline, frozen DIMs, and Dynamic fixtures.
- Existing low-level UBJF codec unless a separately tested lossless-format defect is found.

`viewer-inspector.js` or a new facade beside it is a **MINIMAL BRIDGE CHANGE** area; UView5 itself is not.

## F. Major Blockers

### P0

1. **Canonical combined materialization**: `src/server/index.js` still returns `MIXED_CANONICAL_SERIALIZER_UNAVAILABLE` when source patches and structure operations coexist. Binding adds a third mutation class. Without one deterministic order and reparse/diff validation, the required Binding → Edit → Save → Reload flow is unsafe.
2. **Binding persistence/materialization contract**: there is no binding store, history snapshot field, candidate writer, or API.
3. **Runtime scalar contract choice**: decide and prove parameter binding (`dataType="3"`, `{param:name}`) versus a one-row dataset. Parameter syntax exists in `test-input/edu_01.ubjf`, but no writer or test exists.
4. **UI Import API**: no upload/JSON size/type validation or server route exists.

### P1

- Target semantics beyond raw identity: label/value pairing and static/repeating classification.
- Viewer Bridge contract and resize/zoom/dialog regression in a narrower workspace.
- Safe context generalization for newly named Builder projects.
- JSON analyzer/matcher and review workflow.
- Band-aware context, target identity, history and candidate support for one array.

### P2

- Multi-page authoring/selection validation.
- Group/aggregate authoring, multiple arrays, nested arrays, HWP/HWPX/DOCX/XLSX, runtime LLM, AI Chat/New.
- Cross-origin Viewer support; the current deployment is intentionally same-origin.

## G. Viewer Integration

Recommendation: keep an iframe on the left, using the existing Node `/mysuit/` proxy so parent and UView5 remain same-origin. Put Binding and Direct Edit tabs in the parent right panel. This already matches the present DOM topology and isolates UView5 CSS/dialogs from the shell.

Do not use a shared DOM container: UView5 owns a large legacy DOM, globals, overlays, dialogs, toolbar, and canvas lifecycle. Moving it into the shell DOM creates CSS/global collision risk. Do not replace the iframe with a new Viewer.

The bridge should expose only `ready(context)`, `selectionChanged(identity, readableProperties)`, `getViewport()`, `applyPreview(patches)`, `refresh()`, and operation dispatch. The existing implementation can back this facade with same-origin `contentWindow`; future `postMessage` is optional. Current selection is page 0/canvas 0 and uses runtime `renderIndex` plus fingerprint where IDs can repeat.

Width/scale is **PARTIAL**. The iframe naturally resizes as a flex/grid child and UView5 has zoom controls, while `direct-editor.geometry()` compensates for canvas CSS size and viewport transforms. There is no explicit ResizeObserver or Builder-width regression proving toolbar/dialog/export behavior at the target panel width. Preserve a minimum Viewer width and test UView5 fixed overlays/dialogs.

Answers: Q2 **YES** for same-origin iframe reuse; Q3 **YES** for supported UBLabel/Cell identities and **PARTIAL** globally; Q4 **PARTIAL**, because source/static operations share the operation/history architecture but binding operations and Dynamic contexts do not yet exist.

## H. Import Pipeline

Actual static path:

| Stage | File/function | Input | Output/generalization |
|---|---|---|---|
| Image analysis | contracts/docs + `scripts/build-import-*` and frozen DIM | fixed evidence image/DIM | No general runtime analyzer; fixture/development-only |
| DIM validation | `import/dim-validator.js::validateDim` | v1.0–1.2 object | normalized validated DIM; text/table only |
| Text generation | `import/import-label-generator.js::createImportedLabel` | prototype + DIM text | cloned static UBLabel, `IMPLB####` |
| Table generation | `import/import-table-generator.js::createImportedTable` | prototype + DIM table | static rectangular UBTable, `IMPTB/IMPCL####` |
| Style | `import/import-style-mapper.js` | DIM styles | UB properties/borderString |
| Project | `import/import-project-service.js::createImportedProject` | DIM + options | isolated project, UBJF, metadata, preview URL |
| Codec | `services/form-patch-service.js` | compressed base64 UBJF | parsed root/pages and rewritten UBJF |
| Viewer | UView5 `index.jsp` through Node proxy | project/form query | Fabric canvas/runtime objects |
| PDF | UView5 `canvasModule.captureAll(); mainModule.callService('savePDF')` | rendered project | server PDF response |

The generator clones `sample/SampleReport_FreeForm`, optionally borrows `TB7451` from `Sales/SL_Report_01`, removes template objects, inserts generated objects, reparses, checks counts/shape, writes metadata, then atomically renames the temporary project.

Q5: **PARTIAL**. A UI button can call the existing DIM-to-project service after a route is added, but raw image-to-DIM cannot be called because no production analyzer exists. Q6: generator/library plus CLI/test evidence, not a server API. Q7: add one bounded multipart/JSON import route/service that validates the document/JSON, invokes an analyzer provider, validates DIM, calls `createImportedProject`, and returns immutable context/preview data; do not expose filesystem paths or cleanup methods.

## I. JSON Analyzer

Q9: **NEW**. The Semantic Model validator validates an already flattened dataset; it does not traverse arbitrary JSON, infer paths/types/nullability, or retain parent/depth/array item paths.

Minimum node model:

```json
{
  "path": "$.items[].qty",
  "type": "number",
  "value": 3,
  "parent": "$.items[]",
  "isArray": false,
  "arrayItemPath": "$.items[]",
  "depth": 3,
  "nullable": false,
  "sampleValue": 3
}
```

Add deterministic rules for heterogeneous arrays, empty arrays, null-only fields, invalid/non-object roots, depth/node limits, unsafe keys, stable ordering, and scalar formatting. Derive a one-row scalar parameter map and at most one tabular array dataset for the POC.

## J. Binding Target Resolver

The current resolver is identity-oriented, not semantic. `static-table-model-service` supplies table/cell/row/column IDs and geometry but omits decoded text and binding data. `target-resolver` explicitly rejects label-only object resolution. DIM metadata maps DIM element IDs to Source IDs, but does not encode label/value relationships.

| Capability | Grade | Evidence |
|---|---|---|
| Label text identification | LIMITED | Source inspection can decode a selected object; no all-object semantic index |
| Label ↔ value area | UNSUPPORTED | No relation/role in DIM or source model |
| Table header text | LIMITED | UBJF contains it; static logical model does not expose it |
| Table value cell | LIMITED | row/column/cell identities exist; header/detail role does not |
| Row identity | SUPPORTED | logical row key and source cell list |
| Column identity | SUPPORTED | logical column key and source cell list |
| Source cell ID | SUPPORTED | `sourceCellId`/raw `IMPCL####` |
| Band identity | LIMITED | supported for legacy dynamic runtime IDs; Imported static uses FreeForm |
| dataType | LIMITED | exists in UBJF but not returned by static target model |
| Existing binding | LIMITED | readable from UBJF; not indexed/resolved |
| Static field candidate | UNSUPPORTED | no rule/model |
| Repeating field candidate | UNSUPPORTED | no header/detail inference or band conversion mapping |

The new resolver should produce immutable target descriptors containing Source ID/path, page, object/table/cell identity, decoded label, role, geometry, existing binding and allowed binding kinds. Matcher results should reference these IDs, never Viewer render indexes alone.

## K. Scalar Auto Binding

Q12: **YES**, as the first implementation slice, after the P0 persistence/materializer contract is added. Imported labels have stable Source IDs and can be rewritten without rebuilding UView5.

Q13: smallest safe route:

1. Analyze JSON and resolve scalar targets.
2. Store reviewed mappings separately from source patches.
3. Materialize a candidate from Imported Base in one pass: add parameters and write `dataType="3"`, empty `dataSet/column/systemFunction`, encoded `text="{param:key}"`; inject actual parameter values through the established UView5 request contract.
4. Reparse and validate every binding, then open the unchanged UView5 URL and exercise server PDF.

If runtime parameter injection proves unreliable, use one embedded single-row dataset and the existing dataset writer. That fallback has more source machinery but an already tested renderer contract. Do not fake binding by replacing labels with literal JSON values; that would not prove reusable binding.

## L. Dynamic Array Binding

Q14: reusable pieces are `createImportedDataset`, dataset compression, `writeDatasetBinding`, Band/table prototype cloning concepts, `readForm/writeForm`, stable ID contexts, and the proven one-source-row DataBand runtime rule. `dynamic-project-service.assemble` itself is only a reference implementation because it assumes exactly 6 columns, 7 bands, 8 tables, one group, fixed IDs/positions, fixed page size, and a fixed ground-truth UBJF.

Q15: **YES, it currently conflicts** with the canonical editor/candidate architecture. Static import has a FreeForm static UBTable; conversion changes dataset/root, inserts Bands, reparents/rebuilds a table, and changes context from `STATIC_SINGLE`. Existing FormContext rejects dynamic names, the static model requires exactly one UBTable, and mixed serializers cannot combine this structure with Source Patches.

Q16: **PARTIAL**. “Static scalar fields + one repeating array” is a realistic two-milestone POC, not a safe single first slice. Finish scalar A1 first. A2 should support one flat homogeneous array, one header row, one DataBand source row, no group/aggregate/multi-page authoring, and a fresh canonical candidate generated from the base plus reviewed binding plan.

## M. Direct Edit Integration

| Function | Grade | Notes |
|---|---|---|
| select | REUSE | same-origin Fabric inspector; bridge facade recommended |
| updateText/font/alignment | REUSE | validated Source Patch + History + candidate |
| move object | MODIFY | render-only today; not Source/PDF materialized |
| resize object | REUSE | validated width/height Source Patch for supported objects |
| resize/reorder/hide column | REUSE | static logical table operations |
| resize/hide/collapse row | REUSE | static logical table operations |
| move/resize table | MODIFY | registry marks Viewer-only; candidate/PDF unsupported |
| hide/collapse table | REUSE | Source/PDF-supported operation subset |
| binding edit | NEW | operation/store/writer/validation absent |
| Dynamic target edit | NEW | Band-aware context/model absent |
| undo/redo/reload | REUSE for existing state, MODIFY for bindings | history captures current three stores only |

Q17: **PARTIAL**. The right panel can call `/api/operations/execute` immediately for registered operations. Binding and dynamic edits require new registered operations and stores. Q18: **YES** for the intended responsibility split; it is already the current shape. Keep drag/direct controls in the Viewer and precise values/binding in the parent.

## N. History / Undo / Redo

Q19: **PARTIAL**. `history-service.transact` is generic, but `capture/restore` hard-code three state collections. Add `bindingMappings` to the snapshot and a Binding operation descriptor/label; then reviewed binding changes can share the timeline atomically.

Q20: **YES**. Imported project creation should remain outside the editable history and establish the immutable BASE. The first transaction snapshots empty Binding/Source/Render/Structure stores. Candidate generation replays the current cursor state from BASE. Record import provenance in metadata rather than as an undoable event.

## O. Candidate / Save / Reload

Q21: **YES**. The exact mixed canonical serializer limitation remains in `src/server/index.js`, and its E2E evidence expects the block.

Q22: **NO**, not currently. Source Patch and static Structure each serialize alone; render moves/table move/width are Viewer-only; bindings have no serializer; Dynamic candidates are unsupported.

Q23: **P0** for the requested scalar Binding + Direct Edit + Save/Reload slice. It is not a blocker for read-only Viewer preview, but the stated vertical slice requires persisted combined state.

Q24: create one canonical candidate service with an explicit deterministic order and a single working copy: Base clone → binding/root/dataset changes → structural operations → source-property patches → reparse/signature/diff/binding validation → atomic publish. Render-only operations must either remain explicitly non-persistent or gain a proven Source adapter. Candidate records should store the exact state revision/history cursor and binding plan hash.

## P. PDF

Q25: **YES** for a materialized Dynamic UBJF with embedded rows; MVP 3.1 evidence rendered 25 rows and produced a non-empty server PDF. Runtime-only, unsaved JSON preview is not enough: the PDF service must receive parameters/data or use embedded candidate data.

Q26: **YES** for separately generated static imported and Dynamic MVP 3.1 projects. Existing evidence covers both. It does **not** cover a combined bound+edited candidate, dynamic candidate editing, or multi-page output.

## Q. Recommended Architecture

```text
/ai-builder (new parent route)
  Import Screen -> POST /api/ai-builder/import
  Workspace
    left: existing same-origin UView5 iframe through /mysuit proxy
    right: Binding Review | Direct Edit
             |
             +-> Viewer Bridge facade
             +-> validated operation API
             +-> binding-plan API/store

Server
  document analyzer provider -> DIM validator -> existing static project service
  JSON analyzer -> schema model
  target resolver -> target descriptors
  matcher -> reviewed binding plan
  canonical candidate materializer
       Base + Binding + Structure + Source Patch -> one UBJF candidate
  existing UView5 -> Viewer / server PDF
```

| Area/module | Classification | Reason |
|---|---|---|
| `services/form-patch-service.js` codec | REUSE | proven parse/write/reparse primitives |
| UView5 core/export/PDF | DO NOT TOUCH | established runtime and output path |
| `viewer-inspector.js` + facade | MODIFY | retain implementation, formalize narrow bridge/multipage-ready identity |
| DIM validator | REUSE | strict v1.2 text/table contract |
| static generators/style/ID | REUSE | proven imported object creation |
| `import-project-service.js` | MODIFY | safe naming/context and API orchestration hooks |
| runtime image analyzer | NEW | current path is frozen evidence only |
| Dynamic validator/generator | MODIFY | remove fixed 6/7/8/group/ground-truth assumptions |
| Dataset generator | REUSE | compressed embedded rows proven |
| Binding writer | MODIFY | add parameter/clear/validate and generic target support |
| JSON analyzer | NEW | no arbitrary JSON traversal exists |
| Binding target resolver | NEW | current resolver is operational identity only |
| Binding matcher | NEW | no match/store contract exists |
| Binding plan store/routes | NEW | required for review/history/reload |
| Direct Edit operation stack | REUSE | use existing validated operation API |
| History | MODIFY | add binding state; retain transaction mechanism |
| Candidate serializer | MODIFY | unify source/structure/binding materialization |
| `static-table-model-service.js` | MODIFY | expose decoded text, role, current binding metadata |
| Dynamic editor/context | NEW | current FormContext deliberately rejects it |

Recommended matcher record, stored outside UBJF until confirmed:

```json
{
  "bindingId": "bind_...",
  "targetId": "IMPCL0002",
  "targetLabel": "성명",
  "targetType": "SCALAR",
  "jsonPath": "$.applicantName",
  "confidence": 0.98,
  "method": "ALIAS",
  "status": "AUTO",
  "targetRevision": "sha256:..."
}
```

Allowed statuses: `AUTO`, `CONFIRMED`, `NEEDS_REVIEW`, `UNBOUND`, `REJECTED`. Only `CONFIRMED` and policy-approved high-confidence `AUTO` entries may materialize. Preserve rejected/unbound entries for review history. Never put confidence/matcher metadata into UView5 objects.

## R. Recommended First Vertical Slice

**A1 Scalar slice**: use one existing checked-in Imported Image project/fixture (no upload analyzer claim), accept one JSON object with 3–5 scalars, analyze paths, resolve manually seeded label/value targets, deterministic match, review/confirm, materialize real bindings and values, render in unchanged UView5, make one supported text/style edit, create a combined candidate, reload in a fresh context, produce server PDF, and verify original hashes.

Exclude array, grouping, aggregate, multi-page, new document formats, LLM, AI Chat/New, and Viewer-core changes.

Only after A1 passes, implement **A2 Array slice**: one flat homogeneous `items[]`, one detected/confirmed table, one DataBand source row, no group/footer aggregation, runtime row count equals array length, combined candidate/reload/PDF.

## S. Recommended Implementation Order

0. Freeze audit contracts and integrity hashes.
1. Build the canonical combined candidate materializer and contract tests (first code task).
2. Add Binding Plan schema/store/history snapshot integration.
3. Add JSON Schema Analyzer.
4. Extend target discovery and implement deterministic scalar matcher.
5. Add parameter writer and prove UView5 scalar value injection; retain one-row dataset fallback.
6. Add the AI Builder route/shell and documented Viewer Bridge facade.
7. Add Import/JSON API and Import Screen, initially using existing fixture/analyzer-provider input.
8. Add Binding Review panel and operation dispatch from the Direct Edit tab.
9. Complete A1 candidate/reload/PDF/integrity regression.
10. Generalize Dynamic context/generator for one flat array.
11. Complete A2 and multi-page/runtime identity follow-up.
12. Add document-format analyzers and AI features only after deterministic flows are stable.

## T. Regression Strategy

Unit tests: JSON traversal/type/null/array rules; normalization/exact/alias/token matcher; binding-plan state transitions; parameter/dataset binding writers; canonical operation ordering, conflict detection, reparse and original-hash preservation.

Integration tests: JSON → plan store/history; confirmed plan → UBJF; combined Binding+Source+Structure → one candidate; candidate → reload; parameter/dataset runtime values; imported and dynamic server PDF.

E2E A1: existing Imported fixture → JSON → review → Viewer value → one supported edit → Save → fresh reload → PDF. E2E A2: one array → one DataBand source row → N runtime rows → Save/reload/PDF.

Mandatory existing regression groups: PRE-AI baseline, operation/capability validation, Direct UX, History branch/identity/rebuild/transaction, Candidate isolation, Import MVP 1.0/1.1/1.2, Import MVP 2.0/2.1/2.2 evidence contracts, Dynamic MVP 3.1 unit/runtime, and static/dynamic PDF. Run state-mutating E2E only in disposable projects/drafts with before/after hashes and pre-existing candidate directory inventory.

Success grades:

- **A1**: scalar import/JSON analysis/review, real binding, unchanged Viewer, supported Direct Edit, combined Save/Reload/PDF, integrity and regressions all pass.
- **B1**: scalar render works but candidate/reload or combined edit is missing.
- **C1**: matcher/review exists but values are literal substitutions or Viewer-only.
- **D1**: no end-to-end scalar binding.
- **A2**: one array, one source detail row, exact N runtime rows, combined Save/Reload/PDF and integrity pass.
- **B2/C2/D2** follow the same degradation: runtime only; source generation only; no repeat binding.

Overall product A requires A1 + A2. The first POC can be accepted independently as A1.

## U. Files Reviewed

Primary implementation:

- `src/client/index.html`, `app.js`, `viewer-inspector.js`, `direct-editor.js`, `history-controller.js`, `session-controller.js`, and the logical/direct manipulation controllers.
- `src/server/index.js`, `config.js`, route modules, `operation-registry.js`, `validated-operation-service.js`, `target-resolver.js`, `form-context-service.js`, `static-table-model-service.js`, `history-service.js`, `changeset-service.js`, `candidate-service.js`, static structure adapters, and `form-patch-service.js`.
- All files under `src/server/import/` and `src/server/dynamic/`.
- `scripts/build-import-*`, `generate-import-*`, `generate-dynamic-mvp31-project.js`, and runtime/evidence scripts.
- Unit/E2E tests for import, dynamic, editor, history, candidate, operation/capability, structure, and PDF paths.
- `docs/65`, `67`, `68`–`85`, PRE-AI architecture/capability/safety documents, frozen DIM and Semantic Model fixtures.
- UView5 `index.jsp`, `ubform.common.js`, and export-related sources as needed to confirm toolbar/navigation/zoom/export/PDF ownership.
- Read-only parse of `test-input/edu_01.ubjf` to verify parameter source syntax.

No test command, server start, generator, cleanup, formatter, or package installation was run.

## V. Generated Audit Documents

- `docs/86-ai-builder-implementation-readiness-audit.md`
- `docs/87-ai-builder-architecture-proposal.md`
- `docs/88-ai-builder-mvp-scope.md`
- `mysuit-mvp-work/logs/ai-builder-readiness-audit.json`

## Q1–Q26 Summary

| Question | Answer | Core evidence |
|---|---|---|
| Q1 | Existing `mvp3-app`, new `/ai-builder` route/shell | It already owns iframe, proxy, stores, operations and right panel |
| Q2 | YES | Same-origin iframe already embeds UView5 without core changes |
| Q3 | PARTIAL | Supported IDs map; semantic/global/dynamic selection is incomplete |
| Q4 | PARTIAL | Existing operations share stores/history; Binding/Dynamic do not |
| Q5 | PARTIAL | DIM → Static UBJF callable; raw image analyzer/API absent |
| Q6 | CLI/library/test fixture | No import/dynamic route in `server/index.js` |
| Q7 | Add bounded orchestration route/service | Reuse validator/project service; add analyzer/upload boundary |
| Q8 | PARTIAL | dataset/system writers reusable; parameter/generic targets absent |
| Q9 | NEW | Semantic validator is not arbitrary JSON analysis |
| Q10 | Mixed SUPPORTED/LIMITED/UNSUPPORTED | See resolver matrix in J |
| Q11 | Separate versioned Binding Plan Store | Avoid UBJF pollution; key by stable Source target and base hash |
| Q12 | YES | Stable imported IDs + reusable codec/runtime, after P0 persistence |
| Q13 | Parameter writer/injection, one-row dataset fallback | Actual `dataType=3` source exists; dataset path already tested |
| Q14 | PARTIAL reuse | Dataset/writer/codec/one-row rule reusable; assembler is fixed |
| Q15 | YES, conflict today | Dynamic context rejected; mixed canonical serializer absent |
| Q16 | PARTIAL | Realistic as A1 then A2, not one initial slice |
| Q17 | PARTIAL | Registered operations reusable; Binding/Dynamic are new |
| Q18 | YES | Current iframe + parent editor already follows the split |
| Q19 | PARTIAL | Generic transaction; capture/restore lacks binding state |
| Q20 | YES | Existing history already stores baseState on first mutation |
| Q21 | YES | Explicit runtime guard and E2E expectation remain |
| Q22 | NO | No combined Source+Binding+Structure serializer |
| Q23 | P0 | Required Save/Reload depends on it |
| Q24 | One ordered canonical materializer | Clone once, apply all state, reparse/validate, atomically publish |
| Q25 | YES | Dynamic MVP 3.1 embedded data Viewer/PDF evidence passes |
| Q26 | YES, separately | Static Import and Dynamic PDF tested; combined candidate untested |

## Final Four Answers

### FINAL Q1

**PARTIAL** — `문서 + JSON → Binding된 MySuit 서식` is realistic. The renderer, static generator, Dataset writer and PDF path are proven; JSON analysis, semantic target resolution, scalar writer/persistence and combined candidate serialization are missing.

### FINAL Q2

**YES** — use the already proven same-origin UView5 iframe on the left and a parent Right Panel. Limit Viewer changes to a narrow bridge facade and keep UView5 core untouched.

### FINAL Q3

```text
Import: PARTIAL
DIM: REUSE
Static Generator: REUSE
Dynamic Generator: PARTIAL
Binding Writer: PARTIAL
Viewer: REUSE
Direct Edit: REUSE
History: PARTIAL
Candidate: PARTIAL
PDF: REUSE
```

`Import` is PARTIAL only because image-to-DIM and UI API are not productized; DIM-to-project is reusable. `Candidate` is PARTIAL because isolated source or structure candidates work, but combined and Dynamic candidates do not.

### FINAL Q4

**첫 번째 구현 작업:** Source Patch + Structure Operation + 새 Binding Plan을 Imported Base에서 하나의 Candidate UBJF로 순서 있게 materialize하고 reparse/diff 검증하는 **canonical combined candidate materializer의 계약과 테스트를 구현한다**.

This must precede shell polish: otherwise the UI can demonstrate binding but cannot satisfy the required Save → Reload → PDF lifecycle safely.
