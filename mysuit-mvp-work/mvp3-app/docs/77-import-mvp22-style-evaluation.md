# Import MVP 2.2 Style Evaluation

The controlled 3×3 fixture verified dark header/white text, white body/dark text, independent horizontal alignment, top/middle/bottom vertical alignment, hidden sides, and a visible `#DDDDDD` width-1 shared border. Server PDF succeeded.

For the external invoice, representative source pixels were measured as header `#3A3A3A`, body `#FFFFFF`, and balance banner `#F5F5F5`. Freeze DIM and Viewer matched header/body colors with zero channel delta. All 12 table cells matched the annotated border visibility, and all 12 vertical alignments matched.

| Area | MVP 2.1 | MVP 2.2 |
|---|---|---|
| Header | Red / white | `#3A3A3A` / white |
| Body | Red / white grid | White / dark / borderless |
| Prototype leakage | Present | Removed |
| Geometry corrections | 3 | 3 |
| Style corrections | Unsupported | 0 |

The largest remaining differences are geometry/container estimation, the missing rounded Balance Due rectangle, exact font family, and mixed rich text inside the first column. The style improvement is clear, but full border semantics still inherit MySuit shared-edge behavior.
