# AI Builder Import Core Freeze

## Decision

`importCoreFreezeReady = true`

MVP 0.4.3의 Import/Binding/Dynamic Runtime/History/Save/Reload/New Context/PDF/Atomicity/Regression 인증과 MVP 0.4.3.1의 실제 Canvas pointer selection 인증을 결합해 Import Core를 Freeze한다.

## Certified final path

```text
UView5 Canvas 실제 mouse click
→ stable runtime instance identity
→ dynamic detail source template resolve
→ Builder Right Panel template selection
→ runtime text edit 차단
→ template width edit
→ 모든 runtime instance 반영
→ Undo / Redo
→ Unified Materializer Save
→ Reload / New Context
```

## Freeze invariants

- Source detail template: 1
- Runtime detail rows: 3
- Runtime identity collisions: 0
- Dataset binding: `ai_items.item`
- Runtime values: `상품A/상품B/상품C`
- Protected originals: unchanged
- Relevant regressions and PRE-AI baseline: PASS

## Product defect corrections included

- 안전한 certification project context가 Builder에서 `sample`로 대체되지 않도록 허용 규칙을 일치시켰다.
- AI Builder가 숨겨진 legacy toggle에 의존하지 않고 기존 direct-edit interaction bridge를 활성화한다.
- source lookup에 draft 및 render identity를 전달한다.
- runtime text가 편집 불가일 때 Right Panel의 unsupported text 초기화가 실패하지 않는다.
- resolved selection event에 runtime/source/band/row/table-cell/binding identity를 제공한다.

## Next phase

Import Foundation 기능을 추가하지 않는다. 다음 단계는 **AI Builder UI Productization**이며, 기존 기능의 사용자용 화면 정돈과 직접 사용자 테스트 준비에 집중한다.
