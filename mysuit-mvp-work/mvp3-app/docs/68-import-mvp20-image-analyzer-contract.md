# Import MVP 2.0 Image Analyzer Contract

The provider-independent contract is `analyzeDocumentImage(image) -> DIM v1.1`. The analyzer emits only static `text` and `table` elements. It does not write UBJF, infer datasets, or call external OCR/Vision APIs. The existing validator must pass before a byte-identical Freeze DIM is handed to the Import Generator.

Before analysis, the source gate records dimensions, thresholded non-white pixels, toolbar-excluded content bounds, and coverage. Ground Truth remains inaccessible until validation and Freeze SHA-256 recording are complete. Unsupported appearance is reported separately and never added as an unknown DIM field.
