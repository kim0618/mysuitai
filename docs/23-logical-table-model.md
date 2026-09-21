# MVP 5.0 Logical Table Model

## 모델

```text
LogicalTable
 ├─ tableKey
 ├─ sourceTableIds[]
 ├─ bandIds[]
 ├─ headerRows / groupHeaderRows / detailRows / summaryRows
 ├─ columns[]
 └─ cells[] → renderInstances[]
```

sample 본문 key는 `tbl:financial-7col`, 결재란은 `tbl:approval:UBA6577`이다. 원본에서 업무 표 전체를 가리키는 단일 parent ID는 없으므로 본문 key는 네 source Table의 source metadata 합성 결과다.

## Identity

- Column: `tbl:financial-7col|col:N`
- Logical Cell: `tbl:financial-7col|role:ROLE|row:TEMPLATE|col:N|src:CELL_ID`
- Rendered Row: `tbl:financial-7col|band:RENDER_BAND|rendered-row:N`
- Render Instance: 기존 `p0|c0|src:...|band:...|row:...|idx:...`

Detail template Cell 하나는 여러 Render Instance를 가진다. 예를 들어 7개 상세 source Cell 각각은 17개 렌더 행에 대응한다. source Cell identity와 rendered row identity를 분리했기 때문에 반복 행을 원본 행으로 오인하지 않는다.

## Column/Row 그룹 결과

7개 Column은 각각 24개 객체로 구성된다.

```text
Header 1
+ Group Header 3
+ Detail 17
+ Summary 3
= 24
```

Rendered Row 그룹은 24개이며 각 그룹은 정확히 7개 Cell을 가진다. Header ↔ Detail 연결은 X좌표가 아니라 각 source Table wrapper의 `columnIndex`, 동일 `columnCount`, 동일 `columnWidth` schema, Band 역할과 dataset binding으로 결정한다.

## 선택 POC

저장하지 않는 Canvas top-context outline으로 다음을 검증했다.

- Table: 본문 168개 Cell outline
- Column: column 2의 24개 Cell outline
- Row: 한 rendered row의 7개 Cell outline
- Cell: sourceCellId membership과 Render Instance Key로 단일 Cell 식별

화면은 `mvp50-table-selected.png`, `mvp50-column-selected.png`, `mvp50-row-selected.png`에 있다. Patch나 원본 변경은 생성하지 않았다.

## 안정성

초기 실행 + 새로고침 5회 + 새 페이지 5회에서 다음 구조 서명이 모두 같았다.

`44b9a35249e749f9e90c4043b412569ef9859f1fa3af53ce6158dc623168b375`

서명 입력은 table key, column key별 Render Instance 목록, rendered row key별 인스턴스 목록, Logical Cell ↔ Render Instance 연결이다. 좌표는 서명에 넣지 않아 zoom과 Render Position Patch가 identity를 바꾸지 않는다.

## 제한

본문 네 source Table 사이에 직접적인 `parentTableId`는 없다. 현재 합성은 sample의 명시적 Band chain과 source schema에 대해 안정적이지만 다른 문서에서 서로 무관한 Table이 같은 column schema를 가질 경우 추가 report/band 관계 규칙이 필요하다. 이 때문에 MVP 5.0 판정은 A가 아닌 B다.
