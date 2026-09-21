# MySuit Viewer MVP 최종 보고서

## 현재 최종 판정

**PRE-AI BASELINE v1: A. 편집 엔진 안전 기준선 동결, AI Planner POC 착수 가능**

Render Instance Key와 원본 fingerprint를 도입해 중복 Viewer ID 객체를 독립적으로 선택·저장·재적용·초기화한다. 최신 UI의 드래그, 새로고침, 화면 점프 방지, 모드 ON/OFF, 키보드, 저장 실패 rollback이 실제 E2E로 통과했다. MVP 4.2의 서버 PDF 직접 미반영 판정 C는 별도 출력 한계로 유지된다.

## 판정 이력

| 단계 | 판정 | 핵심 결과 |
|---|---|---|
| MVP 1 정적 분석 | D | 당시 실행 환경 미확인 |
| MVP 1 런타임 객체 변경 | B | Fabric 객체 변경·복구 성공 |
| MVP 2 후보 원본 Patch/재렌더 | B | source Patch 루프 성공, 공식 파서 한계 |
| MVP 3 검수 편집 UI/API | A | 단일 검증 Label의 UI→후보→폐기 내부 시연 성공 |
| MVP 4 다중 Patch | **B** | 다중 객체/속성 원자 적용 성공, X/Y 위치 매핑 미완료 |
| MVP 4.1 Render Position Patch | **A** | 렌더 객체 드래그·저장·새로고침/새 Context 유지·원복 성공 |
| MVP 4.2 Output Render Patch | **C** | Viewer 반영 유지, 서버 PDF에는 직접 미반영; 안전한 후보 폼 출력 어댑터 필요 |
| MVP 4.1.1 최신 UI 안정화 | **A** | Render Instance Key, 드래그·재적용·모드·키보드·rollback·중복 객체 독립성 성공 |
| MVP 4.4 Viewer Direct Editing | **B** | Inline/toolbar/resize/context menu와 Patch 동기화 성공, 실제 포인터 resize 자동화 제한 |
| MVP 5.0 Table Structure Discovery | **B** | 명시적 Table/Cell과 7열 Column·24개 Row 그룹 안정, composite parent ID 부재 |
| MVP 5.1 Logical Column Direct Editing | **B** | 24-member resize/reflow/hide/restore/replay 성공, composite span/reorder 제한 |
| MVP 5.2 Column Reorder + Row Editing | **B** | 24-member binding 유지 reorder와 fixed row resize/hide/replay 성공, semantic Row reorder 제한 |
| MVP 5.3 Composite Table Editing | **B** | 168-member 표 선택/drag/비율 너비/editor collapse/hide/replay 성공, below-object reflow 제한 |
| MVP 5.4 UBJF Structure Adapter | **A** | 핵심 Column resize/hide/reorder를 후보 source와 서버 PDF에 반영, binding 유지; Row/Table collapse 제한 |
| MVP 5.5 Add/Remove Structure | **A** | Static Column/Row 추가·삭제와 제한적 Bound Column을 후보 source/Viewer/PDF에 반영, 폭 초과 저장 차단 |
| MVP 5.6 Vertical Reflow | **A** | Header Row 33px와 Composite BODY 654px source collapse 성공, Footer 보호; 일반 Cross-Band 제한 |
| MVP 5.7 Direct Manipulation UX | **A** | Column/Row/Table 실제 pointer 조작, 단일 저장, rollback/replay, source/PDF smoke 성공 |
| MVP 5.8 Unified History | **B** | Source/Render/Structure 통합 Timeline, full Undo/Redo, branch/persistence/transaction 성공; Add/Remove runtime 연결 제한 |
| MVP 5.9 Capability / Validation | **B** | Registry/Target/Capability/Validation/API/UI/서버 재검증 성공; Add/Remove runtime 및 혼합 canonical serializer 제한 |
| PRE-AI BASELINE v1 | **A** | STABLE 18개 allowlist, 전체 회귀·무결성·cleanup 통과; 알려진 제한은 차단/격리 |

## PRE-AI BASELINE v1 최종 실측

- Canonical Operation 26개: STABLE 18 / LIMITED 3 / POC_ONLY 5
- AI v1 allowlist 18개, unsupported 개념 operation 14개 명시
- core 31/31, policy/API 18/18, History/Adapter 24/24 통과
- MVP 5.7 9/9, MVP 5.8 7/7, MVP 5.9 7/7 통과
- 후보 Viewer 12 objects, 서버 PDF 41,485 bytes / HTTP 200
- 원본 form/info와 기존 사용자 후보 tree hash 전후 동일
- 테스트 후보/runtime draft cleanup, 서버 종료 완료
- Git 저장소가 없어 commit/tag는 미생성
- `AI_READY_FOR_PLANNER_POC=true`
- 상세: [PRE-AI BASELINE v1](PRE-AI-BASELINE-v1.md)

## MVP 5.9 최종 실측

- Canonical Operation 26개와 Object/Logical Column/Logical Row/Composite Table Target resolver 구현
- Capability/Validation Viewer E2E 7/7, API 통합 4/4 통과
- Page Width, Group Boundary, Detail Row, rowSpan, Summary/Reflow, exact identity, Source mapping, History limit 정책 통합
- UI Capability panel: allowed/blocked, reason, maturity, Viewer/Source/PDF support, debug JSON 표시
- 기존 Direct UX도 서버에서 재검증하며 실패 시 Operation/History 0건
- MVP 5.8 History 회귀 전체 통과, MVP 5.7 Direct UX 회귀 9/9 통과
- 후보 Viewer/서버 PDF smoke 통과(173/156 objects, 62,824/62,758 bytes)
- 평균 Capability 0.420ms, Validation 0.858ms(각 100회, 최종 실행)
- 원본 form/info hash 동일, `sample_mvp59_*` 0개
- 판정 B: Add/Remove runtime Store/UI와 Source+Structure/Reflow canonical serializer가 아직 부분 지원
- 상세: [설계](44-mvp59-capability-validation-design.md), [결과](45-mvp59-capability-validation-result.md), [Operation Contract](46-operation-contract.md), [Validation Catalog](47-validation-error-catalog.md), [AI Readiness](48-ai-readiness.md)

## MVP 5.8 최종 실측

- 혼합 Timeline 9개: Text, Render Position, Column hide/resize/reorder, Row collapse, Table move/resize
- 9회 Undo → cursor 0, Base semantic signature 동일
- 9회 Redo → Final semantic signature 동일
- Reload 및 새 Browser Context에서 cursor/Timeline/Viewer 동일
- Redo branch clear 및 강제 rebuild 실패 시 cursor/Store 유지
- Toolbar Undo, Ctrl+Y Redo, 입력 필드 native Ctrl+Z 우선 성공
- Undo 평균 10.08ms, Redo 평균 15.22ms
- cursor별 후보 Viewer/PDF: 173 objects/62,824 bytes 대 156 objects/62,758 bytes
- 원본 form/info hash 동일, `sample_mvp58_*` cleanup
- Add/Remove runtime identity와 Source+Structure 복합 후보 serializer는 제한
- 상세: [MVP 5.8 설계](42-mvp58-history-design.md), [MVP 5.8 결과](43-mvp58-history-result.md)

## MVP 5.7 최종 실측

- Column reorder: `0,1,2,3,4,5,6 → 0,2,1,3,4,5,6`, 저장 1회, reload 유지
- Column resize: `70→100`, 폭 초과는 total width 792에서 clamp
- Summary Row: `27→39`; Detail Row 구조 편집은 capability로 차단
- Composite Table: `(2,300)→(32,280)`, width `792→772`
- 강제 HTTP 500 저장 실패: width `138→138` rollback
- canvas/screen 좌표 roundtrip 3건 오차 0
- 후보 Viewer 12 objects, 서버 PDF 41,485 bytes, HTTP 200
- MVP 5.7 assertion 9/9 및 MVP 4.4/MVP 5.6 UI 회귀 성공
- 원본 form/info hash 동일, `sample_mvp57_*` cleanup, 기존 후보 보존
- 상세: [MVP 5.7 설계](40-mvp57-direct-manipulation-design.md), [MVP 5.7 결과](41-mvp57-direct-manipulation-result.md)

## MVP 5.6 최종 실측

- Header Row collapse: Header 제거, Group Header `top 333→300`, 이후 BODY 전체 `-33`
- Composite Table collapse: 168개 본문 객체 제거, Viewer `180→12`
- BODY source flow: Header 33 + Group 81 + Detail 459 + Summary 81 = 654px 제거
- Page Footer: source/runtime top 1086 유지, Page Header/Footer 일반 reflow 대상 제외
- Pagination: original/row/table 모두 1페이지, 객체 중복 없음
- 서버 PDF: original 64,536 / row 62,824 / table 41,485 bytes, 모두 HTTP 200
- Restore: Viewer 180개와 Group Header top 333 정확히 복구
- Approval rowSpan=2: `UNSUPPORTED_ROWSPAN_DEPENDENCY`
- Summary/일반 Cross-Band: `VERTICAL_REFLOW_UNVERIFIED`
- 실제 Viewer/PDF assertion 8/8, UI/API E2E 및 MVP 4.4 회귀 성공
- 원본 form/info hash 동일, `sample_mvp56_*` cleanup, 기존 후보 보존
- 상세: [MVP 5.6 결과](38-mvp56-vertical-reflow-result.md), [안전 정책](39-mvp56-collapse-safety-policy.md)

## MVP 5.5 최종 실측

- Page: width 794, Table x 2, 최대 Table width 792
- 원본 Table: width 790, 남은 폭 2
- Static Column 추가: Column 0 `370→340` + 신규 `비고` width 30, 네 Table `7→8 columns`, Viewer `180→204`
- Column 제거: index 6 실제 제거, 네 Table `7→6 columns`, width `790→720`, Viewer `180→156`
- Static Row 추가: Header `1→2 rows`, height `33→53`, 신규 Cell ID 7개, 기존 Header와 별도 Y 출력
- Static Row 제거: 추가 행 제거 후 `1 row`, height 33, Viewer 180 복원
- Bound Column: 기존 `dataset_2.col_8`만 제한 복제, 신규 field/SQL 없음
- 폭 초과 API: 793 요청을 HTTP 409 `TABLE_WIDTH_OVERFLOW`로 차단 (`current=790`, `max=792`)
- 서버 PDF: original/add/remove Column/add/remove Row/bound Column 6종 모두 HTTP 200
- Adapter/operation 단위 검증: 10/10 성공
- 실제 Viewer/PDF assertion: 7/7 성공
- 원본 form/info hash: 전후 동일
- 테스트 `sample_mvp55_*`: 전부 cleanup, 기존 후보 보존
- 상세: [MVP 5.5 결과](35-mvp55-add-remove-structure-result.md), [폭 정책](36-mvp55-page-width-policy.md)

## MVP 4.1 최종 실측

- 대상: `LB6417_UPHB2584_ROW0`
- 드래그: `(367, 100) → (397, 80)`
- 새로고침/새 Context: `(397, 80)` 유지
- Shift+ArrowRight: `(367, 100) → (377, 100)`
- 개별 및 전체 초기화 후: `(367, 100)` 유지
- 객체 수: 전 과정 180개
- Patch 저장: 184 ms
- 새로고침 적용: 1,612 ms
- 최종 Render Position Patch: 0건
- form/info/UView5 제품 트리 해시: 전후 동일
- 상세: [MVP 4.1 결과](13-mvp41-render-position-result.md)

MVP 3 A 이력은 보존된다. 현재 B는 기능 퇴행이 아니라 MVP 4가 새로 요구한 위치 속성까지 포함한 더 넓은 판정 기준 때문이다.

## MVP 4 최종 실측

- Change Set Patch: 4건, 객체 2개
- 제목: text `  연도별 실적보고서` → `  2026년 연도별 실적보고서`
- 제목 fontSize: 32 → 30
- 제목 width: 425 → 440
- 정적 Cell `2013`: visible true → false
- 후보 객체: 179개(숨김 객체 제외)
- 원본 객체: 180개
- 후보 API 생성: 81 ms
- 후보 Viewer 렌더 준비: 906 ms
- 전체 E2E: 7,334 ms
- 후보 폐기: 성공
- 활성 MVP 4 후보: 0개
- form SHA before/after: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` / 동일
- info SHA before/after: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` / 동일

## 안전성

- 후보 form은 메모리에서 전체 Patch 적용 후 한 번만 저장
- 한 Patch 실패 시 후보 전체 제거, 부분 ACTIVE 차단
- 객체/source/band 및 속성 whitelist와 before 값 검증
- 데이터식 Cell text와 미검증 Cell 좌표 차단
- X/Y는 실제 서버 렌더 불일치를 확인한 뒤 지원 목록에서 제거
- 원본 form/info 해시 검증
- 서버 생성 후보명과 경로/symlink/원본 삭제 차단
- 상태 원자 저장, 동일 원본 잠금, JSONL 감사
- 제품 JAR/JavaScript/라이선스/DB 변경 없음

## 문서와 근거

- [MVP 4 설계](10-mvp4-design.md)
- [MVP 4 구현 결과](11-mvp4-implementation-result.md)
- [MVP 3 구현 결과](09-mvp3-implementation-result.md)
- 앱: `mysuit-mvp-work/mvp3-app/`
- E2E: `mysuit-mvp-work/logs/mvp4-e2e-result.json`
- 무결성: `mysuit-mvp-work/logs/mvp4-integrity-result.json`
- 성능: `mysuit-mvp-work/logs/mvp4-performance.json`
- 화면: `mysuit-mvp-work/screenshots/mvp4-*.png`

## 다음 우선순위

다음 우선순위는 MVP 5.5 Add/Remove source POC를 operation store와 직접 조작 context menu에 연결하고, 다중 페이지·일반 Cross-Band 표본에서 reflow 안전성을 확장 검증하는 것이다.
# MVP 4.2 업데이트 — PDF/서버 출력

최종 판정은 **C**다. Viewer에서 적용된 Render Position Patch는 MySuit `savePDF` 요청에 Fabric JSON, `left/top` 또는 Patch로 전달되지 않는다. 실제 서버 PDF는 정상 생성됐지만 원본 폼을 별도 렌더링하므로 이동 위치는 반영되지 않았다. 현재 Canvas의 브라우저 PDF 출력은 가능하지만 서버 PDF와 구분했다.

상세 분석은 `docs/14-mvp42-output-pipeline-analysis.md`, 결과와 안전한 후보 폼 출력 설계는 `docs/15-mvp42-output-patch-result.md`에 기록했다.
