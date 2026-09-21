# PRE-AI Capability Matrix v1

기준일: 2026-08-11. 실제 계약의 단일 원천은 `operation-registry.js`이며 이 문서는 동결 시점의 사람이 읽는 사본이다.

| Operation | Target | 성숙도 | Viewer | Source | PDF | 핵심 제한 |
|---|---|---:|:---:|:---:|:---:|---|
| updateText | OBJECT | STABLE | O | O | O | source mapping·payload 검증 |
| setFontSize | OBJECT | STABLE | O | O | O | source mapping·payload 검증 |
| setFontWeight | OBJECT | STABLE | O | O | O | source mapping·payload 검증 |
| setTextAlign | OBJECT | STABLE | O | O | O | source mapping·payload 검증 |
| resizeObject | OBJECT | STABLE | O | O | O | source mapping·payload 검증 |
| hideObject / restoreObject | OBJECT | STABLE | O | O | O | source mapping 필요 |
| moveRenderObject | OBJECT | LIMITED | O | X | X | exact Render Instance, Viewer 전용 |
| resizeColumn | LOGICAL_COLUMN | STABLE | O | O | O | Page Width·hidden guard |
| moveColumn | LOGICAL_COLUMN | STABLE | O | O | O | 동일 group, hidden guard |
| hideColumn / restoreColumn | LOGICAL_COLUMN | STABLE | O | O | O | exact identity |
| addStaticColumn | LOGICAL_COLUMN | POC_ONLY | O | O | O | source POC, runtime 미연결 |
| addBoundColumn | LOGICAL_COLUMN | POC_ONLY | O | O | O | `dataset_2.col_8`만 POC |
| removeColumn | LOGICAL_COLUMN | POC_ONLY | O | O | O | last/formula/binding guard, runtime 미연결 |
| resizeRow | LOGICAL_ROW | STABLE | O | O | O | fixed/static row만 |
| hideRow / restoreRow | LOGICAL_ROW | STABLE | O | O | O | fixed/static row만 |
| collapseRow | LOGICAL_ROW | STABLE | O | O | O | 검증된 Header `UDHB4114`만 |
| addStaticRow / removeStaticRow | LOGICAL_ROW | POC_ONLY | O | O | O | Header source POC, runtime 미연결 |
| moveTable | COMPOSITE_TABLE | LIMITED | O | X | X | Viewer 전용 |
| resizeTableWidth | COMPOSITE_TABLE | LIMITED | O | X | X | Viewer 전용, Page Width guard |
| hideTable / restoreTable | COMPOSITE_TABLE | STABLE | O | O | O | exact table identity |
| collapseTable | COMPOSITE_TABLE | STABLE | O | O | O | Footer 보호·검증된 body flow만 |

합계는 26개이며 STABLE 18, LIMITED 3, POC_ONLY 5다. AI v1 허용목록은 STABLE 18개뿐이다.

Target은 `OBJECT`, `RENDER_INSTANCE`, `LOGICAL_COLUMN`, `LOGICAL_ROW`(HEADER/GROUP_HEADER/SUMMARY/STATIC/RENDERED_DETAIL 의미형), `COMPOSITE_TABLE`로 고정한다. Rendered Detail Row 구조 변경, 일반 Cross-Band reflow, rowSpan 의존 변경, 임의 dataset/SQL/binding, raw UBJF write, Excel/HWP 출력은 지원하지 않는다.

혼합 적용은 동일 계층 내 History 재생은 검증됐으나 Source Patch와 Structure/Reflow를 한 후보에 합치는 canonical serializer는 부분 지원이다. 따라서 AI가 혼합 요청을 직접 raw 합성해서는 안 되며 validate/execute 경계를 반드시 사용한다.
