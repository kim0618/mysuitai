# MVP 5.8 Unified History 결과

## 최종 판정

**B — 핵심 Unified Timeline, Undo/Redo, persistence와 transaction safety는 성공했지만 Add/Remove identity UI 및 Source+Structure 복합 후보 materialization이 제한된다.**

## Compound Timeline

한 draft에서 다음 9개 Event를 시간순으로 기록했다.

1. 제목 updateText
2. moveRenderObject
3. hideColumn
4. resizeColumn
5. moveColumn
6. collapseRow
7. moveTable
8. resizeTableWidth
9. hideColumn

9회 Undo 후 cursor 0에서 text, 180 objects, 7-column order/width/visibility, Header, Table position/width, Source/Render Patch가 Base signature와 동일했다. 9회 Redo 후 Final signature도 Undo 전 상태와 동일했다.

## 검증 결과

| 기능 | Undo | Redo | Reload | New Context | Identity |
|---|---:|---:|---:|---:|---:|
| Text | 성공 | 성공 | 성공 | 성공 | Patch ID 유지 |
| Render Position | 성공 | 성공 | 성공 | 성공 | Render Instance Key 유지 |
| Column Resize | 성공 | 성공 | 성공 | 성공 | Logical key 유지 |
| Column Reorder | 성공 | 성공 | 성공 | 성공 | Logical key 유지 |
| Column Add | unit schema | unit schema | 미연결 | 미연결 | generatedIds 보존 |
| Column Remove | unit schema | unit schema | 미연결 | 미연결 | source POC |
| Bound Column | unit schema | unit schema | 미연결 | 미연결 | binding signature 보존 |
| Row Resize | Store 지원 | Store 지원 | 지원 | 지원 | Logical key 유지 |
| Row Add/Remove | unit schema | unit schema | 미연결 | 미연결 | source POC |
| Row Collapse | 성공 | 성공 | 성공 | 성공 | Semantic key 유지 |
| Table Move | 성공 | 성공 | 성공 | 성공 | 168-member 관계 유지 |
| Table Collapse | Store 지원 | Store 지원 | 지원 | 지원 | Composite key 유지 |

Redo branch `A,B,C → Undo×2 → D`는 `A,D`, cursor 2, Redo disabled로 정리됐다. 강제 rebuild HTTP 500에서는 cursor와 세 Store가 유지됐다. toolbar Undo, Ctrl+Y Redo, input native Ctrl+Z 우선도 실제 브라우저에서 통과했다.

## Persistence와 성능

- Reload: cursor 9와 Final signature 유지
- 새 Browser Context: 동일 cursor/Timeline/Viewer state
- Undo 평균: 10.08ms
- Redo 평균: 15.22ms
- History limit: 200 Event
- History 단위 테스트 5계열 성공

## Candidate / PDF

cursor 4의 Header collapse 후보는 Viewer 173 objects, PDF 62,824 bytes였다. Undo 2회 cursor 2 후보는 Viewer 156 objects, PDF 62,758 bytes였으며 PDF hash도 달랐다. 두 출력 모두 MySuit 서버 HTTP 200이었다.

Source Patch와 Structure/Reflow serializer를 한 후보에 연속 적용하면 후속 parser가 결과를 읽지 못하는 기존 adapter 합성 제한이 확인됐다. 따라서 이 smoke는 active Structure cursor 차이만 PDF로 검증했다. Viewer History에서는 Source Patch를 포함한 full cycle이 통과했다.

## 회귀와 무결성

- MVP 5.8 Compound assertions: 7/7
- MVP 5.7 Direct Pointer assertions: 9/9
- MVP 5.6 Collapse UI/API: 성공
- MVP 4.4 Direct Editing: 성공
- Structure 5/5, Render 4/4, Change Set 2/2
- Reflow 4/4, Add/Remove 5/5, Structure Adapter 3/3
- 원본 form/info SHA-256 전후 동일
- `sample_mvp58_*` 후보 0개
- 기존 사용자 후보 보존

## 근거

- 로그: `mysuit-mvp-work/logs/mvp58-*.json`
- 화면: `mysuit-mvp-work/screenshots/mvp58-*.png`
- PDF: `mysuit-mvp-work/output/mvp58-history-*.pdf`
- 구현: `mysuit-mvp-work/mvp3-app/src/server/services/history-service.js`

## A 판정까지 남은 작업

Add/Remove Column/Row와 Bound Column을 runtime Structure Operation Store 및 direct UI에 연결하고 deterministic generated ID로 replay해야 한다. Source Patch + Structure + Vertical Reflow를 한 후보 UBJF에 합성하는 canonical serializer pipeline도 필요하다.

