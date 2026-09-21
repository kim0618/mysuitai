# AI Builder MVP Scope

## A1 — Scalar Binding POC

Use one existing Imported image fixture/project and one JSON object with 3–5 scalar values. The POC must:

1. Analyze JSON into stable paths/types.
2. Produce target descriptors from imported Source objects.
3. Match using exact, normalized, alias, then token rules.
4. Allow confirm/reject/rebind review.
5. Materialize real MySuit bindings and runtime values, not literal substitution.
6. Render in unchanged UView5.
7. Apply one existing Source-supported Direct Edit.
8. Create one combined candidate; reload it in a new context.
9. Produce non-empty server PDF.
10. Preserve every original/fixture/candidate baseline hash and pass mandatory regressions.

Excluded: upload analyzer productization may be represented by the existing fixture provider; array, group, aggregate, multi-page, new document formats, LLM and AI UI are excluded.

### A1 Acceptance Grade

- A: all ten requirements pass.
- B: binding renders but combined Save/Reload or PDF is missing.
- C: review/matching exists but value display is literal or Viewer-only.
- D: no end-to-end bound render.

## A2 — One Repeating Array

Input has scalars plus one flat homogeneous array. One reviewed static table maps header columns to array item fields. Candidate source contains exactly one DataBand detail row; runtime row count equals input array length.

No grouping, aggregate, multiple/nested arrays or multi-page authoring. A requires combined Direct Edit, candidate, fresh reload, PDF, integrity, and regression success.

## P0 Exit Criteria

- Canonical combined materializer passes conflict/reparse/integrity tests.
- Binding Plan store participates in History undo/redo and reload.
- Scalar parameter or single-row Dataset runtime injection is proven in Viewer and server PDF.
- Builder project/form contexts are metadata-safe and store-isolated.

## Mandatory Tests

- Unit: JSON traversal, matching, state transitions, writers, canonical ordering/conflicts.
- Integration: JSON → plan → UBJF; combined state → candidate; candidate → fresh reload.
- E2E A1/A2: Viewer, Direct Edit, Save, Reload, PDF.
- Regression: PRE-AI, operation/capability, history, candidate isolation, Import 1.x/2.x, Dynamic 3.1 and PDF.
- Integrity: hashes of source `form.ubjf`, `info.xml`, frozen DIMs, ground truth, baseline and pre-existing candidates before/after.

## First Code Task

Implement the tested canonical combined candidate materializer contract for Source Patch + Structure Operation + Binding Plan. Do not begin with UI construction because UI success cannot meet the required persistence lifecycle until this P0 is closed.
