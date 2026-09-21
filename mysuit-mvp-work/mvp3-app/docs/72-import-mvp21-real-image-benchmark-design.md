# Import MVP 2.1 Real Image Benchmark Design

The benchmark uses the public synthetic `SammyMaystoneLinesTest.png` invoice from invoice2data. The document explicitly states that all names are fictitious. Its source SHA-256 is `a1096c69296113ecd3fd5b0ae53bb493b6baa32011843793eb7dfa3fb040f9f3`.

The 1700 × 2200 image passed the sanity gate. The entire image is the page boundary and was normalized to 794 × 1123 using independent x/y scales. Only TEXT and TABLE were emitted. Reference annotation was created after validation and Freeze. Unsupported shapes and styles were observed but never inserted as unknown DIM fields.

Evaluation uses observable logical text regions, table structure/content, normalized table geometry, Viewer fidelity, and Editor correction count. TEXT container geometry remains `NOT_MEASURED` because no independent source-object ground truth exists.
