# AI Builder Editing Workspace 2.0 Design

## 구조

```text
AiBuilderShell
├ AiBuilderSidebar   (src/client/ai-builder/sidebar.js, 생성하기·편집하기 공통 1개)
├ TopBar             (.ai-topbar, 52px)
└ Content
   ├ 생성하기: 기존 Upload 화면
   └ 편집하기: 기존 UView5 iframe + 우측 Panel 380px
```

- 공통 스타일은 `src/client/ai-builder/shell.css` 한 곳에만 둔다. `import.css`/`refinement.css`/`editing-workspace.css`에 있던 사이드바 규칙은 삭제했다.
- 토큰: `--ai-sidebar-width`(184) `--ai-sidebar-collapsed-width`(64) `--ai-topbar-height`(52) `--ai-panel-width`(380, 1180px 이하 360) `--ai-green-primary` `--ai-green-dark` `--ai-surface` `--ai-border`
- Brand는 폭을 늘리지 않고 로고 26px, 글자 15/12px, 좌우 패딩 4px로 한 줄에 맞췄다(넘침 0px 측정).
- 편집 화면: body overflow hidden, Sidebar fixed, main은 `grid-template-columns: minmax(0,1fr) var(--ai-panel-width)`. 1920에서 늘어난 폭은 Viewer가 쓴다.
- 편집하기 메뉴 링크는 마지막으로 연 편집 URL(localStorage, 실패 시 무시)로 연결한다.

## TopBar

왼쪽 `AI Builder / 편집하기` + 문서명, 오른쪽 실행 취소·다시 실행·저장 상태·저장. 도움말/아바타는 편집 화면에 없다.

오류는 코드 대신 사용자 문구로 표시한다(`IMPORT_TEMPLATE_INVALID` → "서식을 불러오는 중 문제가 발생했습니다."). `?debug=1`일 때만 "자세히 보기"에 코드와 details를 보여준다.

## 우측 Panel

탭 순서 `채팅 | 직접 편집 | 데이터 연결`. 탭 전환은 panel `hidden`만 바꾸고 iframe `src`는 건드리지 않는다.

기존 편집기(`#property-editor` 등)는 숨긴 채 DOM에 남겨 두고, 새 Inspector가 `mvpDirectBridge.property()`로 같은 쓰기 경로(Change Set → History)를 사용한다. 쓰기 경로가 하나라 Undo/Redo·저장 계약이 바뀌지 않는다.

### 채팅

- AI 도우미 소개, 현재 문서, 추천 작업 4개(클릭 시 입력창에 문장 채움), 대화 스크롤, 하단 입력창.
- `aiBuilder.chat.setProvider(provider)`로 ChatProvider를 연결한다. provider는 `{message, scope, state}`를 받고 `{reply}`를 돌려준다. `state`는 직접 편집·데이터 연결과 같은 Builder state(선택 요소, Import Context, Binding Proposal)다.
- provider가 없으면 사용자 말풍선 뒤에 "AI 연결이 아직 설정되지 않았습니다."만 표시한다. 가짜 응답은 없다.

### 직접 편집 Inspector

선택 요소 카드(아이콘·종류·이름) 아래에 섹션을 필요한 것만 그린다.

| 대상 | 섹션 |
|---|---|
| 텍스트/표 셀 | 빠른 편집(문구, 글꼴 크기 ±, 굵게, 정렬), 크기, 위치(자유배치 라벨만), 표시, 고급 설정 |
| 표 셀 | 위에 더해 행 편집, 열 편집 |
| 이미지 | 크기(비율 유지), 위치(왼쪽/가운데/오른쪽 + 고급 위치 X/Y), 이미지(맞춤/채우기/원본, 이미지 교체), 표시 |

- 행 편집: 위로/아래로 이동, 행 삭제(확인창), 행 높이 ±·자동 맞춤, 행 숨김 토글(끄면 숨김 연산 삭제 = 복원)
- 열 편집: 왼쪽/오른쪽 이동, 열 너비 ±·자동 맞춤, 열 숨김 토글
- 표 그립(R1…, C1…, TABLE)은 선택한 표 하나에만 그린다. 좌표는 공용 `MvpCoordinateAdapter`로 계산한다.
- 가져온 표의 빈 셀도 선택할 수 있다(빈 행으로 된 표에서 행 편집을 시작하기 위해).

### 데이터 연결

- JSON 없음: "연결된 데이터가 없습니다." + [JSON 파일 선택] [JSON 직접 입력]
- 등록: `PUT /api/ai-builder/context/json` → 기존 JSON Validator(`parseJson`) → Import Context 파일에 원자적 저장 → 기존 Schema Analyzer → Scalar/Array Proposal
- 등록 후: 데이터 카드(파일명, 필드 수, [변경] [제거]), 자동 연결/확인 필요/미연결 요약, 단일 항목 목록, 연결 필드 선택과 샘플 값, [연결 적용], 반복 데이터 카드와 열 매핑
- 적용은 기존 batch History transaction(`binding-proposals/apply`, `array-proposals/apply`)을 그대로 쓴다.

## Viewer 선택 경고(§49)

`static-approval-table-controller`가 120ms 타이머에서 좌표 변환을 예외 처리 없이 호출해, Viewer canvas가 아직 배치되지 않은(크기 0) 동안 매번 uncaught 예외를 냈다. 제품 결함으로 보고 "아직 준비 안 됨"이면 오버레이를 지우고 다음 tick에 다시 시도하게 고쳤다. E2E 전체 구간 pageerror 0건.
