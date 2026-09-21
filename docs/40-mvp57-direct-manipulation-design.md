# MVP 5.7 Direct Manipulation UX 설계

## 목표

MVP 5.1~5.6에서 검증한 Logical Column, Logical Row, Composite Table operation을 별도 기능 패널 없이 Viewer 위의 직접 조작 핸들로 연결한다. 새로운 source 구조 기능은 추가하지 않고 기존 capability와 안전 정책을 그대로 사용한다.

## 좌표 계층

`screen-canvas-coordinate.js`가 Fabric canvas 좌표와 iframe viewport 좌표를 양방향 변환한다. 표시 중인 가장 큰 canvas를 선택하고 DOM scale, Fabric viewport transform, zoom을 함께 반영한다. 숨겨진 0×0 canvas는 좌표 기준에서 제외하며 계산 불가능한 상태에서는 핸들을 만들지 않고 다음 render tick에 재시도한다.

## 인터랙션

- Column: Header 좌상단 grip drag/drop, 경계 resize, context menu
- Row: 좌측 gutter 선택, 고정 행 하단 resize, capability 기반 context menu
- Table: 상단 grip 이동, 우측 외곽 resize, 기존 hide/collapse action
- 선택 우선순위: 직접 조작 overlay가 객체 선택보다 우선하며 Table overlay는 Row/Column overlay 뒤에 생성한다.
- 동시 조작: 전역 interaction lock 하나만 허용한다.
- 저장: pointermove는 메모리 preview만 갱신하고 pointerup에서 operation 하나를 저장한다.
- 실패: API 오류 또는 pointer cancel이면 operation을 다시 읽어 preview를 rollback한다.
- replay: 저장 후 기존 controller의 `loadOps`/`sync`로 다시 계산하므로 새로고침 뒤에도 같은 결과가 적용된다.

포인터는 target, iframe Document, iframe Window에 capture listener를 등록한다. Viewer가 mode 전환 과정에서 재로딩될 수 있으므로 canvas가 표시된 이후 overlay를 생성하고, 상태/zoom/scroll이 바뀐 경우에만 다시 그린다.

## Capability 정책

- Column reorder/resize/hide/reset: 지원
- Add/Remove Column: MVP 5.5 source POC 전용이므로 direct context menu에서는 비활성
- Header/Summary 등 고정 Row resize/hide: 지원
- Header collapse: 지원
- Rendered Detail Row 구조 변경: 선택만 허용하고 resize/hide/collapse 차단
- Table move/width/hide/collapse: 지원
- 일반 Cross-Band reflow와 자동 높이 scaling: 미지원

## 안전 경계

페이지 최대 폭 792, Column 최소 폭 20, Row 높이 12~200을 유지한다. 범위 밖 Column drop은 저장하지 않는다. 후보 source 반영은 기존 MVP 5.4/5.6 adapter만 사용하며 원본 프로젝트에는 쓰지 않는다.

