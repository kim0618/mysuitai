# AI Builder MVP 0.2 — Import Entry Design

## Route and flow

`/ai-builder/import` is a separate, framework-free entry page. It accepts one PNG/JPG image plus either a JSON file or direct JSON text. Direct edits after a JSON file selection change the context source to `DIRECT`, so precedence is explicit.

The client validates extension, empty files, 10 MB document size, 1 MB JSON size, and JSON syntax. The server independently validates image signatures, sizes, safe base names, and JSON syntax before writing anything.

## Existing pipeline integration

`ai-builder/import-service.js` stages the source and JSON under `mysuit-mvp-work/uploads/ai-builder/<draft>.creating`, loads the existing verified external-image DIM, and calls the existing `import-project-service.createImportedProject`. That service continues to own DIM validation, UBLabel/UBTable generation, parse-back validation, template integrity, and atomic project publication.

The current repository has no runtime OCR/analyzer provider. Therefore MVP 0.2 deliberately supports the verified `my-report.png` image contract through its frozen DIM; it does not claim arbitrary-image analysis. General analysis remains out of scope.

## Persistence and safety

After successful project generation, a versioned `ai-builder-import-context.json` is written inside the imported project and a matching upload context is published atomically. It records draft, project/form, sanitized document metadata, JSON source/file metadata, and raw JSON. The public context endpoint omits raw JSON while preserving registration metadata for the Workspace.

Any analyzer, generator, context, or publish failure removes the staged upload and generated project. Import itself creates no History event; the generated form becomes the History base.

## Workspace reuse

The API returns `/ai-builder?projectName=...&layoutDraftId=...`. The existing MVP 0.1 shell, Viewer iframe, Direct Edit, History, unified save, and PDF paths are reused without a second workspace implementation. The Data Binding panel shows `JSON 등록됨`, its file/direct source name, and `아직 자동 연결되지 않음`.
