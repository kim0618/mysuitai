# HWPX Import MVP 0.1 — DIM 1.3 Mapping

The semantic model contains `page`, `paragraphs`, `tables`, `images`, `styles.fidelity`, and `assets`. Binary buffers exist only in memory until atomic staging; JSON serialization excludes them.

| HWPX semantic value | DIM 1.3 value |
| --- | --- |
| page width/height | normalized `page.width/page.height` |
| paragraph | `text` element |
| logical `tc` master | table cell with `row`, `col`, `rowSpan`, `colSpan` |
| binary item | asset manifest entry with SHA-256 and size |
| picture anchor | `image` with `source.kind=asset` |
| char/para/borderFill | supported DIM style subset |

Column and row sizes are inferred from cell geometry, normalized to the table box, and the final column/row absorbs rounding error. Geometry is clipped to the DIM page so validation is deterministic. IDs are derived from source order, never timestamps or random values. Semantic, DIM, and asset signatures are SHA-256 values.

Use:

```bash
npm run import:hwpx -- /path/to/input.hwpx output/hwpx-personnel-record
npm run import:hwpx -- /path/to/input.hwpx output/hwpx-personnel-record --project
```

The second command publishes through the existing Import Core. The first is read-only except for evidence output.
