# Import MVP 1.1 Table Prototype Contract

선정 원본은 `sample/Sales/SL_Report_01`의 `TB7451`이다. 실제 `UBTable`이며 3×6, 674×75, parent band `UDHB8093`이다. 모든 Cell이 정적이고 span·dataset binding·formula가 없으며 `SOLD` border를 보유해 grid 렌더 검증에 적합하다. 원본은 읽기만 하고 deep clone한다.

Table 필수 구조는 `className`, `id`, `band`, `x/y`, `width/height`, `rowCount/columnCount`, 2차원 `table`이다. 각 wrapper는 `x/y`, `width/height`, `rowHeight/columnWidth`, `borderString`, `cell`을 가진다. Cell은 `className: Cell`, `id`, `x/y`, `width/height`, `text` 및 원본 style 필드를 가진다. wrapper와 Cell 좌표는 table-relative이고 Table 좌표는 FreeForm page-absolute이다.

MVP 5.5와 같은 deep-clone/새 ID/rectangular relayout 원칙을 재사용한다. 선택 당시 form SHA-256은 `ff93eea5e10aa0cdbf0d7f5d476148a73ee7cad2c31a562dd09228c97a14073f`이다. 전체 필드 증거는 `logs/import-mvp11-table-prototype.json`에 있다.
