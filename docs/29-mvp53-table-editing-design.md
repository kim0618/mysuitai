# MVP 5.3 Composite Logical Table Direct Editing 설계

## 대상과 Identity

대상은 `tbl:financial-7col`을 구성하는 Header/Group Header/Detail/Summary source UBTable 네 개다. 이를 `ctbl:main-report-table` 하나로 노출한다. 결재란과 나머지 12개 Viewer 객체는 제외한다.

Composite identity는 MVP 5.0의 source table IDs, band roles, 7-column schema, dataset binding, 28 logical cells와 168 render instances를 재사용한다. 화면 좌표만으로 membership을 추론하지 않는다.

## 합성 Replay

기존 Column/Row controller가 공유 Structure Operation 목록에서 Table 연산도 읽는다.

1. Column reorder/resize/hide로 logical X/width 계산
2. Row resize/hide로 logical Y/height 계산
3. `resizeTableWidth`를 visible Column에 비율 적용하고 마지막 열에 rounding delta 적용
4. `moveTable`의 동일 dx/dy를 168개 member에 적용
5. `hideTable`과 Column/Row hide의 visibility 교집합 적용
6. Source/Render Position Patch는 기존 의미를 변경하지 않음
7. Editor collapse UI state를 마지막에 적용

각 controller는 자기 축만 설정한다. Column controller는 left/width, Row controller는 top/height를 담당해 Table move와 기존 구조 연산이 서로 덮어쓰지 않는다.

## UX

`표 모드 켜기` 후 member Cell을 선택하면 168개 member의 현재 visible bounds에 outer outline과 내부 overlay를 표시한다. 상단 grip으로 이동하고 우측 handle 또는 toolbar로 전체 너비를 비율 조정한다. Table mode 동안 member의 개별 move/scale은 잠근다.

Table height 자동 scaling은 Detail 반복 Row의 데이터 의미를 바꾸므로 비활성화한다.

## Editor Collapse와 Output Hide

Editor Collapse는 draft별 local UI state다. Canvas member를 편집 화면에서 숨기고 7 columns / 168 objects placeholder를 표시한다. expand 시 저장된 Column/Row/Table 구조를 replay한다. Structure Operation과 출력 상태는 바꾸지 않는다.

Output Hide는 `hideTable` Structure Operation이다. 모든 member를 숨기지만 이번 sample에서 아래 비소속 객체의 같은 layout section/Band 관계를 입증할 수 없으므로 `collapseSpace=false`, `belowObjectReflow=UNSUPPORTED`로 저장한다. 따라서 예상 판정은 B다.

## Operation

- `moveTable`: 최초 before와 최종 after를 upsert
- `resizeTableWidth`: 최초 beforeWidth와 최종 afterWidth, `PROPORTIONAL`
- `hideTable`: 전체 member hide, below-object reflow 미지원

출력 숨김 상태에서는 move/resize를 UI와 API 모두 거부한다. operation 삭제나 구조 초기화는 base logical model에서 남은 전체 목록을 replay한다. Source/Render Patch는 삭제하지 않는다.

## 검증

- 168 member, unrelated 0, source/binding identity 유지
- 전체 이동 시 모든 member 동일 dx/dy와 상대 위치 유지
- visible Column 비율 width와 합계 정확성
- collapse/expand와 output hide/restore 의미 분리
- Column/Row/Table 복합 연산, 삭제/replay
- 새로고침 5회 + 새 context 5회
- MVP 4.4/5.1/5.2 회귀와 원본 hash/후보 무변경

