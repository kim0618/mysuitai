# DIM 1.3 Merged Table / Image Contract

DIM `1.3` extends, but does not rewrite, the `1.0`–`1.2` paths. A table remains a physical grid defined by `columns` and `rows`. Its `cells` are logical master cells. Each v1.3 cell normalizes to `row`, `col`, `rowSpan`, and `colSpan`; covered coordinates are not separate semantic cells.

Validation rejects non-positive/non-integer spans, out-of-grid spans, duplicate masters, covered-coordinate masters, and overlapping ranges with stable `DIM_TABLE_*` codes. Merged geometry is the exact sum of participating column widths and row heights. The UBJF writer emits the existing MySuit `MS` master / `MC` continuation representation and stores span and merged geometry on both the master wrapper and Cell.

The root `assets` manifest contains `id`, `fileName`, `mimeType`, `sha256`, `size`, and safe `relativePath`. An image element references it through `source: { kind: "asset", ref: assetId }` and carries page geometry plus `fit: "contain"`. Supported MIME contracts are PNG, JPEG, and GIF. Paths must be basename-only, traversal is rejected, bytes must be non-empty and match manifest size, SHA-256, and file signature.

DIM never contains image Base64. Import copies the original asset to the generated form's `assets/` directory under a collision-resistant SHA-qualified name. Because the current MySuit `UBImage` renderer consumes URL-encoded Base64 in `data`, generation derives that renderer field from verified bytes. Failure before atomic rename removes the entire `.creating` project.

Structural editing of merged regions is deliberately unsupported in this phase. Rendering, selection, text/style carried by the master, save/reload, and PDF are preserved; split/merge/resize operations require a later editor capability.
