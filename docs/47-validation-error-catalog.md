# Validation Error Catalog

| Code | 의미/조치 |
|---|---|
| `TABLE_WIDTH_OVERFLOW` | 페이지 출력 폭 초과. maximumWidth 이하로 줄인다. |
| `DATA_REPEAT_ROW` | 렌더된 반복 Detail Row 구조 편집 금지. |
| `ROWSPAN_DEPENDENCY` | 병합 Cell 의존 행 collapse/remove 금지. |
| `CROSS_BAND_REFLOW_UNVERIFIED` | 검증되지 않은 Band 간 공간 제거 금지. |
| `GROUP_BOUNDARY_MOVE_NOT_ALLOWED` | Column은 동일 group 안에서만 이동. |
| `FORMULA_DEPENDENCY` | Formula 의존 대상 변경 금지. |
| `SUMMARY_DEPENDENCY` | Summary/aggregate 의미를 깨는 변경 금지. |
| `BINDING_DEPENDENCY` | 검증되지 않은 Dataset field/binding 금지. |
| `LAST_COLUMN_REMOVE_NOT_ALLOWED` | 마지막 Column 제거 금지. |
| `HIDDEN_COLUMN_OPERATION_NOT_ALLOWED` | 숨긴 Column resize/move 금지. |
| `UNSUPPORTED_TARGET_TYPE` | 등록되지 않은 Target Type. |
| `UNSUPPORTED_OPERATION` | Registry 밖 Operation. |
| `TARGET_NOT_FOUND` | 정확한 key가 현재 모델에 없음. 유사 대상을 추측하지 않는다. |
| `AMBIGUOUS_TARGET` | label/text만으로 여러 후보 가능. exact identity 필요. |
| `SOURCE_MAPPING_UNVERIFIED` | Viewer→Source mapping을 검증하지 못함. |
| `RENDER_INSTANCE_ONLY` | Viewer instance 범위만 지원. |
| `PDF_OUTPUT_UNSUPPORTED` | 서버 PDF 반영 근거 없음. |
| `EXCEL_OUTPUT_UNSUPPORTED` | Excel 출력은 검증하지 않음. |
| `HISTORY_LIMIT_REACHED` | Draft History 200개 한도. |
| `INVALID_PAYLOAD` | 필수 필드/type/range 위반. |
| `RUNTIME_UI_NOT_CONNECTED` | Adapter POC는 있으나 runtime Store/UI 실행 금지. |
| `CANONICAL_SERIALIZER_REQUIRED` | Source+Structure/Reflow 혼합 materialization 경로 미완성. |

Validation 실패는 HTTP 4xx와 `{valid:false, code, message, details}`를 반환하며 Operation과 History Event를 만들지 않는다.
# DIM 1.3 additions

- `DIM_TABLE_CELL_SPAN_INVALID`
- `DIM_TABLE_CELL_SPAN_OUT_OF_RANGE`
- `DIM_TABLE_CELL_SPAN_OVERLAP`
- `DIM_TABLE_DUPLICATE_CELL_COORDINATE`
- `DIM_TABLE_COVERED_CELL_CONFLICT`
- `DIM_IMAGE_ASSET_NOT_FOUND`
- `DIM_IMAGE_ASSET_INVALID`
- `DIM_IMAGE_MIME_UNSUPPORTED`
- `DIM_IMAGE_PUBLISH_FAILED`
- `DIM_IMAGE_GEOMETRY_INVALID`
