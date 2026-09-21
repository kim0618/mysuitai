# AI Builder Editing Workspace Design

## 구조

- Global sidebar: 184px, collapsed 64px
- Builder top bar: 54px
- Center: 기존 `#viewer` UView5 iframe 100% 재사용
- Right work panel: 380px 고정
- 외부 body scroll 없음. Viewer와 우측 panel이 각자 scroll을 담당한다.

Viewer toolbar, page navigation, zoom, search, print, PDF, thumbnail은 iframe 내부 구현만 사용하며 Builder shell에 복제하지 않는다.

## 탭

1. 채팅: 기본 활성. backend 미구현이므로 suggestion/composer는 disabled
2. 직접 편집: 기존 source editor와 structure operation을 capability 기반으로 노출
3. 데이터 연결: 기존 scalar/array proposal과 binding operation 재사용

탭 전환은 DOM의 panel hidden 상태만 변경하며 iframe `src`를 변경하지 않는다.

## Capability Matrix

| Target | Level | Product UI |
|---|---|---|
| Text/Label | SUPPORTED | 문구, 글꼴 크기/굵기, 정렬, 표시, 위치, 크기 |
| Table | PARTIAL | 기존 검증된 table structure operation만 사용 |
| Cell | PARTIAL | source label capability 범위의 텍스트/스타일 편집 |
| Row | PARTIAL | 높이, 숨김. 삭제/일반 행 재정렬은 미노출 |
| Column | SUPPORTED | 너비, 좌우 이동, 숨김(기존 controller 계약) |
| Image | UNSUPPORTED | Viewer 선택 가능, source property/replace adapter가 없어 편집 UI 숨김 |
| Dynamic Template | PARTIAL | template style/width 편집, runtime value 직접 편집 차단 |

## 기존 계약

- Selection: `MvpViewerInspector`, stable source ID, runtime→template resolution
- Direct edit: `mvpDirectBridge`와 source patch debounce/history
- Structure: 기존 `__mvp12`, `__mvp51`, `__mvp52rows`
- Binding: 기존 proposal/binding routes
- Save: `/api/ai-builder/save`와 Unified Materializer
- Undo/Redo: 기존 History Timeline

새 Viewer, AI backend, history, binding engine, parser, generator는 만들지 않는다.
