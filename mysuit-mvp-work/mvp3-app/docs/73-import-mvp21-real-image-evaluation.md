# Import MVP 2.1 Real Image Evaluation

| Metric | Result |
|---|---:|
| Source sanity | PASS |
| DIM validation | PASS, first attempt |
| Logical TEXT regions | 26/26 |
| Text content | 26/26 |
| TABLE | 1/1 |
| Columns | 4/4 |
| Rows | 3/3 |
| Cells | 12/12 |
| Cell text | 12/12 |
| Normalized table geometry | exact to manual pixel annotation |
| TEXT geometry | NOT_MEASURED |
| Viewer | HTTP 200, fatal 0 |
| Editor corrections | 3 |
| PDF | HTTP 200, 29,572 bytes, 1 page |

Fidelity ratings are STRUCTURE `EXCELLENT`, POSITION `GOOD`, SIZE `GOOD`, STYLE `POOR`, and UNSUPPORTED `ACCEPTABLE`. Three Editor operations made clipped content usable: Balance value width 55→70, Item column 339→320, and Amount column 81→100. Object and Structure corrections used separate drafts/candidates, each with successful Undo/Redo.

The dominant visual difference is not text/table recognition. DIM v1.1 cannot describe per-cell background/text color, vertical alignment, mixed cell styles, or border visibility, while the Generator clones one prototype style across the whole table.
