# MVP 5.2 Logical Column Reorder + Logical Row Editing 결과

## 최종 판정

**B — Column reorder와 고정 Row 편집은 안정적으로 동작하며, Row reorder는 데이터 의미 안전성 때문에 제한했다.**

`tbl:financial-7col`의 Viewer-level Logical Column 순서를 바꾸고 fixed row를 resize/hide/restore하는 전체 저장·replay 루프가 성공했다. 원본 UBJF, binding, 출력 파이프라인은 변경하지 않았다.

## Column Reorder 결과

- Column 2를 visual index `2 → 1`로 이동: `[0,2,1,3,4,5,6]`
- 대상 Column member: 24개 유지
  - Header 1
  - Group Header 3
  - Detail 17
  - Summary 3
- 이동 전후 168개 table member의 Viewer/source identity 목록 동일
- Column 2 width `70 → 100`, Column 4 hide를 reorder와 동시에 적용 성공
- 동일 Column move upsert 시 최초 `originalVisualIndex` 보존
- 숨긴 Column의 resize/move API 차단
- sample의 Group Header Cell은 실제 colspan 없는 독립 7 Cell이고 검증 그룹은 하나다. 표의 좌/우 경계를 group boundary로 차단했으며, 경계 시도는 operation 수 `1 → 1`로 저장되지 않았다.

이번 구현은 Header만 X swap하지 않는다. 불변 `logicalColumnIndex`에 묶인 24개 member 전체의 derived left를 visual order로 다시 계산한다. 따라서 화면 위치가 바뀌어도 source ID와 data binding identity는 유지된다.

## Logical Row 결과

MVP 5.0의 24개 Row Group을 다시 추론하지 않고 재사용했다. 모든 Row가 정확히 7개 member로 resolve됐다.

- Summary Row 선택/강조 성공: 다른 Row 포함 없이 7 Cell
- Summary Row 높이 `27 → 39`, 아래 Row top 누적 reflow 성공
- Group Header Row hide 시 visible=false와 vertical space collapse 성공
- hide operation 삭제 후 원래 높이/위치 복원 성공
- Column hide와 Row hide의 visibility 교집합 적용 성공
- Rendered Detail Row 선택/강조 성공
- Rendered Detail Row의 resize/hide control disabled
- 직접 API 변경도 HTTP 409 `DATA_ROW_STRUCTURE_EDIT_REJECTED`로 거부

Row reorder 버튼은 비활성화했다. 현재 sample의 fixed row는 Header, 각 데이터 그룹의 Group Header/Summary이고 이 순서를 바꾸면 Band hierarchy, summary 의미, pagination에 영향을 줄 수 있다. 안전한 Static Row 쌍이 없으므로 `STOPPED_BY_DATA_SEMANTICS`로 기록했다.

## 저장과 Replay

추가 연산은 `moveColumn`, `resizeRow`, `hideRow`다. Source Patch/Render Position Patch와 분리된 기존 Structure Operation 저장소를 사용한다.

- operation 하나 삭제: base model부터 남은 전체 operation replay 성공
- move 삭제 후 원래 order 복구, resize/hide/row operation 유지
- move 재생성 후 `[0,2,1,3,4,5,6]` 복원
- 새로고침 5회 + 새 Browser Context 5회: order, width, hidden, row top/height, member count 모두 동일
- 테스트 draft operation: 최종 0건 cleanup

## 회귀와 무결성

- Structure Operation service: 4/4 통과
- MVP 5.1 Column selection/resize/hide/restore/10회 replay: 통과
- MVP 4.4 inline/toolbar/resize/hide/restore: 통과
- 당시 기존 후보 0개 가정으로 실패한 1건은 PRE-AI BASELINE v1에서 전후 후보 목록/트리 해시 동일성 검증으로 교정했다. 현재 전체 core 31/31 통과이며 사용자 후보는 보존됐다.
- 원본 `form.ubjf` SHA-256: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` 전후 동일
- 원본 `info.xml` SHA-256: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` 전후 동일
- 신규 후보 프로젝트: 0개
- Viewer 객체 수 및 기존 Patch 저장소 변경 없음

## 근거

- 설계: [27-mvp52-column-row-editing-design.md](27-mvp52-column-row-editing-design.md)
- E2E: `mysuit-mvp-work/logs/mvp52-e2e-result.json`
- Column: `mysuit-mvp-work/logs/mvp52-column-reorder.json`
- Row: `mysuit-mvp-work/logs/mvp52-row-editing.json`
- Replay: `mysuit-mvp-work/logs/mvp52-structure-replay.json`
- 무결성: `mysuit-mvp-work/logs/mvp52-integrity.json`
- 캡처: `mysuit-mvp-work/screenshots/mvp52-*.png`

## 다음 단계

다음은 **MVP 5.3 Table-Level Editing**이다. Table 전체 선택/이동, 전체 폭 조정, collapse/expand와 group layout을 Viewer-level operation으로 먼저 검증한다. 실제 후보 UBJF와 서버 출력 반영은 그 다음 MVP 5.4 Structure Operation Adapter에서 별도로 다룬다.
