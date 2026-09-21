# MySuit Viewer 검수 편집 MVP

MVP 1~5.9와 PRE-AI BASELINE v1의 코드, 검증 로그와 문서는 이 WSL 프로젝트 안에만 보관한다.

현재 상태는 [최종 보고서](docs/FINAL-REPORT.md)를 기준으로 한다. MVP 4.2에서 Viewer Render Position Patch는 Fabric 화면과 브라우저 출력에는 반영되지만, MySuit 서버 PDF에는 직접 반영되지 않는 것으로 확인했다.

- [출력 파이프라인 분석](docs/14-mvp42-output-pipeline-analysis.md)
- [MVP 4.2 결과](docs/15-mvp42-output-patch-result.md)
- [MVP 4.1.1 안정화 설계](docs/16-mvp411-position-stability-design.md)
- [MVP 4.1.1 안정화 결과](docs/17-mvp411-position-stability-result.md)
- [MVP 5.4 UBJF Structure Adapter 결과](docs/32-mvp54-ubjf-structure-adapter-result.md)
- [MVP 5.5 Add/Remove Structure 설계](docs/34-mvp55-add-remove-structure-design.md)
- [MVP 5.5 Add/Remove Structure 결과](docs/35-mvp55-add-remove-structure-result.md)
- [MVP 5.5 Page Width Policy](docs/36-mvp55-page-width-policy.md)
- [MVP 5.6 Vertical Reflow 설계](docs/37-mvp56-vertical-reflow-design.md)
- [MVP 5.6 Vertical Reflow 결과](docs/38-mvp56-vertical-reflow-result.md)
- [MVP 5.6 Collapse Safety Policy](docs/39-mvp56-collapse-safety-policy.md)
- [MVP 5.7 Direct Manipulation 설계](docs/40-mvp57-direct-manipulation-design.md)
- [MVP 5.7 Direct Manipulation 결과](docs/41-mvp57-direct-manipulation-result.md)
- [MVP 5.8 Unified History 설계](docs/42-mvp58-history-design.md)
- [MVP 5.8 Unified History 결과](docs/43-mvp58-history-result.md)
- [MVP 5.9 Capability / Validation 설계](docs/44-mvp59-capability-validation-design.md)
- [MVP 5.9 Capability / Validation 결과](docs/45-mvp59-capability-validation-result.md)
- [Operation Contract](docs/46-operation-contract.md)
- [Validation Error Catalog](docs/47-validation-error-catalog.md)
- [AI Readiness](docs/48-ai-readiness.md)
- [PRE-AI BASELINE v1](docs/PRE-AI-BASELINE-v1.md)
- [PRE-AI Capability Matrix](docs/49-pre-ai-capability-matrix.md)
- [PRE-AI Safety Contract](docs/50-pre-ai-safety-contract.md)
- [PRE-AI Runbook](docs/51-pre-ai-runbook.md)
- [PRE-AI Feature Inventory](docs/52-pre-ai-feature-inventory.md)
- [PRE-AI Architecture](docs/53-pre-ai-architecture.md)

현재 동결 판정은 **PRE-AI BASELINE v1: A**, `AI_READY_FOR_PLANNER_POC=true`다. AI v1은 26개 Registry 중 STABLE 18개만 제안할 수 있으며 Capability → Validation → 사용자 승인 → Execute 계약을 우회할 수 없다. 전체 기준선은 `cd mysuit-mvp-work/mvp3-app && npm run test:pre-ai`로 재현한다.

MVP 5.9는 26개 canonical Operation Registry, Target Resolver, Capability/Validation API, 서버 재검증과 UI 차단 사유를 제공한다. 향후 AI는 raw UBJF가 아니라 `/api/capabilities`, `/api/operations/validate`, `/api/operations/execute` 계약만 사용해야 한다. 최종 판정은 B이며 Add/Remove runtime 연결과 Source+Structure/Reflow 혼합 canonical serializer가 남아 있다.

MVP 5.8은 상단 Undo/Redo와 우측 History panel을 제공한다. Source Patch, Render Position, Structure Operation은 사용자 수행 순서대로 하나의 cursor에 기록되며 Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y를 지원한다. 현재 판정은 B이며 MVP 5.5 Add/Remove source POC의 runtime History 연결과 복합 serializer pipeline이 남아 있다.

MVP 5.7에서는 검수 모드를 켠 뒤 Viewer 위에 표시되는 orange Column grip/경계, green·gray Row gutter, purple Table grip/외곽 경계를 직접 끌어 기존 Structure Operation을 저장한다. pointermove 중에는 화면만 미리보기하고 pointerup에서 한 번 저장하며, 실패 시 저장 상태로 rollback한다.
