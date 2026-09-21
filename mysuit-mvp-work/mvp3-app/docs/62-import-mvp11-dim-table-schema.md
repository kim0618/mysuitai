# Import MVP 1.1 DIM Table Schema

DIM 1.1은 기존 1.0 `text`를 그대로 유지하고 `table`을 추가한다. Table은 `id/type/x/y/width/height/columns/rows`, column은 `id/width`, row는 `height/cells`, cell은 문자열 `text`만 허용한다.

columns와 rows는 각각 1개 이상이어야 하며 column ID는 고유해야 한다. 모든 길이는 양수이고 column width 합과 table width, row height 합과 table height는 `1e-9` 이내에서 정확히 일치해야 한다. 모든 row의 cell 수는 column 수와 같아야 하며 page를 벗어나면 거부한다. `rowSpan`, `colSpan`, dataset/column/binding/formula 필드는 지원하지 않고 자동 보정 없이 error code로 거부한다. DIM 1.0에서는 계속 text만 허용한다.
