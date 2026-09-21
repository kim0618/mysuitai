# MVP 5.1 Logical Column Direct Editing 설계

## 범위

MVP 5.0에서 확정한 `tbl:financial-7col`만 지원한다. 결재란/병합 Cell, Row 편집, 출력 반영, 신규 Column, binding 변경은 제외한다.

Header Cell을 single click하면 즉시 Logical Column을 선택한다. 일반 Cell single click은 기존 Cell 선택, double click은 기존 inline 편집을 유지한다.

## 구성

```text
MVP 5.0 Logical Model JSON
        ↓
LogicalColumnController
 ├─ Header sourceCellId → columnKey
 ├─ 24 Render Instance resolve
 ├─ column overlay / cell outline / resize handle
 ├─ base layout snapshot
 └─ operations replay
        ↓
Structure Operation API
        ↓
data/structure-operations.json
```

Structure Operation은 Source Patch와 Render Position Patch에서 분리한다. resize/hide는 동일 column/type 기준으로 upsert하며 최초 before를 보존한다. 숨긴 Column의 resize는 거부한다.

## Replay

순서는 다음과 같다.

1. MySuit 원본 Canvas 렌더
2. MVP 5.0 Logical Model과 Render Instance resolve
3. Source preview 적용
4. Structure Operations를 base snapshot부터 재계산
5. Render Position Patch 적용
6. highlight/toolbar 표시

삭제와 reset은 역연산하지 않는다. base layout 복원 후 남은 Operation 전체를 replay한다.

## Layout 계산

각 Column의 source width는 `[370,70,70,70,70,70,70]`이다. resize operation의 afterWidth와 hide 상태로 visible slot의 누적 left를 다시 계산한다.

- 대상 Column: 모든 24개 member의 width 변경
- 오른쪽 Column: 누적 delta만큼 left reflow
- hide: member visible=false, slot width 0
- restore: hide operation 삭제 후 base부터 replay

본문 Group Header는 sample에서 실제 colspan/rowspan이 없고 각 source Column마다 독립 Cell 하나다. 별도 span 보정은 필요하지 않다. Border는 별도 Fabric Line이 아니라 Cell 경계에 포함되므로 member width/left 재계산과 함께 유지된다.

## 실패 처리

저장은 preview 전에 최종 state를 계산할 수 있지만, 서버 실패 시 현재 operation 목록을 다시 조회해 base snapshot부터 replay한다. 부분 상태를 유지하지 않는다. Column mode에서 member 이동과 개별 scaling은 잠그고 선택 해제 시 기존 interaction flag를 복구한다.

## Reorder

MVP 5.1에서는 toolbar 버튼만 disabled로 표시한다. 네 source UBTable의 배열 순서와 binding 의미를 함께 검증하지 않은 runtime 좌표 교환은 구현하지 않는다.
