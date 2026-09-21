# MVP 5.1 Logical Column Direct Editing 결과

## 판정

**B — Column Selection / Resize / Hide 성공, composite·입력 자동화 제한**

MVP 5.0의 `tbl:financial-7col` 모델을 런타임 Controller에서 재사용해 Column 하나를 24개 Fabric 객체의 구조 그룹으로 편집했다. 실제 resize handle drag, 전체 member width 변경, 오른쪽 Column reflow, hide+space collapse, restore, multiple operation replay가 성공했다.

Header hit-test listener는 구현했으나 headless E2E의 iframe/Fabric 포인터 좌표 자동화가 안정적이지 않아 선택 검증은 동일 Controller의 header source ID→column 진입점으로 수행했다. 또한 composite source Table 사이에 parent ID가 없고 reorder는 중단 조건에 해당하므로 A가 아닌 B다.

## 구현 결과

- `LogicalColumnController`
- `logical-table-model.json` 정적 runtime model
- 별도 `Structure Operation` 저장소/API
- Header/Group Header/Detail/Summary role별 1/3/17/3 member
- Column overlay + 24개 Cell outline + resize handle
- 선택 중 24개 member 이동/scaling 잠금
- resize drag 중 메모리 preview, 종료 시 1개 구조 연산 저장
- hide는 visibility 0과 오른쪽 slot collapse를 동시에 수행
- 숨김 변경 목록에서 `다시 표시`
- operation 삭제/전체 초기화는 base snapshot부터 replay
- 동일 Column resize upsert: before 유지, after 정규화
- 숨긴 Column resize 거부
- reorder 버튼 disabled, source 배열/binding 검증 전 미지원

## 실측

| 항목 | 결과 |
|---|---|
| Column 2 member | 24개 |
| 역할 | Header 1 / Group Header 3 / Detail 17 / Summary 3 |
| 다른 Column 포함 | 0 |
| Column 2 resize | 70 → 100 |
| 오른쪽 Column offset | +30 |
| 전체 Table width | 790 → 820 |
| Column 4 hide | visible 24 → 0 |
| hide 후 total width | 820 → 750 |
| Column 5/6 reflow | 각각 왼쪽 70 이동 |
| restore | visibility/offset/width 복원 |
| multiple | col1=90, col2=100, col3=110, col5 hidden |
| 반복 검증 | 새로고침 5 + 새 페이지 5 모두 동일 |
| 객체 수 | 180 유지 |

성능은 Column 선택 28ms, resize 저장 381ms, hide 47ms, restore 58ms였다.

## Replay 순서

원본 Canvas와 기존 Patch가 반영된 위치를 base snapshot으로 잡은 뒤 Structure Operation을 적용한다. 따라서 기존 Render Position delta를 보존하면서 Column offset만 추가된다. Source preview가 Canvas를 다시 그린 경우 남은 Structure Operation을 base부터 replay해야 한다.

## 회귀와 무결성

- 기존 inline editor 열기/Esc 취소 성공
- Viewer 객체 180개 유지
- 모든 Column member 24개 유지
- 원본 form/info SHA-256 전후 동일
- 기존 잔여 후보 `sample_mvp4_20260811_102025_7201dd` 목록 전후 동일
- 신규 후보 생성 0
- MVP 5.1 테스트 Draft Structure Operation 0건 cleanup

## 제한

- Server PDF/후보 UBJF에는 반영하지 않는다.
- Table source total width 자체를 runtime Fabric 객체로 유지하지 않으므로 runtime Cell layout만 재계산한다.
- sample Group Header는 colspan이 없는 독립 7 Cell이라 span 보정이 필요 없었다. 다른 문서의 multi-column span은 미지원이다.
- Column reorder는 네 source UBTable 배열과 binding의 원자성 검증 전까지 중단했다.

## 근거

- `mvp51-column-selection.json`
- `mvp51-column-resize.json`
- `mvp51-column-hide.json`
- `mvp51-column-restore.json`
- `mvp51-structure-replay.json`
- `mvp51-regression.json`
- `mvp51-integrity.json`
- `mvp51-performance.json`
- `mvp51-column-*.png`
