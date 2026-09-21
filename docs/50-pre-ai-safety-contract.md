# PRE-AI Safety Contract v1

AI는 제안자이며 실행 권한자가 아니다. 허용 흐름은 `resolve target → capability 조회 → validate → 사용자 preview/승인 → execute → history 기록 → candidate 출력` 순서다.

- `pre-ai-operation-allowlist.json`의 STABLE operation만 AI v1에서 제안할 수 있다.
- raw UBJF, 원본 `form.ubjf`, `info.xml`, 제품 JAR/JS, DB를 직접 수정하지 않는다.
- target을 추측하지 않는다. stale/ambiguous/missing identity는 차단한다.
- execute 시 서버가 capability와 validation을 다시 수행한다.
- 실패는 mutation과 History를 모두 남기지 않으며, 저장/재구성 실패는 원자 rollback한다.
- Undo/Redo는 cursor 기반 deterministic rebuild로 수행한다.
- 후보는 원본과 분리하고 경로 traversal, symlink, 원본 삭제를 차단한다.
- LIMITED·POC_ONLY·UNSUPPORTED는 명시적 별도 개발/승인 없이는 실행하지 않는다.

Canonical 오류 코드는 `UNKNOWN_OPERATION`, `TARGET_NOT_FOUND`, `TARGET_AMBIGUOUS`, `STALE_TARGET`, `SOURCE_MAPPING_REQUIRED`, `INVALID_PAYLOAD`, `TABLE_WIDTH_OVERFLOW`, `CROSS_GROUP_MOVE_NOT_ALLOWED`, `HIDDEN_COLUMN_OPERATION_NOT_ALLOWED`, `DATA_REPEAT_ROW`, `ROWSPAN_DEPENDENCY`, `SUMMARY_REFLOW_UNVERIFIED`, `CROSS_BAND_REFLOW_UNVERIFIED`, `PAGE_FOOTER_PROTECTION`, `LAST_COLUMN_REMOVE_NOT_ALLOWED`, `FORMULA_DEPENDENCY`, `BINDING_DEPENDENCY`, `BINDING_NOT_WHITELISTED`, `RUNTIME_CONNECTION_UNAVAILABLE`, `HISTORY_LIMIT_REACHED`, `HISTORY_REBUILD_FAILED`, `OPERATION_NOT_ALLOWED`다. 기존 Adapter의 `UNSUPPORTED_ROWSPAN_DEPENDENCY`, `VERTICAL_REFLOW_UNVERIFIED`, `DATA_ROW_STRUCTURE_EDIT_REJECTED`, `LAST_COLUMN_REMOVE_REJECTED`는 위 canonical 코드로 해석하는 legacy alias다.
