# MVP 5.5 Add/Remove Structure 설계

## 목표와 범위

MVP 5.5는 기존 4개 source `UBTable`에 실제 Cell 구조를 생성하거나 제거하고, 후보 `form.ubjf`를 MySuit Viewer와 서버 PDF가 직접 소비할 수 있는지 검증한다.

- Tier 1: `addStaticColumn`, `removeColumn`, 공통 Page Width Guard
- Tier 2: Header Band 한정 `addStaticRow`, 추가된 Static Row의 `removeStaticRow`
- Tier 3: 이미 존재하는 Dataset field만 복제하는 제한적 `addBoundColumn`
- 제외: Dataset/SQL 생성, Rendered Detail Row 삽입, 임의 binding, 전체 vertical reflow

## Page Geometry와 폭 정책

원본 메타데이터는 `pageWidth=794`, `pageHeight=1123`이고 명시적 좌우 margin은 없다. 본문 Table은 `x=2`, `width=790`이다.

```text
usableRight = pageWidth - marginRight = 794
maxTableWidth = usableRight - tableX = 792
currentTableWidth = 790
remainingWidth = 2
```

최종 Table width가 792를 넘으면 저장 전에 `TABLE_WIDTH_OVERFLOW`로 전체 작업을 중단한다. 오류에는 `currentWidth`, `requestedWidth`, `maxWidth`를 포함한다. 이 정책은 source add operation뿐 아니라 기존 `resizeColumn`, `resizeTableWidth` API에도 적용한다.

원본에는 실용적인 신규 열 최소 폭 20을 넣을 공간이 없다. 따라서 성공 add 후보는 암묵적 축소를 하지 않고, `resizeColumn(0, 340)`과 `addStaticColumn(width=30)`을 한 원자 작업에 명시해 최종 width 790을 유지한다.

## 신규 Cell 생성 규칙

네 source Table 각각에 하나의 Cell을 생성한다. 인접 Cell은 스타일 템플릿으로만 복제하고 신규 `UBMVP55...` ID를 발급한다. Static Cell에서는 다음 의미 속성을 제거한다.

- `dataSet`, `column`, `dataType`
- `systemFunction`, `formula`
- formatter/formatValue 계열

Header Cell만 요청 문구를 갖고 Group Header/Detail/Summary Cell은 빈 문자열과 무 binding을 갖는다. wrapper/Cell X, width, `columnIndex`, Table `columnCount/width`는 네 Table에서 함께 다시 계산한다.

## 제거 규칙

`removeColumn`은 hide와 달리 네 Table row array에서 동일 index wrapper를 실제 제거한다. 마지막 하나의 열과 기준 행 제목 Column 0은 차단한다. 제거 후 모든 X/index와 Table width를 다시 계산한다.

이번 POC의 기존 Column 제거는 index 6을 대상으로 했다. 해당 Detail `dataset_2.col_8`과 Summary 수식 Cell이 함께 제거되며, 다른 Cell의 binding은 변경하지 않는다.

## Static Row 규칙

안전한 삽입 위치는 비반복 `UDHB4114` Header Band로 제한한다. 새 row는 7개 고유 Cell ID, `rowIndex=1`, 누적 Y, height 20을 갖고 Table/Band height를 33에서 53으로 함께 변경한다. `rowIndex`가 없으면 MySuit가 두 행을 같은 위치에 렌더하는 것이 실제 검증에서 확인되어 필수 속성으로 고정했다.

제거는 index 0이 아닌 추가 Static Row만 허용하며 binding/formula가 하나라도 있으면 차단한다.

## 제한적 Bound Column

`dataset_2`에는 `col_0~col_8`만 있고 모두 기존 보고서에서 사용된다. 신규 field나 SQL은 만들지 않는다. Tier 3는 serialization 확인을 위해 기존 `dataset_2.col_8`을 새 고유 Cell ID로 복제 표시하고 Summary에는 같은 `FN.Sum`을 생성하는 제한 POC다. 존재하지 않는 `col_99`는 `BOUND_FIELD_NOT_FOUND`로 차단한다.

## 원자성과 검증

1. 원본 hash 기록 및 `sample_mvp55_*` 후보 복사
2. 후보 전체 parse와 operation 선검증
3. 메모리 clone에 모든 operation 적용
4. 폭, 직사각형, 네 Table 열 수, X/index, ID uniqueness, Dataset field 검증
5. 후보 한 번 저장
6. reparse 후 같은 검증 반복
7. 원본 hash 재확인
8. 실패 시 해당 후보만 제거

원본과 기존 사용자 후보는 수정하거나 cleanup하지 않는다.
