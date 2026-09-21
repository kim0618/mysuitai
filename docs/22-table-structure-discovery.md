# MVP 5.0 Table Structure Discovery

## 결론

sample `form.ubjf`에는 명시적인 테이블 구조가 존재한다. 첫 페이지에 `UBTable` 5개와 테이블형 `UBApproval` 1개가 있으며, Viewer에서는 원본 Table 객체가 유지되지 않고 각 Cell이 `UBLabel`로 평탄화된다. 렌더 유형은 **Type C**다.

## 원본 포맷과 전수 조사

`form.ubjf`는 Base64 → zlib → 바깥 JSON → page JSON 순으로 해제했다. 원본 및 제품 Viewer 코드에서 확인된 핵심 명칭은 다음과 같다.

- 객체: `UBTable`, `UBApproval`, `Cell`
- Table: `rowCount`, `columnCount`, 2차원 `table`
- Cell wrapper: `rowIndex`, `columnIndex`, `rowSpan`, `columnWidth`, `rowHeight`, `status`, `borderString`
- Cell: `id`, `x`, `y`, `width`, `height`, `dataSet`, `column`, `dataType`, `systemFunction`
- Band: `UBDataHeaderBand`, `UBGroupHeaderBand`, `UBDataBand`, `UBGroupFooterBand`, `UBPageHeaderBand`, `UBPageFooterBand`
- Group 연결: `groupHeader`, `columns`, `dataSet`, `column`

sample에는 `colSpan` 값이 있는 Cell은 없었다. `UBApproval`의 `UB5115957`에서 `rowSpan=2`, wrapper 상태 `MS/MR`인 병합 셀 하나를 확인했다.

## 실제 테이블

| ID | 유형/Band | 행×열 | 역할 |
|---|---|---:|---|
| `UBA6577` | UBApproval / UPHB2584 | 2×2 | 결재란, rowspan 포함 |
| `TB3039` | UBTable / UDHB4114 | 1×7 | 데이터 헤더(2013~2018) |
| `TB3979` | UBTable / UGHB7543 | 1×7 | 그룹 헤더 template |
| `TB5514` | UBTable / UDB3195 | 1×7 | 상세 template |
| `TB8715` | UBTable / UGFB0223 | 1×7 | 그룹 요약 |
| `TB7301` | UBTable / UPFB9094 | 1×2 | 페이지 footer |

본문 네 Table의 source column 폭은 모두 `[370,70,70,70,70,70,70]`이다. `TB5514`는 `dataset_2.col_2`부터 `col_8`, `TB8715`는 동일 상세 데이터의 합계 식을 가진다. Band 역할, 동일 column schema, dataset binding을 함께 사용해 하나의 `financial-7col` 논리 표로 합성했다. 좌표는 이 결론의 근거가 아니라 source schema 일치 검산으로만 사용했다.

## 두 영역 상세

### 결재란

`UBA6577`은 2×2이며 첫 Cell `UB5115957`이 두 행을 차지한다. 두 번째 행 첫 wrapper는 `status=MR`이고 0×0 placeholder Cell을 가진다. 병합은 별도 신규 Cell을 추정하지 않고 `rowSpan`과 wrapper status로 표현해야 한다.

### 실적 본문 표

원본은 Header/Group Header/Detail/Summary마다 별도 `UBTable`이다. Viewer 실측은 다음과 같다.

- Header: 7 Cell 인스턴스
- Group Header: 3개 rendered group × 7 = 21
- Detail: 17개 data row × 7 = 119
- Summary: 3개 group summary × 7 = 21
- 본문 합계: 168

Footer 2, 결재란 7까지 포함하면 원본 Table Cell에서 유래한 Viewer `UBLabel`은 177개다. 전체 Viewer 객체는 180개이며 나머지는 일반 Label/Image 계열이다. 모든 UBLabel을 Cell로 보지 않고 source Cell ID membership으로만 분류했다.

## Border

본문 Cell wrapper에는 네 방향 정보를 직렬화한 `borderString`이 있다. Viewer 런타임에서는 별도 `UBLine`/`UBTable` 객체가 발견되지 않았고 Cell 유래 객체 177개는 모두 `UBLabel`이었다. 따라서 source 구조 편집 시 wrapper border/layout도 함께 갱신해야 하며, 런타임에서는 Cell 객체 경계를 다시 그리는 방식으로 보인다.

## 식별 안정성

Viewer Cell은 `sourceCellId + 합성 bandId + rowIndex + renderIndex`로 Render Instance Key에 연결했다. source Table/Cell ID는 새로고침, zoom, 위치 Patch, text Patch와 무관한 논리 identity다. 같은 source Cell이 Data Band에서 여러 Render Instance를 생성한다.

근거: `mvp50-table-discovery.json`, `mvp50-table-object-mapping.json`.
