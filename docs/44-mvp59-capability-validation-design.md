# MVP 5.9 Capability / Validation 설계

## 목적

MVP 4.4~5.8에 분산돼 있던 편집 가능 여부와 안전 검증을 하나의 서버 정책 계층으로 통합한다. UI, Direct UX, 향후 AI는 동일한 Operation Registry와 Validation 결과를 사용하며, 실행 시 서버가 다시 검증한다.

## 실행 흐름

`Operation Registry → Target Resolver → Capability Service → Payload/Dynamic Validator → History Limit → 기존 Store/Adapter → History`

- Registry 밖 Operation은 `UNSUPPORTED_OPERATION`으로 차단한다.
- Target은 정확한 Viewer/Render/Logical key만 허용한다. 라벨 추측은 금지한다.
- Capability는 작업 계열의 가능 여부와 reason/constraints/maturity/support를 반환한다.
- Validation은 요청 payload와 현재 Draft 상태를 검사한다.
- 기존 `/api/change-sets`, `/api/render-patches`, `/api/structure-operations`도 서버 validator를 통과한다.
- `/api/operations/execute`는 검증과 저장/History를 한 wrapper에서 실행한다.

## Target Type

- `OBJECT`: 정확한 Viewer Object ID, 선택적으로 Render Instance Key
- `LOGICAL_COLUMN`: `tbl:financial-7col|col:N`
- `LOGICAL_ROW`: 정확한 band/rendered-row key, role은 HEADER/GROUP_HEADER/RENDERED_DETAIL/SUMMARY
- `COMPOSITE_TABLE`: `ctbl:main-report-table`

## 재사용한 검증 근거

- Page Width: `structure-operation-service.guardWidth`와 UBJF page geometry
- Vertical Reflow/rowSpan: `vertical-reflow-service.capabilities`
- Source mapping: 기존 `changeset-service.sourceObject`
- Render identity: Render Instance Key의 source component와 Source mapping 대조
- Binding: 검증된 `dataset_2.col_8` whitelist, 임의 Dataset/SQL 금지
- History: `history-service.LIMIT` 및 transaction rollback

## 상태와 캐시

Capability는 현재 Structure Operation Store를 매번 읽어 계산한다. 숨긴 Column처럼 Draft 상태에 따라 결과가 바뀌므로 MVP 5.9에서는 캐시하지 않는다. History/operation 변경 후 UI가 capability를 재조회한다.

## 안전 경계

원본 UBJF 직접 쓰기, SQL/Dataset 생성, 임의 ID 생성, validation/history/candidate atomic apply 우회는 Operation Layer 밖이며 금지한다. 혼합 Source Patch + Structure/Reflow canonical serializer는 아직 부분 지원이다.
