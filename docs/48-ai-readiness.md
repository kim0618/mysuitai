# AI Readiness

## 현재 사용 가능한 Target

- Object: Source mapping이 검증되는 UBLabel과 정확한 Render Instance
- Logical Column: sample financial 7-column table의 col:0~6
- Logical Row: Header/Group Header/Rendered Detail/Summary의 정확한 runtime row key
- Composite Table: `ctbl:main-report-table`

## Maturity

- STABLE (18): object text/style/size/visibility, column resize/move/hide/restore, safe row resize/hide/restore, verified Header collapse, table hide/restore/collapse
- LIMITED (3): `moveRenderObject`, `moveTable`, `resizeTableWidth`의 Viewer-only 동작
- POC_ONLY (5): static/bound column add, removeColumn, static row add/remove
- UNSUPPORTED: Detail Row 구조 편집, Summary/rowSpan collapse/remove, 다른 group 이동, Registry 밖 Operation

세부 Viewer/Source/PDF 범위는 [Operation Contract](46-operation-contract.md)와 `mvp59-capability-matrix.json`을 따른다. Viewer-only 작업은 서버 PDF 반영으로 과장하지 않는다.

## History

STABLE Source Patch, Render Position, Structure Operation은 단일 Timeline과 200-event limit, Undo/Redo, branch clear, reload replay, transaction rollback을 지원한다. Validation 실패는 History에 기록되지 않는다. POC Add/Remove는 runtime History 대상이 아니다.

## 남은 제한

- Add/Remove Column·Row와 Bound Column runtime Store/UI 연결 없음
- Source Patch + Structure/Reflow를 하나의 후보 UBJF에 canonical하게 합성하는 serializer는 부분 지원
- Render Position, Table move/outer resize는 Viewer-only
- sample 단일 폼에서 검증한 Logical model이며 일반 폼 자동 discovery 계약은 아님
- Excel 출력은 검증하지 않음

## AI가 절대 직접 접근하면 안 되는 영역

- `form.ubjf` raw 직접 수정
- 임의 SQL 생성/수정
- 임의 Dataset 생성
- 임의 Cell ID 생성 후 Source write
- 등록되지 않은 Operation
- Validation bypass
- History bypass
- Candidate Atomic Apply bypass
- 라이선스/제품 코드 우회

AI는 label/text/좌표 유사도로 대상을 추측하지 않는다. Exact Target identity가 없거나 Capability/Validation이 실패하면 실행하지 않는다. PRE-AI BASELINE v1의 AI allowlist는 STABLE 18개뿐이며 LIMITED/POC_ONLY 자동 실행은 허용하지 않는다. 전체 회귀와 무결성 검증 결과 `AI_READY_FOR_PLANNER_POC=true`다.
