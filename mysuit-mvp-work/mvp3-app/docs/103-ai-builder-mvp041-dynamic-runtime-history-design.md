# AI Builder MVP 0.4.1 Dynamic Runtime / Structural History Design

## Runtime contract

The source contains one `UBDataBand` detail template. Its embedded `ai_<array>` dataset owns N rows; UView5 expands one source cell to identities shaped as `<cell>_<band>_ROW<n>`. The transformer normalizes a sliced source row to `rowIndex=0`, `y=0`, preserves the table's absolute band position, and wraps retained static objects in page header/footer bands so scalar bindings remain visible in a band report.

## Structural transaction

`ARRAY_BINDING_APPLY` is one history event. Its before/after editor states contain a canonical structural reference:

- kind and project/form reference
- exact form SHA-256
- canonical semantic signature

The dynamic candidate remains immutable and is referenced rather than embedding raw UBJF in every event. Restore validates path, existence, hash, and semantic signature before changing stores. Old history without this field resolves to the static source for backward compatibility.

Undo/redo restores the structural reference together with source, render, structure, and binding stores. A failed validation or forced rebuild leaves cursor and current structural state unchanged. Cursor materialization uses the referenced static/dynamic base and then applies later operations through the unified materializer.

## Error contract

The catalog includes `DYNAMIC_RUNTIME_ROW_MISMATCH`, `STATIC_FLATTENING_DETECTED`, `STRUCTURAL_HISTORY_SNAPSHOT_FAILED`, `STRUCTURAL_HISTORY_RESTORE_FAILED`, `STRUCTURAL_HISTORY_SIGNATURE_MISMATCH`, `DYNAMIC_VIEWER_VALIDATION_FAILED`, and `DYNAMIC_PDF_VALIDATION_FAILED`.

## Storage

Snapshots are references plus two signatures, not UBJF binaries. The measured stores after three two-event fixture histories were 156,652 bytes for history and 1,822 bytes for active structural references. The 200-event history limit remains unchanged.
