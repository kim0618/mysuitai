# MVP 5.0 Table Operation Feasibility

## 계층 판정

| 연산 | 계층 | 이유 |
|---|---|---|
| Cell text/style | SOURCE | source Cell property Patch |
| Column hide | HYBRID | 네 source Table의 Cell/width/x/border와 Viewer preview reflow |
| Column resize | HYBRID | 대상 width, 뒤 Column x, Table width, wrapper border 동시 변경 |
| Column reorder | SOURCE/HYBRID | 2차원 table 순서, columnIndex/x, binding과 preview를 원자 변경 |
| Rendered Row 단독 이동 | RENDER | 특정 반복 인스턴스만 대상 |
| Data Row reorder | DATA_SOURCE | UBDataBand 출력 순서는 dataset/sort 결과 |
| Fixed Row reorder | SOURCE | source table 2차원 row와 span 재검증 필요 |
| Editor collapse | UI | 출력 비영향 임시 상태 |
| Output collapse | HYBRID | Band height, 아래 Band, page break/pagination 재계산 |

## Structure Operation Schema

```json
{"operation":"hideColumn","tableKey":"tbl:financial-7col","columnIndex":2,"collapseSpace":true}
```

```json
{"operation":"resizeColumn","tableKey":"tbl:financial-7col","columnIndex":1,"beforeWidth":70,"afterWidth":100}
```

```json
{"operation":"moveColumn","tableKey":"tbl:financial-7col","fromIndex":2,"toIndex":1}
```

```json
{"operation":"collapseTable","tableKey":"tbl:financial-7col","outputCollapse":true}
```

구조 Patch에는 적용 당시 sourceTableIds, schema fingerprint, affected sourceCellIds, before column widths를 함께 저장해야 한다. 실행기는 전체 변경을 메모리에서 검증한 뒤 한 번만 기록하고 하나라도 불일치하면 전부 rollback해야 한다.

## 연산별 요구사항

Column hide는 해당 열의 Header/Group Header/Detail/Summary Cell을 숨기고 오른쪽 열 x를 당기며 각 Table width를 줄여야 한다. 병합 영역과 교차하면 지원하지 않거나 span을 명시적으로 재작성해야 한다.

Column resize는 네 source Table의 wrapper `columnWidth/width`, 내부 Cell `x/width`, 뒤 wrapper/Cell의 `x`, Table width를 같은 delta로 바꿔야 한다. 단일 UBLabel width Patch로는 구조 일관성이 깨진다.

Column reorder는 화면 좌표 교환만으로 부족하다. source `table[row]` 배열 순서, `columnIndex`, wrapper/Cell x, data binding의 의미 보존을 원자적으로 처리해야 한다.

Data Row reorder는 layout row 이동이 아니라 dataset 정렬이다. Group Header/Footer와 합계 의미까지 달라질 수 있어 구조 Patch 대상으로 취급하면 안 된다.

Output collapse는 Table visible만 false로 만드는 작업이 아니다. Band 높이, 뒤 Band y, 페이지 나눔과 서버 pagination이 관여하므로 공식 layout/output adapter 전에는 지원하지 않는다.

## MVP 5.1 진입 조건

Header 클릭으로 column key를 선택하는 UI부터 시작할 수 있다. 실제 resize/hide/reorder 전에는 다른 문서 표본에서 composite table parent 추론, merged-cell 교차 정책, schema fingerprint/rollback을 추가 검증해야 한다.
