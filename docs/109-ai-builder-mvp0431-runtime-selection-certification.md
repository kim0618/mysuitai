# AI Builder MVP 0.4.3.1 — Runtime Selection Certification

AI Builder MVP 0.4.3.1 최종 판정: A

## A. Certification Scope

MVP 0.4.3의 유일한 gap이던 실제 UView5 Canvas runtime detail cell의 pointer selection 경로만 인증했다. 기존 `ai_builder_mvp043_certification_42291`은 읽기 원본으로 보존하고 `ai_builder_mvp0431_*` clone만 사용 후 정리했다.

## B. Browser Environment

Node 3100, Tomcat 9990, UView5/Builder HTTP 200, repository Chromium launch를 확인했다. 인증 종료 후 두 서버는 정지했다.

## C. Actual Canvas Click

PASS. Fabric object bounds, visible canvas bounds, canvas size, zoom 2, CSS scale 0.5, iframe offset으로 좌표 `(373, 639)`를 계산하고 Playwright `mouse.click`을 수행했다. 내부 selection API, postMessage, store mutation은 사용하지 않았다.

## D. Runtime Instance Identity

PASS. `상품B`는 `AICL00021_AIDB00002_ROW1`, row index 1, render key `p0|c0|src:AICL00021|band:AIDB00002|row:1|idx:23`으로 식별됐다. collision은 0이다.

## E. Source Template Resolution

PASS. runtime instance는 stable identity로 detail source cell `AICL00021`, band `AIDB00002`, logical column `tbl:dynamic:AITB00003:AITB00016|col:0`에 resolve됐다.

## F. Right Panel Selection

PASS. Right Panel은 source template 속성 중 글꼴, 정렬, 표시, 너비, 높이를 표시했다.

## G. Runtime Data Protection

PASS. runtime detail에서 일반 문구 입력은 disabled/hidden 상태이며 `{ai_items.item}`을 runtime 값으로 덮어쓸 수 없다.

## H. Template Edit

PASS. 실제 Right Panel의 너비 입력으로 `379 → 399`를 적용했다.

## I. Runtime Propagation

PASS. `상품A/상품B/상품C` 세 instance가 모두 width 399로 갱신됐다.

## J. Binding Preservation

PASS. parse-back 결과 `ai_items.item`을 유지했다.

## K. Source / Runtime Counts

Source detail template 1, runtime detail 3, identity collision 0이다.

## L. Undo / Redo

PASS. Undo는 세 instance를 모두 379로, Redo는 모두 399로 복구했다.

## M. Save / Reload

PASS. Unified Materializer save와 parse-back이 성공했고 reload에서 값 3개, width 399, binding을 유지했다.

## N. New Context

PASS. 새 Chromium Context에서 `상품A/상품B/상품C`, width 399, stable runtime IDs를 확인했다.

## O. Regression

- MVP 0.4.2 dynamic editor: 26/26 PASS
- Static editor: 8/8 PASS
- Foundation 0.2 history: 37/37 PASS
- Capability: 18/18 PASS

## P. PRE-AI

제품 코드가 수정되어 전체 baseline을 다시 실행했다. `PRE-AI BASELINE v1: PASS`.

## Q. Integrity

보호 대상 sample 및 SampleReport_FreeForm form/info SHA-256가 인증 전후 동일했다. 기존 인증 프로젝트와 사용자 자산은 보존했다.

## R. Import Core Freeze Decision

`importCoreFreezeReady = true`. MVP 0.4.3 결과와 이번 실제 pointer selection 인증을 결합해 Import Core를 Freeze한다.

## S. Remaining Limitations

이번 freeze 범위 내 제한 없음. Group, Aggregate, AI Chat/New, OCR/Vision, Office import, nested/multiple arrays, multi-page generalization, dynamic table move는 명시적 범위 밖이다.

## T. Screenshots

- `mysuit-mvp-work/screenshots/ai-builder-mvp0431-runtime-row-selected.png`
- `mysuit-mvp-work/screenshots/ai-builder-mvp0431-template-width-edited.png`
- `mysuit-mvp-work/screenshots/ai-builder-mvp0431-after-reload.png`

## U. Generated Documents

- `docs/109-ai-builder-mvp0431-runtime-selection-certification.md`
- `docs/110-ai-builder-import-core-freeze.md`

## V. Generated Logs

- `mysuit-mvp-work/logs/ai-builder-mvp0431-runtime-selection.json`
- `mysuit-mvp-work/logs/ai-builder-mvp0431-template-edit.json`
- `mysuit-mvp-work/logs/ai-builder-mvp0431-result.json`

## W. Cleanup

전용 clone과 materialized candidate는 검증 후 삭제했다. 기존 인증 프로젝트와 evidence는 보존했다.

## X. Server State

Node 3100과 Tomcat 9990은 종료 상태다.

## Final Questions

- Q1: YES
- Q2: YES
- Q3: YES
- Q4: YES
- Q5: YES
- Q6: YES
- Q7: YES — `importCoreFreezeReady = true`
