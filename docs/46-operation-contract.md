# Operation Contract

## 강제 규칙

AI와 모든 Client는 다음 조건을 모두 만족할 때만 실행할 수 있다.

1. Operation Registry에 등록된 Operation
2. 정확히 resolve되는 Target identity
3. `capability.allowed === true`
4. `validation.valid === true`
5. 기본적으로 maturity `STABLE`; 명시적으로 허가된 경우에만 `LIMITED`
6. 실행 시 서버 재검증
7. History transaction 및 Candidate atomic apply 경유

## Stable 계약

| Target | Operation | Viewer | Source | PDF | 주요 조건 |
|---|---|---:|---:|---:|---|
| Object | updateText, setFontSize, setFontWeight, setTextAlign, resizeObject, hide/restoreObject | O | O | O | Source mapping과 property whitelist |
| Column | resizeColumn | O | O | O | page width ≤ 792 |
| Column | moveColumn | O | O | O | same group only |
| Column | hide/restoreColumn | O | O | O | 정확한 logical key |
| Row | resize/hide/restoreRow | O | O | O | Rendered Detail 제외 |
| Header Row | collapseRow | O | O | O | UDHB4114, verified cross-band flow |
| Table | hide/restoreTable | O | O | O | UBJF table visibility adapter 검증 |
| Table | collapseTable | O | O | O | verified BODY same-section reflow |

## Limited/POC/Unsupported

- `moveRenderObject`, `moveTable`, `resizeTableWidth`: `LIMITED`, Viewer-only이며 source/PDF 미지원
- `addStaticColumn`, `addBoundColumn`, `removeColumn`, `addStaticRow`, `removeStaticRow`: `POC_ONLY`, source adapter 검증은 존재하지만 runtime 실행 금지. Bound field는 `dataset_2.col_8`만 검증
- Rendered Detail Row 구조 편집: `UNSUPPORTED`
- Summary/Group Header collapse/remove: `UNSUPPORTED` (`SUMMARY_DEPENDENCY`/`ROWSPAN_DEPENDENCY`)
- 등록되지 않은 Operation: 항상 `UNSUPPORTED_OPERATION`

## Request

```json
{
  "draftId": "layout-id",
  "projectName": "sample",
  "formName": "sample",
  "targetType": "LOGICAL_COLUMN",
  "target": { "logicalColumnKey": "tbl:financial-7col|col:2" },
  "operation": "resizeColumn",
  "payload": { "width": 71 }
}
```

AI는 form.ubjf raw, SQL, Dataset, Cell ID, Store 파일에 직접 접근하지 않는다. 반드시 `/api/capabilities` → `/api/operations/validate` → `/api/operations/execute` 계약을 사용한다.
