# MVP 4.4 Viewer Direct Editing 설계

## 원칙

Viewer는 주 편집 인터페이스이고 우측 패널은 정확한 값·변경 목록·원복 UI다. Direct Editing은 별도 저장소를 만들지 않고 기존 Change Set(Source Patch)과 Render Position Patch에 연결한다.

## 구조

```text
MySuit Fabric Canvas
  → MvpViewerInspector (event.target / Render Instance Key)
  → DirectEditor (inline input / toolbar / context menu)
  → Patch Bridge (app.js 단일 state)
  ├→ Source Patch: text/fontSize/fontWeight/textAlign/visible/width/height
  └→ Render Patch: left/top
```

## Inline Text

Fabric 1.5 커스텀 UBLabel의 내부 editing을 변경하지 않는다. iframe 내부에 임시 HTML input을 객체 bounding box와 zoom에 맞춰 표시한다. Enter는 기존 text Patch 저장, Esc는 무변경 취소, blur는 명시적 취소다. Overlay는 저장·출력 객체가 아니다.

## Floating Toolbar

선택 객체 bounding box 근처에 iframe DOM toolbar를 배치한다. fontSize, bold, left/center/right는 Patch Bridge를 통해 우측 입력과 동일 state·API를 사용한다. toolbar pointerdown은 Canvas 선택 해제를 막는다.

## Resize

Fabric 기본 control을 사용하되 rotation은 잠근다. 종료 시 `width*scaleX`, `height*scaleY`를 유한 범위로 검증하고 width/height로 정규화한 뒤 scale을 1로 돌린다. 변경된 속성만 독립 Source Patch로 저장한다. resize 중에는 Position Controller가 동작하지 않는다.

## Context Menu

우클릭 메뉴는 문구 편집, 크기 초기화, 위치 초기화, 숨기기, 모든 변경 초기화를 제공한다. 숨기기는 visible=false Source Patch이며 변경 목록의 삭제/다시 표시로 복구한다.

## 안전성

- 선택은 Fabric `event.target`과 Render Instance Key만 사용한다.
- 원본 UBJF/info 및 제품 JS/JAR은 수정하지 않는다.
- 직접 편집 저장 실패 시 입력 전 값으로 preview를 복구한다.
- 기존 위치 드래그, 새로고침, 중복 ID 독립성 및 rollback을 그대로 회귀한다.
