# DIM 1.3 Generator Extension Design

The implementation reuses the audited MySuit table representation rather than introducing a second merge engine. `logicalGrid()` expands DIM masters only in memory. `createImportedTable()` writes one physical wrapper per grid coordinate: a master owns the Cell and an `MS` status when merged; each covered wrapper owns no Cell and has `MC` status.

Parse-back validation distinguishes physical wrapper count from logical Cell count, checks unique Cell IDs, exact x/y offsets, summed merged width/height, continuation status, and overlap. Signatures list logical cells and covered count, making repeated generation comparable without depending on serialized compression.

Image publication occurs inside the same temporary project as form generation. Asset verification precedes publication; stored names combine asset ID, the first 12 SHA-256 characters, and the extension. The final directory is published by one rename only after UBJF serialization and parse-back object-count validation.

The manual HWPX-like fixture is `mysuit-mvp-work/mvp3-app/samples/import/manual-dim13-hwpx-like.dim.json`. It contains horizontal, vertical, and compound merges plus PNG and GIF images. It is intentionally not an HWPX parser output.
