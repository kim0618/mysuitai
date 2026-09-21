# AI Builder MVP 0.1 — Shell Design

## Decision

AI Builder is a new `/ai-builder` route in the existing local application. It preserves UView5 as the same-origin iframe and preserves the current editor controllers, operation registry, History service, and unified cursor materializer. No Viewer toolbar, renderer, export dialog, page navigation, or runtime source was forked.

The route adds a desktop workspace shell: the existing Viewer occupies the flexible left column and a 360–400 px panel occupies the right column. Switching Direct Edit, Data Binding, and AI Chat only changes panel visibility; it never changes the iframe URL.

## Bridge contract

The shell publishes `ai-builder:selection-changed` with `{ type, targetType, sourceId, runtimeId, page }`. Object identity comes from the existing inspector's parsed source identity. Static table selection comes from the existing logical table model. Runtime text and DOM inspection are not used to infer persistent identity.

Property writes continue through `mvpDirectBridge`, structure width writes through `__mvp12.save`, binding writes through `/api/binding-operations`, and undo/redo through the existing History controller. Unsupported property controls are omitted according to the source/capability state.

## Save contract

`POST /api/ai-builder/save` rebuilds the editor state at the current History cursor and invokes `materializeHistoryCursor`. The unified materializer applies Structure, Source, and Binding changes into a new isolated candidate, validates parse-back semantics, atomically publishes it, and verifies the base form/info hashes.

Temporary save represents the already persisted Draft/History state. Final save loads the unified candidate into the same Viewer iframe.

## Scope and limitations

This phase intentionally contains no upload, analyzer, matcher, dynamic table generation, or AI call. Manual binding is limited to datasets already present in the base form. Binding changes are reflected immediately in panel/history state; their rendered data value is guaranteed after unified save/reload, not through an unsaved synthetic Viewer dataset injection.
