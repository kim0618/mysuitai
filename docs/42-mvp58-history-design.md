# MVP 5.8 Unified History 설계

## 상태 모델

History는 Canvas 값을 반대로 수정하지 않는다. 각 사용자 mutation의 직전/직후에 Source Patch, Render Position Patch, Structure Operation의 draft-scoped snapshot을 캡처하고 다음 상태를 저장한다.

```text
Base State + History Events + Cursor
  → active snapshot 선택
  → 세 derived store 교체
  → Object/Column/Row/Table controller replay
  → Viewer render
```

Event에는 schemaVersion, event/userAction ID, sequence, timestamp, scope, operation, target, before/after, source operation ID, generated IDs, label 및 내부 before/after state가 포함된다. API 응답에서는 내부 snapshot을 제외한다.

## Transaction

새 mutation은 기존 service 검증과 저장이 성공한 뒤 History redo branch를 자르고 Event를 추가한다. History 저장이 실패하면 세 Store를 직전 snapshot으로 복구한다. Undo/Redo는 target cursor의 snapshot을 세 Store에 적용한 뒤 cursor를 commit하며, rebuild 실패 시 기존 Store와 cursor를 유지한다.

History 파일은 `data/history.json`, schema version은 1, draft key는 `layoutDraftId|projectName|formName`이다. 임시 파일 write 후 rename하고 draft lock을 사용한다. 최대 200 Event이며 snapshot compaction은 하지 않는다.

## Replay 순서

현재 구현은 Source Patch → Render Position Patch → Structure Operation store를 교체한 후 기존 logical controller의 `loadOps`/`sync`, Source preview, Render Position replay를 수행한다. 구조 controller가 Base snapshot에서 전체 derived layout을 다시 계산하므로 Column reorder/collapse/Table move에 역연산을 사용하지 않는다.

## Coalescing과 UI

- Column/Row/Table pointermove: 기존 MVP 5.7 preview, pointerup 저장 1회
- Render object keyboard move: 기존 250ms debounce
- Text: 입력 중 preview, Enter 또는 blur 저장 1회, Esc는 저장 없음
- Toolbar: `↶ Undo`, `↷ Redo`
- Shortcut: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y
- input/textarea/select/contenteditable에서는 native undo 우선
- cursor 뒤 Event는 History panel에서 흐리게 표시

Global Reset은 History와 세 Store를 비우고 Base로 복구하며 Reset 자체를 Event로 만들지 않는다.

## 현재 구조적 제한

MVP 5.5 Add/Remove Column/Row와 Bound Column은 독립 source POC이며 현재 Viewer Structure Operation Store에 연결돼 있지 않다. generatedIds schema와 identity 보존 unit은 구현했지만 실제 direct UI Undo/Redo는 연결하지 않았다. 또한 기존 Source Patch serializer와 Structure/Reflow serializer 결과를 한 후보 파일에 연속 합성하는 경로가 없으므로 cursor별 PDF smoke는 Structure state 차이만 materialize한다.

