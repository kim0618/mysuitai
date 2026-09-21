# MVP 5.2 Logical Column Reorder + Logical Row Editing 설계

## 범위와 안전 경계

검증 대상은 MVP 5.0에서 확정한 `tbl:financial-7col` 하나다. 원본 `form.ubjf`, `info.xml`, 데이터 binding, 서버/PDF 출력은 수정하지 않는다. 구조 연산은 별도 draft 저장소에서 Viewer 렌더 결과에만 replay한다.

열은 `logicalColumnIndex`를 불변 identity로 사용하고 `visualIndex`는 파생 상태로 계산한다. 따라서 열 이동 후에도 Header 1 + Group Header 3 + Detail 17 + Summary 3, 총 24개 Render Instance와 원래 source/binding 연결이 함께 이동한다. sample 표의 7개 열은 병합 없는 하나의 검증 그룹 `grp:financial-all-columns`이며, 표 양끝을 그룹 경계로 취급한다.

행은 `tableKey + bandId + renderedRowIndex`를 identity로 사용한다. 각 행은 7개 Cell Render Instance로 구성한다.

- `HEADER`, `GROUP_HEADER`, `SUMMARY`, `STATIC`: 선택, 높이 변경, 숨김/복원 가능
- `RENDERED_DETAIL`: 선택/강조만 가능; 이동, 높이 변경, 숨김은 UI와 API 모두 거부
- Row reorder: 데이터 반복 의미 및 fixed/data 경계의 안전성이 확인되지 않아 이번 단계에서는 비활성화하고 중단 근거를 기록

## Structure Operation

기존 `resizeColumn`, `hideColumn`에 다음 연산을 추가한다.

```json
{"operation":"moveColumn","columnIndex":2,"originalVisualIndex":2,"toVisualIndex":1,"groupKey":"grp:financial-all-columns"}
{"operation":"resizeRow","logicalRowKey":"tbl:financial-7col|band:UGHB7543grp_0_dataset_2|rendered-row:0","beforeHeight":27,"afterHeight":39,"rowRole":"SUMMARY"}
{"operation":"hideRow","logicalRowKey":"...","collapseSpace":true}
```

동일 identity/operation은 upsert하며 최초 `originalVisualIndex`, `beforeWidth`, `beforeHeight`를 보존한다. 숨긴 열의 resize/move 및 Rendered Detail Row의 모든 구조 변경은 서버가 거부한다.

## 파생 레이아웃과 Replay

원본 Canvas가 완성된 뒤 base layout을 한 번 snapshot한다. 이후 화면 상태를 직접 누적 변경하지 않고 항상 base + 전체 operation 목록으로 재계산한다.

1. `moveColumn`을 sequence 순으로 적용해 logical identity 배열에서 visual order를 계산한다.
2. 각 visual slot에 resize width와 hide width 0을 적용해 logical column별 left offset을 계산한다.
3. 각 fixed row에 resize height와 hide height 0을 적용하고 아래 행의 top을 누적 reflow한다.
4. 열/행 visibility는 교집합으로 계산해 두 구조 연산이 서로의 숨김 상태를 덮어쓰지 않게 한다.
5. operation 삭제/복원/새로고침은 base에서 남은 전체 목록을 replay한다.

열 순서와 행 위치는 별도 탭이 아니라 동시에 Canvas에 적용된다. Source Patch 및 Render Position Patch와 저장 모델은 섞지 않는다.

## UX

Logical Column panel의 `← 이동`, `이동 →`는 선택된 logical column 전체를 한 slot 이동한다. 양끝에서는 경계 오류를 표시하며 저장하지 않는다. 기존 resize handle, hide/restore와 조합할 수 있다.

Logical Row panel은 명시적인 `행 모드 켜기` 토글을 제공한다. 선택 행 전체에 가로 강조선을 표시하고 fixed row에는 아래쪽 resize handle을 제공한다. 상세 데이터 행은 역할과 7개 member를 표시하지만 편집 control은 disabled 상태로 유지한다. Row 이동 버튼은 검증 중단 상태를 명확히 보여주기 위해 비활성화한다.

## 검증 기준

- Column reorder 전후 24개 member와 source/binding identity 불변
- reorder + resize + hide 조합 및 operation 개별 삭제/replay
- fixed row resize/hide/restore와 아래 행의 공간 재배치
- Rendered Detail Row UI/API 차단
- 새로고침 5회 + 새 context 5회 동일 상태
- 기존 MVP 4.4/5.1 회귀, 원본 hash, 후보 프로젝트 무변경

