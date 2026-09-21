# Import MVP 1.1 Table Generator Design

`createImportedTable()`은 검증된 `TB7451`과 첫 wrapper/cell을 각각 독립 deep clone한다. Table ID는 `IMPTB0001`, Cell ID는 row-major 순서의 `IMPCL0001…`로 기존 ID set과 충돌하지 않게 생성한다. source Table은 DIM의 page-absolute 좌표를 쓰고 각 wrapper/Cell은 누적 column/row 크기로 계산한 table-relative 좌표를 쓴다.

원본 border metadata와 기본 style을 보존하고 첫 row는 bold/center header로 설정한다. dataset, column, systemFunction, formula 관련 필드는 제거한다. 생성 직후와 serialize/reparse 후 rectangularity, ID uniqueness, 좌표·크기 합, static-only 조건을 검사한다. Mixed DIM 순서를 유지해 Text와 실제 Source `UBTable`을 같은 FreeForm page에 삽입한다. 기존 template object는 모두 제거한다.

Existing Editor 연결은 변경하지 않는다. Viewer는 Table Cell을 ID가 유지된 `UBLabel` render object로 분해하지만, Editor는 아직 `sample/sample` 및 고정 logical/composite model에 묶여 있어 MVP 1.2 일반화 대상이다.
