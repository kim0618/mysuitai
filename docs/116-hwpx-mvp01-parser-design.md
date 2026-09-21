# HWPX Import MVP 0.1 — Parser Design

## Pipeline

`HWPX ZIP → namespace-independent XML tree → HWPX semantic model → DIM 1.3 mapper → existing DIM validator → existing import-project-service`

No HWPX-specific UBJF generator exists. `src/server/hwpx/hwpx-import-service.js` is the only orchestration boundary and calls the frozen `createImportedProject` API.

## Components

- `zip-package.js`: in-process ZIP central-directory reader; STORE and DEFLATE are supported. Unsafe and duplicate paths are rejected.
- `package-reader.js`: validates mimetype, version, header, content manifest, and one or more naturally ordered sections.
- `xml.js`: prefix-independent parsing through local names. Malformed XML fails with `HWPX_XML_PARSE_FAILED`.
- `style-resolver.js`: char/paragraph/borderFill references and a machine-readable fidelity list.
- `semantic-parser.js`: paragraphs, logical master cells, tables, images, and binary assets. Covered cells are not synthesized.
- `unit-converter.js`: the HWP unit constant is centralized (`7200/inch`). Output is normalized to the existing 794×1123 import template because the frozen generator currently requires that page.

Multiple text runs use the first non-empty run as the representative style and emit `PARTIAL`. Chart/OLE/video/audio objects emit `IGNORED_SAFE`. Missing referenced image bytes fail closed.

## Error contract

The implementation emits the requested stable errors where applicable: `HWPX_PACKAGE_INVALID`, `HWPX_REQUIRED_PART_MISSING`, `HWPX_XML_PARSE_FAILED`, `HWPX_TABLE_PARSE_FAILED`, `HWPX_CELL_GEOMETRY_INVALID`, `HWPX_ASSET_NOT_FOUND`, `HWPX_ASSET_INVALID`, and `HWPX_DIM_MAPPING_FAILED`. Missing style references are retained in the fidelity log as `PARTIAL`, allowing safe structural import.
