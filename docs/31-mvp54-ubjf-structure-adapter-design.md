# MVP 5.4 UBJF Structure Adapter 설계

## Source 구조

본문 Composite Table은 `TB3039`, `TB3979`, `TB5514`, `TB8715` 네 개의 독립 1×7 `UBTable`이다. 별도 column metadata 배열은 없고 각 wrapper와 `Cell`이 다음 구조 값을 중복 보유한다.

- wrapper: `x`, `width`, `columnWidth`, `columnIndex`, `height`, `rowHeight`, `borderString`
- Cell: `x`, `width`, `height`, `id`, `dataSet`, `column`, `dataType`, `systemFunction`
- UBTable: `width`, `height`, `table[][]`, `rowCount`, `columnCount`

따라서 Adapter는 Viewer 객체 168개를 개별 patch하지 않고 네 source Table의 동일 logical column wrapper/Cell을 원자적으로 변경한다.

## Mapping과 불변 서명

MVP 5.0 Logical Model의 columnIndex와 네 source Table을 연결해 7×4 source column mapping을 만든다. 다음 값은 operation 전후 정렬된 identity signature로 비교하며 변경을 금지한다.

`Cell.id`, `dataSet`, `column`, `dataType`, `systemFunction`, `text`, `borderString`, `rowSpan`

시각 순서가 바뀌어도 signature는 Cell ID 기준으로 비교한다. rowCount/columnCount와 네 Table membership도 고정한다.

## Column Adapter

### Resize

logical column의 wrapper `width/columnWidth`와 Cell `width`를 변경한다. visual order의 누적 width로 wrapper/Cell `x`를 전부 재계산하고 UBTable width를 합계로 변경한다.

### Hide

삭제하지 않고 identity를 보존한다. 해당 wrapper/Cell width를 0으로 설정하고 Cell `visible=false`를 추가한다. 오른쪽 column X와 Table width를 collapse한다.

### Reorder

네 Table의 row array에서 동일 logical wrapper를 같은 visual slot으로 이동한다. wrapper `columnIndex`와 모든 X를 visual order 기준으로 다시 기록한다. Cell 자체와 binding/style/border는 wrapper와 함께 이동한다.

## Row/Table Adapter

고정 source Band에 정확히 대응하는 Header/Group Header/Summary row만 resize 가능하다. Table wrapper/Cell height와 Band height delta를 함께 적용한다. Rendered Detail instance는 source 한 행과 일대일이 아니므로 차단한다.

Row hide와 Table hide는 source Table/Cell `visible=false`로 출력 숨김만 지원한다. Band/아래 객체 collapse는 안전한 source hierarchy 근거가 없어 수행하지 않는다.

## Atomic Candidate

1. 원본 hash 기록
2. `sample_mvp54_*` 고유 후보로 프로젝트 복사
3. source/candidate parse 및 전체 operation 검증
4. 메모리 clone에 네 Table 원자 적용
5. binding/identity signature 검증
6. serialize 후 reparse/signature 재검증
7. 후보 form 한 번 저장 및 metadata 기록
8. 원본 hash 재검증

실패 시 해당 MVP 5.4 후보 전체를 제거한다. 원본이나 기존 MVP 4 후보는 cleanup 대상이 아니다.

## 출력 검증

후보 URL을 검수 앱의 Structure replay 없이 직접 MySuit UView5로 연다. source Cell ID별 geometry와 member 수를 기록한 뒤 같은 후보에서 MySuit `savePDF`를 호출한다. OCR/PDF 후처리는 사용하지 않는다. Excel export entrypoint가 실제 runtime에 노출된 경우에만 시도한다.

