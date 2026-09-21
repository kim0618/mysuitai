# MVP 5.9 구현 및 검증 결과

## 판정

최종 판정은 **B**다.

Target resolve, Registry, Capability/Validation API, 표준 오류, 기존 Direct UX의 서버 재검증, History 안전성, UI enabled/disabled와 reason, width/group/detail/rowSpan/reflow guard는 구현·검증됐다. 다만 MVP 5.8에서 남은 Add/Remove runtime Store/UI 연결과 Source Patch + Structure/Reflow canonical serializer가 이번 단계 목표상 그대로 제한이므로 A 조건 전부에는 도달하지 않았다.

## 구현

- 26개 canonical Operation Registry
- `GET /api/operation-registry`
- `GET /api/capabilities`
- `POST /api/operations/validate`
- `POST /api/operations/execute`
- Object/Column/Row/Table Target Resolver
- Capability UI panel, disabled reason, JSON debug view
- 기존 Source/Render/Structure 실행 경로의 공통 서버 재검증
- 검증 실패 시 Store/History 무변경

## 검증 결과

- Capability/Validation Viewer E2E: **7/7 통과**
- API 통합: **4/4 통과**
- Registry/Capability/Validator/Artifact 단위: 통과
- History/Structure/Adapter/Reflow 단위 회귀: **9 파일 통과**
- MVP 5.8 History 회귀: Timeline 9개, full Undo/Redo, reload/new context, branch, 강제 rollback 모두 통과
- MVP 5.7 Direct UX 회귀: **9/9 통과**
- Source/Viewer/PDF smoke: 후보 Viewer 173/156 objects, PDF 62,824/62,758 bytes, HTTP 200
- 평균 계산 시간: Capability 0.420ms, Validation 0.858ms (각 100회, 최종 실행)
- 원본 `form.ubjf`/`info.xml` SHA-256 유지
- `sample_mvp59_*` 후보 0개, 테스트 Draft/History cleanup 완료

## 핵심 사례

- Column width 73 요청: 총 793 > 최대 792, `TABLE_WIDTH_OVERFLOW`
- 미등록 `deleteEverything`: `UNSUPPORTED_OPERATION`
- 다른 group 이동: `GROUP_BOUNDARY_MOVE_NOT_ALLOWED`
- Rendered Detail Row: `DATA_REPEAT_ROW`
- Group Header collapse: `ROWSPAN_DEPENDENCY`
- Summary collapse: `SUMMARY_DEPENDENCY`
- stale key: `TARGET_NOT_FOUND`; label-only: `AMBIGUOUS_TARGET`
- Add/Remove/Bound runtime 실행: `RUNTIME_UI_NOT_CONNECTED`

## 근거

- `mysuit-mvp-work/logs/mvp59-capability-e2e.json`
- `mysuit-mvp-work/logs/mvp59-capability-snapshot.json`
- `mysuit-mvp-work/logs/mvp59-capability-matrix.json`
- `mysuit-mvp-work/logs/mvp59-operation-registry.json`
- `mysuit-mvp-work/logs/mvp59-validation-error-catalog.json`
- `mysuit-mvp-work/logs/mvp59-performance.json`
- `mysuit-mvp-work/screenshots/mvp59-column-capability.png`
- `mysuit-mvp-work/screenshots/mvp59-detail-row-blocked.png`

기존 사용자 후보는 삭제하지 않았다. “MVP4 후보 0개” 가정은 PRE-AI BASELINE v1에서 테스트 전후 목록/트리 해시 동일성 검증으로 교정했고 전체 core 31/31이 통과했다.
