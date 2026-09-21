# PRE-AI Feature Inventory

- Object: inline text, font size/weight/alignment, resize, hide/restore는 source/PDF까지 STABLE. Render position move는 Viewer-only LIMITED.
- Column: select, reorder, resize, hide/restore, horizontal collapse는 STABLE. Add/remove/bound는 source POC이며 runtime 연결 전까지 POC_ONLY.
- Row: gutter selection, fixed/static resize·hide·restore, 검증된 Header collapse는 STABLE. Detail row 구조 편집은 차단. Add/remove static row는 POC_ONLY.
- Table: selection, hide/restore, 검증된 output collapse는 STABLE. move와 outer width resize는 Viewer-only LIMITED.
- History: Source/Render/Structure 통합 timeline, undo/redo, branch clear, reload replay, failure rollback 검증.
- Output: 후보 UBJF, 자체 Viewer, 서버 PDF, atomic apply/rollback 검증. 단일 page sample 기준이며 Excel/HWP는 미지원.
- Safety: Registry, Resolver, Capability, Validation, server revalidation과 표준 오류 계약이 구현됨.
