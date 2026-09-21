# AI Builder MVP 0.4 Result

## Verdict

**B** — the deterministic analyzer, resolver, review, dataset, and non-flattening dynamic source conversion are implemented and pass unit/integration checks. Browser Viewer/PDF evidence and structural candidate undo/redo were not completed because local Tomcat did not become reachable on port 9990.

## Verified

- Object array extraction, null values, unsupported primitive/nested arrays, empty arrays, and deterministic output
- Stable static table/header resolution
- Exact and bilingual alias column matching with low-confidence fail-closed behavior
- 3/3 correct AUTO column matches in the integration fixture; wrong AUTO count 0
- deterministic `ai_items` dataset with three rows
- one source detail row and three decoded dataset rows
- `UBDataHeaderBand` and `UBDataBand` generation using Dynamic MVP 3.1 prototypes
- no static flattening
- parse-back source validation
- forced generation failure left zero candidate projects
- Foundation 0.1/0.2, MVP 0.2 import units, MVP 0.3, Import 1.1/1.2, and Dynamic 3.1 unit regression suites
- test-started Node and Tomcat processes are stopped

## Not verified

- Actual Viewer runtime row instances, reload/new-context, PDF content, and requested screenshots
- Full structural undo from the published dynamic candidate back to the static source. An `ARRAY_BINDING_APPLY` history marker is recorded, but the candidate project switch is not represented in the existing operation-state snapshot.
- Browser-driven manual correction (the API and UI controls are implemented)
- Empty-array runtime rendering

## PRE-AI baseline

`NOT_RUN`: `run-pre-ai-baseline.sh` attempted to start Tomcat, but `127.0.0.1:9990` remained unreachable. Cleanup ran and no unintended server remains.

