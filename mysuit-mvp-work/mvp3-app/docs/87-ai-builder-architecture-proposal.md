# AI Builder Architecture Proposal

Status: proposed from read-only audit; no implementation exists yet.

## Decision

Build AI Builder as a new route inside `mvp3-app`, not a separate deployment and not a UView5 fork. Keep UView5 in a same-origin iframe through the existing proxy. The parent owns upload/import orchestration, Binding Review, Direct Edit properties, history, and candidate lifecycle.

```text
AI Builder route
├── Import Screen
│   ├── document input -> analyzer provider -> DIM
│   └── JSON input -> JSON Schema Model
└── Workspace
    ├── existing UView5 iframe
    └── Right Panel
        ├── Binding Review
        └── Direct Edit
```

## Module Plan

| Proposed module | Action | Responsibility |
|---|---|---|
| `src/client/ai-builder/ai-builder-shell.js` | NEW | route/screen/workspace lifecycle |
| `src/client/ai-builder/import-screen.js` | NEW | bounded document and JSON inputs |
| `src/client/ai-builder/binding-panel.js` | NEW | match review and state transitions |
| `src/client/ai-builder/direct-edit-panel.js` | NEW | reuse validated operations |
| `src/client/ai-builder/workspace-controller.js` | NEW | context, refresh, candidate lifecycle |
| `src/client/viewer-inspector.js` + `viewer-bridge.js` | MODIFY/NEW | narrow ready/selection/viewport/preview facade |
| `src/server/routes/ai-builder-routes.js` | NEW | import, JSON analysis, plan, materialize endpoints |
| `src/server/ai-builder/json-schema-analyzer.js` | NEW | arbitrary JSON path/type model |
| `src/server/ai-builder/binding-target-resolver.js` | NEW | Source target descriptors and roles |
| `src/server/ai-builder/binding-matcher.js` | NEW | deterministic exact/normalized/alias/token matching |
| `src/server/ai-builder/binding-plan-service.js` | NEW | isolated, versioned reviewed plan store |
| `src/server/ai-builder/canonical-materializer.js` | NEW | Base + Binding + Structure + Source Patch |
| `src/server/dynamic/binding-writer.js` | MODIFY | parameter writer and generic validation |
| `src/server/services/history-service.js` | MODIFY | capture/restore binding plan state |
| `src/server/services/form-context-service.js` | MODIFY | metadata-safe Builder/static/dynamic contexts |

## Contracts

Viewer Bridge identity must contain page/canvas, Source ID, effective band, runtime row, render index/fingerprint, class, and readable properties. Persistent changes key on Source identity or logical table identity; render index is never the sole persistent key.

Binding Plan is external editor state. It records base form hash, target revision, target type, JSON path, confidence/method, review status, and desired MySuit binding. It enters UBJF only during canonical materialization.

Canonical materialization order:

1. Clone immutable Base into a temporary candidate.
2. Apply root Dataset/parameter and object binding mutations.
3. Apply structural operations.
4. Apply source-property patches against the resulting identity map.
5. Reparse; validate expected paths, IDs, bindings, dataset rows and operation signatures.
6. Verify Base/form/info hashes and atomically publish candidate.

Conflicts fail closed with a machine-readable code; they are never silently reordered or dropped.

## Runtime Choice

For scalar A1, prefer MySuit parameter binding because a real `dataType="3"` / `{param:name}` source is present. First prove writer plus runtime injection in an isolated fixture. If injection is not reliable through the current Viewer/PDF request, use one embedded single-row Dataset through the already tested dataset writer.

For array A2, normalize one flat homogeneous array into one embedded Dataset and generate one DataBand source row. Reuse Dataset encoding and binding writers, but do not reuse the fixed six-column/seven-band assembler unchanged.

## Non-goals

No UView5 rewrite, cross-origin bridge, runtime LLM, AI Chat/New, group/aggregate authoring, multiple/nested arrays, multi-page authoring, or Office/HWP parsing in A1/A2.
