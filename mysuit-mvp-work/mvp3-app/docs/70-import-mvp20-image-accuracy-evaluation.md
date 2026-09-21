# Import MVP 2.0 Image Accuracy Evaluation

| Metric | Result |
|---|---:|
| Text detection | 100% (3/3) |
| Text content | 100% (3/3) |
| Table detection | 100% (1/1) |
| Column count | Exact (3) |
| Row count | Exact (4) |
| Cell count | Exact (12) |
| Cell text | 100% (12/12) |
| Avg X error | 55.75 units (7.0214%) |
| Max X error | 97 units (12.2166%) |
| Avg Y error | 0.75 units (0.0668%) |
| Max Y error | 3 units (0.2671%) |
| Avg Width error | 88 units (11.0831%) |
| Max Width error | 126 units (15.8690%) |
| Avg Height error | 5.5 units (0.4898%) |
| Max Height error | 10 units (0.8905%) |
| Font size error | avg 0.3333, max 1 |
| Bold accuracy | 100% |
| Alignment accuracy | 100% |
| DIM validation | PASS, first attempt |
| Viewer generation | PASS, HTTP 200, fatal 0 |
| PDF generation | PASS, 29,270 bytes, 1 page |

Geometry averages include the three matched TEXT elements and the TABLE. TABLE x/y/width/height, column widths, and row heights were exact. All meaningful geometry error came from estimating visible glyph bounds as TEXT boxes rather than recovering the wider invisible source label containers. Freeze DIM to Viewer geometry error was zero.
