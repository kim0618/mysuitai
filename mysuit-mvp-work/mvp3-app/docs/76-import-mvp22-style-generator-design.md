# Import MVP 2.2 Style Generator Design

`import-style-mapper.js` is the single mapping layer. Hex colors become the proven UBJF 24-bit integer `fontColor` and `backgroundColor`; `verticalAlign` maps directly. Border sides become the existing wrapper `borderString`, using `none` for hidden and the engine-compatible `SOLD` value for visible lines.

Prototype cloning remains responsible for valid MySuit structure and metadata. For DIM v1.2, the mapper overwrites every visual cell field and border string, eliminating red/white/grid leakage. v1.0/v1.1 retain the previous header/body defaults.

MySuit collapses adjacent cell borders as shared edges. A visible interior line is therefore represented consistently on both touching DIM sides; Viewer reports the resolved edge as `solid_share`. This is documented rather than hidden behind a MySuit-specific DIM field.
