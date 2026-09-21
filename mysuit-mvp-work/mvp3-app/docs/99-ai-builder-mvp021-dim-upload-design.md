# AI Builder MVP 0.2.1 — DIM Upload Design

## Pipeline

The Import entry keeps DIM under a collapsed advanced option. Client validation gives immediate JSON/schema feedback through a server validation endpoint; the endpoint and generation service both reuse `src/server/import/dim-validator.js`. Generation has four explicit phases: input acquisition, DIM acquisition, DIM validation, and existing static project generation.

DIM acquisition is fail-closed: uploaded DIM, then the SHA-256 exact-matched `my-report.png` Frozen DIM, otherwise `DIM_REQUIRED`. An uploaded DIM always wins. There is no runtime analyzer and no arbitrary Frozen DIM fallback.

## Supported combinations

- Image + DIM + JSON: supported; uploaded DIM and auto binding.
- Image + DIM: supported; no binding proposal.
- DIM + JSON: supported; generator is image-independent.
- DIM only: supported; generator is image-independent.
- Image + JSON: supported only for the known image SHA-256; unknown images require DIM.

The static generator consumes validated DIM plus the existing FreeForm/Table prototypes; it never consumes source-image bytes. `document` and `json` are therefore nullable without changing old Context reads.

## Persistence and safety

Context schema 3 adds `jsonPayload`, `dimPayload`, `dimSource`, `dimFileName`, `dimSchemaVersion`, and `dimSha256`. Public Context omits raw DIM/JSON payloads. Uploaded DIM uses a random staging filename, sanitized display filename, 5 MB limit, atomic staging publication, and complete cleanup on failure. PNG/JPEG dimensions are compared with the fixed DIM page coordinate contract; mismatch fails as `DIM_IMAGE_MISMATCH`.

Errors are `DIM_REQUIRED`, `DIM_JSON_INVALID`, `DIM_SCHEMA_INVALID`, `DIM_FILE_TOO_LARGE`, `DIM_IMAGE_MISMATCH`, and `DIM_IMPORT_FAILED`. Invalid DIM is rejected before any Project/Draft/Candidate is created.

## Legacy fixture decision

The MVP 0.1 browser assertion requiring a Dataset option on a static imported form with zero datasets was TEST_DEBT. The test now preserves its binding-panel intent by asserting the truthful `데이터 연결 없음` state; product code was not distorted.
