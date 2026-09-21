# MVP 4.4 Viewer Direct Editing 구현 결과

## 판정

**B — 핵심 Direct Editing 가능, 일부 UX 검증 제한**

UBLabel을 Viewer 안에서 직접 편집하는 핵심 흐름은 구현·검증됐다. 더블클릭 문구 편집, Enter 저장, Esc 취소, floating toolbar의 fontSize/굵기/정렬, 컨텍스트 메뉴 숨김·복원, width/height 리사이즈 정규화, 기존 위치 이동이 기존 Patch 엔진과 연결된다.

다만 실제 모서리 핸들을 처음부터 끝까지 포인터로 끄는 자동화는 환경의 Fabric 좌표 변환 때문에 Controller 완료 이벤트 방식으로 검증했다. 따라서 이 단계의 판정은 A가 아닌 B로 유지한다.

## 구현

- `direct-editor.js`: iframe 내부 inline input, floating toolbar, context menu
- `viewer-inspector.js`: 선택 동기화, resize 감지, scaleX/scaleY를 width/height로 정규화
- `app.js`: 직접 편집을 Source Patch에 연결하고 위치는 기존 Render Position Patch 유지
- 숨김 Patch는 변경 목록에서 `다시 표시`로 복원 가능
- Render Instance Key는 toolbar의 dataset/title에 유지
- 저장 실패 시 입력과 Viewer preview를 직전 값으로 복구

Source Patch와 Render Position Patch는 합치지 않았다. 원본 MySuit JS/JAR/form/info도 수정하지 않았다.

## 실측 결과

| 항목 | 결과 |
|---|---|
| Inline Enter 저장 | 성공 (`MVP 4.4 직접 편집`) |
| Esc 취소 | 성공, 저장 문구 유지 |
| fontSize | 32 → 24 |
| 굵기 토글 | 600 → normal |
| 정렬 | left → center |
| Resize | 425×68 → 455×80 |
| Scale 정규화 | scaleX=1, scaleY=1 |
| 숨김/복원 | false → true |
| Source Patch | 6건 동기화 |
| 기존 위치 회귀 | 통과 |
| 중복 Render Instance | 독립 이동·재적용·초기화 통과 |
| 객체 수 | 180개 유지 |

기존 위치 회귀에서는 `(367,100) → (397,80)` 이동, 새로고침 유지, 중복 ID 객체의 독립 이동/초기화가 다시 통과했다.

## 무결성

- `form.ubjf`: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` 전후 동일
- `info.xml`: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` 전후 동일
- MVP 4.4 전용 Render Position Patch는 테스트 종료 시 삭제
- 기존 기본 layout의 사용자 Render Position Patch는 변경하지 않음

## 근거

- `mysuit-mvp-work/logs/mvp44-direct-editing-result.json`
- `mysuit-mvp-work/logs/mvp411-drag-stability.json`
- `mysuit-mvp-work/logs/mvp411-mode-toggle-result.json`
- `mysuit-mvp-work/screenshots/mvp44-direct-editing.png`

당시 1건의 실패는 기존 `sample_mvp4_*` 사용자 후보를 0개로 가정한 테스트 부채였다. PRE-AI BASELINE v1에서 테스트 전후 후보 목록/트리 해시 동일성 검증으로 교정했으며 core 31/31이 통과했다. 사용자 후보는 삭제하지 않았다.

## 다음 단계

다음 우선순위는 Table Structure Discovery다. Viewer 객체를 Table/Column/Row/Cell 구조로 복원한 뒤 컬럼 폭, 숨김, 순서 변경 가능성을 별도로 검증한다.
