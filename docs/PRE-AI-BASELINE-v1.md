# MySuit PRE-AI BASELINE v1

최종 판정: **A — AI Planner POC 착수 가능**

2026-08-11 현재 편집 엔진을 동결했다. 신규 기능 없이 Operation 계약, Capability/Validation 경계, Unified History, 후보 출력과 안전 rollback을 회귀 검증했다.

- Operation: 26개 (STABLE 18 / LIMITED 3 / POC_ONLY 5)
- AI v1 allowlist: STABLE 18개
- 회귀: core 31/31, policy/API 18/18, History/Adapter 24/24
- E2E: MVP 5.7 9/9, MVP 5.8 7/7, MVP 5.9 7/7
- Candidate Viewer 12 objects, 서버 PDF HTTP 200 / 41,485 bytes
- 원본 form/info SHA-256 동일
- 기존 `sample_mvp4_*` 사용자 후보 전체 tree hash 동일
- 테스트 후보 및 runtime draft cleanup 완료
- `AI_READY_FOR_PLANNER_POC=true`

알려진 제한은 Add/Remove runtime 미연결, 제한적 Bound Column, 혼합 canonical serializer 부분 지원, 일반 Cross-Band/rowSpan/Summary collapse 미검증, 단일 page 표본, Excel/HWP 미지원이다. 이 기능들은 AI allowlist에서 제외하거나 동적 validation으로 차단한다.

근거: [Capability Matrix](49-pre-ai-capability-matrix.md), [Safety Contract](50-pre-ai-safety-contract.md), [Runbook](51-pre-ai-runbook.md), [Feature Inventory](52-pre-ai-feature-inventory.md), [Architecture](53-pre-ai-architecture.md), `mysuit-mvp-work/logs/pre-ai-*.json`.

Git 저장소가 현재 경로에 없어 commit/tag는 생성하지 않았다. 따라서 코드·로그 기준선은 준비됐지만 Git baseline prepared 값은 false다.
