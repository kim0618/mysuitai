# MySuit Import Readiness Audit

감사일: 2026-08-27  
대상: `/home/tjd618/mysuit-ai-viewer`  
기준: 현재 파일과 런타임 코드의 정적 분석. 기존 서버, 사용자 후보, Store, 로그 및 원본은 변경하지 않았다.

# 1. Executive Summary

**최종 판정: PARTIALLY_READY.** 현재 시스템은 `sample/sample`의 기존 `form.ubjf`를 안전하게 복제하고 제한된 객체 속성·표 구조를 수정하여 Viewer/PDF 후보로 materialize하는 엔진이다. 외부 문서에서 임의의 신규 Form을 0부터 생성하는 엔진은 아니다. Import MVP는 **검증된 빈/정적 template clone**을 출발점으로 삼고, 별도의 DIM 및 template-aware UBJF generator를 추가하는 방식이 가장 안전하다.

핵심 사실은 다음과 같다.

- 실제 실행 앱은 `mysuit-mvp-work/mvp3-app`의 Node HTTP 서버와 정적 Client이며, MySuit UView5/Tomcat을 iframe/proxy로 사용한다.
- 현재 Registry는 문서의 26개가 아니라 **27개**다. `STABLE 18`, `LIMITED 4`, `POC_ONLY 5`, Registry 내 `UNSUPPORTED 0`이다. PRE-AI baseline의 26개/`LIMITED 3`은 `moveRenderedRow` 추가 전 snapshot으로 보이며 현재 코드와 불일치한다.
- AI v1 allowlist는 `mysuit-mvp-work/logs/pre-ai-operation-allowlist.json`의 **정적 산출물**이다. 런타임 AI/Planner가 이 파일을 읽는 코드는 없다. 다만 그 18개는 현재 Registry의 STABLE 18개와 일치한다.
- UBJF codec은 전체 JSON tree를 읽고 다시 쓸 수 있지만, 의미론적 parser/validator는 sample의 특정 `UBLabel`, `Cell`, 4개 본문 `UBTable`, 고정 band/ID에 집중한다.
- 신규 Cell은 기존 Cell clone으로만 만들며, 신규 UBLabel/UBTable/UBImage/Line/Rectangle/Band/Page를 생성하는 일반 helper나 schema는 없다.
- `sample`에는 `UBImage` 1개가 있고 URL-encoded PNG base64 문자열을 `data`에 내장하지만, Image writer/resource pipeline 증거는 없다. Line/Rectangle 샘플과 생성 코드도 없다.
- Candidate isolation, UView5 launcher/proxy, source patch codec, history snapshot/transaction, capability/validation 골격과 Server PDF 호출 경로는 재사용 가치가 높지만 모두 `sample/sample` 또는 고정 logical model 가정을 일반화해야 Imported Form에 적용할 수 있다.

# 2. Current Architecture

## 2.1 저장소와 실행 경계

- 최상위: `README.md`, `docs/`, `mysuit-mvp-work/`, 내장 Tomcat `apache-tomcat-8.5.78/`.
- 실제 앱: `mysuit-mvp-work/mvp3-app/`.
- Client entry: `src/client/index.html`; 주 orchestration은 `src/client/app.js`.
- Server entry: `src/server/index.js`; Node 기본 `http` 서버로 Client 정적 파일, `/api/*`, `/mysuit/*` proxy를 제공한다.
- MySuit projects root: `apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project`.
- runtime scope는 여러 서비스에서 `projectName=sample`, `formName=sample`로 하드코딩/whitelist돼 있다.

## 2.2 Server routes와 서비스

| API | Route/Service | 역할 |
|---|---|---|
| `/api/change-sets`, `/api/source-object` | `routes/changeset-routes.js`, `services/changeset-service.js` | Source patch draft, 객체 source mapping, multi-patch candidate |
| `/api/render-patches` | `routes/render-patch-routes.js`, `services/render-patch-service.js` | Render-instance 위치 patch 저장/replay |
| `/api/structure-operations` | `routes/structure-operation-routes.js`, `services/structure-operation-service.js` | Column/Row/Table 구조 operation Store |
| `/api/history` | `routes/history-routes.js`, `services/history-service.js` | 통합 undo/redo 및 Store snapshot |
| `/api/capabilities`, `/api/operation-registry` | `routes/capability-routes.js`, `services/capability-service.js` | target별 capability와 Registry 제공 |
| `/api/operations` | `routes/operation-validation-routes.js`, `services/operation-validator.js` | canonical request validation/execution 진입점 |
| `/api/candidates` | `routes/candidate-routes.js`, `services/candidate-service.js` | legacy 단일 text candidate 관리 |
| `/mysuit/*` | `src/server/index.js` | Tomcat 9990 `/MYSUIT/*` proxy |

UBJF 관련 핵심 파일은 `form-patch-service.js`, `ubjf-structure-adapter.js`, `ubjf-add-remove-adapter.js`, `vertical-reflow-service.js`다. Candidate 복제/격리는 `project-copy-service.js`, 무결성은 `integrity-service.js`가 담당한다.

## 2.3 Client와 Viewer 데이터 흐름

```text
Editor (app.js + controllers)
  -> iframe /mysuit/UView5/index.jsp?projectName=...&formName=...
  -> Node reverse proxy
  -> MySuit UView5 on Tomcat
  -> iframe.contentWindow.canvasModule.getCanvas(0)
  -> Fabric canvas.getObjects()
  -> Viewer objects / selection / preview
```

- 원본 URL은 `app.js`의 `/mysuit/UView5/index.jsp?projectName=sample&formName=sample` 상수다. 후보 URL은 Candidate service가 같은 query 형태로 만든다.
- `viewer-inspector.js`가 iframe의 Fabric canvas에 직접 접근하고 `mouse:down`, `selection:*`을 hook한다.
- Viewer ID는 `SOURCEID_BANDID_ROWn` 패턴을 `viewer-id-parser.js`로 해석한다.
- Render Instance Key는 `viewer-inspector.js`에서 `p{page}|c{canvas}|src:{sourceId}|band:{bandId}|row:{row}|idx:{renderIndex}`로 생성한다. duplicate Viewer ID를 `renderIndex`와 original fingerprint로 구분한다.
- preview/replay는 Source Patch를 Fabric object property에 적용하거나, Render Patch의 `renderIndex`, ID, class, fingerprint를 검사한 뒤 `left/top`을 적용한다. 각 controller는 `canvas.renderAll()`을 호출한다.
- iframe reload 후 `app.js`가 canvas와 예상 object count(현재 180)를 기다린 뒤 inspector/controller를 재부착하고 Render Patch를 replay한다. 이는 임의 Imported Form에서 그대로 성립하지 않는 sample 고정 조건이다.

# 3. Implemented Features

실제 runtime에 연결된 기능은 다음과 같다.

- 객체 선택과 UBLabel/Cell source mapping; text, fontSize, fontWeight, textAlign, width, height, visible의 source patch.
- Render instance의 viewer-only left/top 이동과 reload replay.
- 고정 7열 본문 표의 Column resize/move/hide, 고정/논리 Row resize/hide, Header collapse, Composite Table move/resize/hide/collapse.
- Direct manipulation overlay, pointer drag/resize, object/column/row/table selection controller.
- Change Set과 Candidate 복제/materialization, 원본 hash 보존, 후보 삭제 안전 규칙.
- Unified History UI와 Ctrl/Cmd-Z, Ctrl/Cmd-Y; Store snapshot 기반 undo/redo.
- Capability UI의 버튼 enabled/disabled와 Server validation.
- Add/Remove Column/Row와 Bound Column은 adapter/test/PDF POC가 있으나 일반 runtime UI/Store operation으로 연결되지 않았다.

`restoreColumn`, `restoreRow`, `restoreTable`은 canonical Registry에 있지만 Structure Store는 별도 restore operation을 저장하지 않고 기존 hide operation 삭제를 복원으로 사용한다. 따라서 Registry 명칭과 persistence 동작이 일대일 operation record는 아니다.

# 4. Canonical Operations

Registry에는 별도 `historySupport`나 validation rule 배열 필드가 없다. 아래 History는 validated mutation이 `history.transact`를 통과할 수 있는가를 기준으로 표시했고, Validation은 `requiredPayload` 및 `operation-validator.js`의 추가 guard를 요약했다.

| # | Operation | Target | Maturity | V/S/PDF | History | Validation/제약 |
|---:|---|---|---|---|---|---|
| 1 | updateText | OBJECT | STABLE | Y/Y/Y | Y | value string, source mapping |
| 2 | setFontSize | OBJECT | STABLE | Y/Y/Y | Y | value 6–96, source mapping |
| 3 | setFontWeight | OBJECT | STABLE | Y/Y/Y | Y | normal/bold |
| 4 | setTextAlign | OBJECT | STABLE | Y/Y/Y | Y | left/center/right |
| 5 | resizeObject | OBJECT | STABLE | Y/Y/Y | Y | width/height, 1–3000 |
| 6 | hideObject | OBJECT | STABLE | Y/Y/Y | Y | visible source property |
| 7 | restoreObject | OBJECT | STABLE | Y/Y/Y | Y | visible source property |
| 8 | moveRenderObject | OBJECT | LIMITED | Y/N/N | Y | exact Render Instance Key, after.left/top |
| 9 | resizeColumn | LOGICAL_COLUMN | STABLE | Y/Y/Y | Y | 20–600, hidden guard, page-width guard |
| 10 | moveColumn | LOGICAL_COLUMN | STABLE | Y/Y/Y | Y | visual index 0–6, same group |
| 11 | hideColumn | LOGICAL_COLUMN | STABLE | Y/Y/Y | Y | exact logical identity |
| 12 | restoreColumn | LOGICAL_COLUMN | STABLE | Y/Y/Y | Y* | runtime은 hide record 삭제 방식 |
| 13 | addStaticColumn | LOGICAL_COLUMN | POC_ONLY | Y/Y/Y | 계약상 가능 | capability가 UI 미연결로 차단 |
| 14 | addBoundColumn | LOGICAL_COLUMN | POC_ONLY | Y/Y/Y | 계약상 가능 | dataset_2.col_8만, UI 미연결 |
| 15 | removeColumn | LOGICAL_COLUMN | POC_ONLY | Y/Y/Y | 계약상 가능 | UI/Store 미연결, adapter 자체 guard |
| 16 | resizeRow | LOGICAL_ROW | STABLE | Y/Y/Y | Y | 12–200, repeat row 차단 |
| 17 | hideRow | LOGICAL_ROW | STABLE | Y/Y/Y | Y | repeat row 차단 |
| 18 | restoreRow | LOGICAL_ROW | STABLE | Y/Y/Y | Y* | runtime은 hide record 삭제 방식 |
| 19 | collapseRow | LOGICAL_ROW | STABLE | Y/Y/Y | Y | reflow, repeat/summary/rowSpan guard |
| 20 | moveRenderedRow | LOGICAL_ROW | LIMITED | Y/N/N | Y | detail row만, target row 0–99 |
| 21 | addStaticRow | LOGICAL_ROW | POC_ONLY | Y/Y/Y | 계약상 가능 | Header clone POC, UI 미연결 |
| 22 | removeStaticRow | LOGICAL_ROW | POC_ONLY | Y/Y/Y | 계약상 가능 | 추가 static row만, UI 미연결 |
| 23 | moveTable | COMPOSITE_TABLE | LIMITED | Y/N/N | Y | exact composite key, after.left/top |
| 24 | resizeTableWidth | COMPOSITE_TABLE | LIMITED | Y/N/N | Y | 140–1400 + 실제 max 792 guard |
| 25 | hideTable | COMPOSITE_TABLE | STABLE | Y/Y/Y | Y | exact composite identity |
| 26 | restoreTable | COMPOSITE_TABLE | STABLE | Y/Y/Y | Y* | runtime은 hide record 삭제 방식 |
| 27 | collapseTable | COMPOSITE_TABLE | STABLE | Y/Y/Y | Y | same-section reflow, footer 보호 |

재계산 결과: **STABLE 18 / LIMITED 4 / POC_ONLY 5 / UNSUPPORTED 0 = 27**. PRE-AI artifact의 `operationRegistryCount: 26`과 LIMITED 3은 현재 코드와 같지 않다. Artifact의 unsupported 14개는 Registry entry가 아니라 별도 제한 목록이다.

# 5. Target / Capability / Validation

## 5.1 Target Resolver 실제 지원

| 요청 Target Type | 실제 처리 | Identity/source/viewer mapping |
|---|---|---|
| OBJECT | 지원 | viewerObjectId 또는 renderInstanceKey; Viewer ID에서 sourceObjectId/band/row를 검증하고 UBLabel/Cell source 조회 |
| RENDER_INSTANCE | 독립 타입 미지원 | OBJECT + renderInstanceKey로만 표현 |
| LOGICAL_COLUMN | 지원 | `tbl:financial-7col|col:n`; 고정 JSON model의 column과 매핑 |
| LOGICAL_ROW | 지원 | 고정 logical key 또는 rendered band-row key |
| HEADER_ROW | alias 입력 지원 | 내부 결과는 `LOGICAL_ROW`, HEADER role |
| GROUP_HEADER_ROW | alias 입력 지원 | 내부 결과는 `LOGICAL_ROW`, GROUP_HEADER role |
| SUMMARY_ROW | alias 입력 지원 | 내부 결과는 `LOGICAL_ROW`, SUMMARY role |
| STATIC_ROW | 미지원 | resolve alias 목록에 없음 |
| RENDERED_DETAIL_ROW | 이 이름은 미지원 | `DETAIL_ROW` alias 또는 LOGICAL_ROW key로만 detail 해석 |
| COMPOSITE_TABLE | 지원 | 오직 `ctbl:main-report-table` |

Resolver는 일반 탐색기가 아니라 `logical-table-model.json`, `tbl:financial-7col`, `ctbl:main-report-table`, sample band 규칙에 결합된 resolver다. Imported UBTable을 자동 발견하지 않는다.

## 5.2 Capability

Capability Result는 `{targetType,targetKey,target,capabilities,constraints,warnings}`이며 각 operation 결과는 `{allowed, reason?, message?, constraints}`다. constraints에는 maturity, viewer/source/pdf support, candidateMaterialization과 target별 guard가 들어간다.

Client `capability-controller.js`는 `/api/capabilities` 결과로 실제 UI 버튼을 disable한다. Server의 `operation-validator.js`도 동일 `capability-service`를 호출하므로 공통 정책 핵심을 공유한다. 단 일부 legacy controller/route validation도 별도로 존재해 모든 UI 행동이 canonical validator 한 곳만 통과하는 구조는 아니다.

## 5.3 Validation과 Error Code

실제 validator는 Registry 존재/target 일치, required payload와 범위, exact source mapping, Render Instance, group boundary, width, binding whitelist, history limit을 검사한다. Capability/Reflow는 repeat row, rowSpan, summary, cross-band 상태를 차단한다. stale target 전용 version/token 검사는 없고 target 재-resolution 실패로만 드러난다. ambiguous target은 label-only 요청에서만 명시적으로 발생한다.

공식 catalog 22개:

`TABLE_WIDTH_OVERFLOW`, `DATA_REPEAT_ROW`, `ROWSPAN_DEPENDENCY`, `CROSS_BAND_REFLOW_UNVERIFIED`, `GROUP_BOUNDARY_MOVE_NOT_ALLOWED`, `FORMULA_DEPENDENCY`, `SUMMARY_DEPENDENCY`, `BINDING_DEPENDENCY`, `LAST_COLUMN_REMOVE_NOT_ALLOWED`, `HIDDEN_COLUMN_OPERATION_NOT_ALLOWED`, `UNSUPPORTED_TARGET_TYPE`, `UNSUPPORTED_OPERATION`, `TARGET_NOT_FOUND`, `AMBIGUOUS_TARGET`, `SOURCE_MAPPING_UNVERIFIED`, `RENDER_INSTANCE_ONLY`, `PDF_OUTPUT_UNSUPPORTED`, `EXCEL_OUTPUT_UNSUPPORTED`, `HISTORY_LIMIT_REACHED`, `INVALID_PAYLOAD`, `RUNTIME_UI_NOT_CONNECTED`, `CANONICAL_SERIALIZER_REQUIRED`.

Catalog와 실제 throw code는 완전히 동일하지 않다. 예를 들어 adapter/service는 `LAST_COLUMN_REMOVE_REJECTED`, `HIDDEN_COLUMN_EDIT_REJECTED`, `DATA_ROW_STRUCTURE_EDIT_REJECTED`, `VERTICAL_REFLOW_UNVERIFIED`, `SOURCE_TABLE_STRUCTURE_MISMATCH` 등 추가 code를 사용하며 catalog 일부는 현재 canonical validator에서 직접 발생하지 않는다.

# 6. History / Store

## 6.1 History architecture

- 파일: `mvp3-app/data/history.json`, schemaVersion 1, draft key=`layoutDraftId|sample|sample`, 최대 200 events.
- 각 event는 semantic descriptor와 함께 `beforeState`, `afterState` 전체 snapshot을 내부 저장한다. API 응답에서는 snapshot을 제거한다.
- snapshot 내용은 `sourcePatches`, `renderPositionPatches`, `structureOperations`다.
- Undo/Redo는 cursor가 가리키는 snapshot을 세 Store에 restore한다. 새 mutation은 redo branch를 자른다.
- transaction은 mutation 전 capture, 실패 시 rollback, history save 실패 시 Store rollback을 수행한다.
- persistence는 JSON 파일이다. reload 후 History/Stores를 읽어 replay할 수 있고 draft ID로 격리된다. 그러나 scope는 오직 sample/sample이다.
- Ctrl/Cmd-Z와 Ctrl/Cmd-Y가 구현돼 있다.
- text coalescing은 Client auto-save debounce(기본 350ms)와 동일 patch upsert 효과가 있지만 History service의 명시적 시간 coalescer는 아니다. Pointer drag는 pointerup에 한 번 save하여 사용자 동작 단위로 합쳐진다.

따라서 History는 모든 편집 의미의 독립 Source of Truth가 아니다. **기존 Patch/Structure Store 상태를 snapshot/timeline으로 감싸는 통합 transaction log**이며 실제 replay state는 세 Store다.

## 6.2 Source Patch Store

- 파일/API: `data/changesets.json`, `/api/change-sets`.
- Patch는 pageIndex, viewer/source/band/row identity, property, before/after, runtimeText를 저장한다.
- 실제 property map: text→text, fontSize→fontSize, fontWeight→fontWeight, textAlign→textAlign, visible→visible, left→x, top→y, width→width, height→height. 다만 source 지원 여부는 object 구조별 `property-mapper.js`가 제한한다.
- Candidate materialization 때 원본 project를 복사하고 candidate `form.ubjf`의 동일 ID property만 변경한 뒤 structural diff/reparse/hash를 검증한다.

## 6.3 Render Position Patch

- 파일/API: `data/render-patches.json`, `/api/render-patches`.
- Render Instance Key, page/canvas/render index, Viewer/source/band/row ID, original fingerprint, before/after left/top을 저장한다.
- duplicate Viewer ID는 index+fingerprint로 방어한다. reload 시 Viewer에 replay된다.
- schema는 className `UBLabel`만 허용한다. source form과 Server PDF에는 반영되지 않는다.
- Imported Form에서도 키 생성 형식 자체는 재사용 가능하지만 object count 하드코딩, UBLabel-only, stable Viewer ID/band convention, fingerprint 안정성이 충족돼야 하므로 **조건부 재사용**이다.

## 6.4 Structure Operation Store

Runtime Store는 `resizeColumn`, `hideColumn`, `moveColumn`, `resizeRow`, `hideRow`, `collapseRow`, `moveTable`, `resizeTableWidth`, `hideTable`, `collapseTable`을 받는다. restore는 hide/collapse record 삭제로 처리된다. Add/Remove/Bound Column·Row는 adapter/test/PDF POC에는 있으나 이 Store와 UI에는 없다. `addBoundColumn`은 기존 `dataset_2.col_8`만 검증된다.

# 7. UBJF Read Capability

`form-patch-service.readForm()`은 base64를 decode하고 zlib inflate한 root JSON을 파싱하며, root.pages의 각 JSON string을 다시 파싱한다. 따라서 codec 차원에서는 임의 key를 보존한다. 의미론적 지원은 아래와 같다.

| 구조 | READ | 근거/제한 |
|---|---|---|
| Root/Page metadata | 부분 | root/page의 width/height, pages, datasets를 읽음; 일반 schema validation 없음 |
| Band | 부분 | top-level band, bandItems, band relation 탐색; sample band ID/role 중심 |
| UBLabel | 지원 | inspect/patch 대상 |
| Cell | 지원 | recursive find, 제한 property patch, table adapter |
| UBTable | sample 한정 | 고정 4개 본문 table + approval/footer model; 일반 parser 아님 |
| UBImage | codec READ만 | sample에 1개 존재하나 semantic service 없음 |
| Line/Rectangle/Shape | 근거 없음 | sample 및 앱 parser/helper에서 확인되지 않음 |
| row/column/Cell geometry | sample 한정 지원 | wrapper와 cell의 x/y/width/height/index/span/border를 adapter가 다룸 |
| style | 부분 | label/cell property와 clone 보존; 완전 style schema 없음 |
| border | clone/보존 | `borderString`, borderSide/type을 보존하지만 일반 border 생성기 없음 |
| binding/formula | 검증/제한 clone | dataset/column/systemFunction/formula를 인식·제거·검증; arbitrary 생성 불가 |

# 8. UBJF Write Capability

`writeForm()`은 `{...root, pages: pages.map(JSON.stringify)}`를 JSON→deflate→base64(76자 CRLF)로 저장한다. 이는 **generic container serializer**이지 valid MySuit document builder가 아니다.

- 기존 form parse→modify→serialize: 구현 완료.
- 기존 object property patch: UBLabel/Cell의 검증된 property에 구현 완료.
- 기존 table Cell clone과 삽입: POC 구현.
- 신규 ID: Cell 전용 `UBMVP55`+random hex generator만 존재.
- wrapper/band/page metadata 신규 생성: 없음.
- 완전 빈 root/pages를 구성하는 builder/schema: 없음.
- 임의 UBTable/UBImage/shape writer: 없음.

Source Patch + Structure/Reflow의 mixed materialization은 canonical serializer가 부분 지원이다. History Viewer replay는 혼합 상태를 표현하지만 한 후보에 serializer를 연속 적용할 때 후속 parser 실패가 기존 증빙에 기록돼 있다. Import Form 생성 자체보다 생성 후 Editor smoke/candidate materialization에서 위험하다.

# 9. New Form Generation Capability

| 능력 | 판정 | 근거 |
|---|---|---|
| A. 기존 form.ubjf 수정 | 구현 완료 | form patch, structure, add/remove, reflow adapters |
| B. 기존 객체 clone | POC | Cell wrapper clone만 명시 구현 |
| C. 신규 Column/Row 삽입 | POC | 고정 4개 table/Header band 전용 |
| D. 완전히 빈 form.ubjf 생성 | 없음 | builder/schema/minimal form test 없음 |
| E. 신규 Project/Form 생성 | 없음 | `sample` project 전체 복제만 가능; arbitrary name/form과 metadata 생성 차단 |

현재 최소 Viewer 입력의 실증된 묶음은 `project folder/form folder/form.ubjf + info.xml`이다. project 전체 복제로 다른 resource도 보존한다. sample `info.xml`은 project_name, form_id, desc, width=794, height=1123, type=3, totalPage 등 metadata를 갖는다. 후보는 formName `sample`을 유지하므로 info.xml을 그대로 복사해도 된다. Import에서 project/form identity, size, page count를 바꾸면 해당 필드 수정과 Viewer 실증이 필요하다.

# 10. Object Creation Capability

| Object | 판정 | 상세 |
|---|---|---|
| Text / UBLabel | 없음(복제 실험도 미검증) | 기존 Label patch만 존재. sample Label schema는 관찰되지만 clone→새 ID→bandItems 추가→Viewer/PDF 검증 코드가 없음 |
| Table / UBTable | 없음(부분 Cell clone POC) | 기존 고정 UBTable의 Cell/row/column clone은 가능; table/band/wrapper를 0부터 만들 수 없음 |
| Image / UBImage | READ 샘플만 | sample `IMG4979.data`는 URL-encoded PNG base64 내장 문자열. 생성, MIME/encoding, resource, PDF 검증 helper 없음 |
| Line | 없음 | source sample/app code 근거 없음 |
| Rectangle | 없음 | source sample/app code 근거 없음 |

Add Static Column은 이웃 wrapper+Cell을 deep clone하고 Cell ID, binding 제거/제한 binding, x/width/columnWidth/index, table width를 재계산한다. Add Static Row는 Header 첫 row clone 후 rowIndex/y/height/rowHeight, Cell ID, binding, table/band height를 갱신한다. 스타일/border 보존과 ID uniqueness 로직은 generator 부품으로 추출할 가치가 있지만 네 고정 table ID, 단일 page, 특정 band, 주변 template 존재를 전제로 하므로 그대로 일반 Table Generator는 아니다.

Style의 현재 실증 범위는 text, fontSize, fontWeight, textAlign, width, height, visible과 clone으로 보존되는 fontColor/backgroundColor/verticalAlign/border 계열이다. fontFamily, fontStyle, padding 및 일반 color normalization은 Import writer로 검증되지 않았다.

# 11. Candidate / Viewer / PDF Reuse

## Candidate

`copyProject()`는 오직 `sample`을 whitelist하고 candidate 이름도 `sample_mvp...` 정규식으로 제한한다. form.ubjf, info.xml과 project 내 resource를 모두 recursive copy하고, 실패 시 후보를 삭제하며 원본 hash를 확인한다. **격리/복사/무결성 패턴은 재사용 가능하지만 naming/source whitelist/form identity를 일반화해야 한다.** `template_empty -> import_xxx`는 현재 API로는 불가능하다.

## Viewer

Viewer query와 proxy는 Imported candidate에도 구조상 사용할 수 있다. 그러나 Client는 sample URL, object count 180, source IDs/bands, logical table JSON을 고정 사용한다. 새 Form은 UView5에서 단독 preview하는 것은 조건부 가능하지만 기존 Editor에 “바로” 연결되지는 않는다.

## PDF

Node Server 자체가 PDF를 생성하는 API는 없다. 브라우저가 UView5를 열고 `canvasModule.captureAll(); mainModule.callService('savePDF')`를 호출하면 MySuit Server의 PDF HTTP request가 발생하며 E2E가 그 request를 재사용한다. Candidate Viewer/PDF 200 증빙은 있다. 따라서 valid Import form이 UView5에서 렌더되고 projectName/formName이 맞으면 같은 경로를 사용할 가능성이 높지만, **현재 코드에는 arbitrary Imported Form용 독립 PDF endpoint가 없고 실제 static-only form 검증도 없다.**

# 12. Existing Editor Reuse

Imported Form을 편집하려면 최소 다음 adaptation이 필요하다.

- projectName/formName whitelist와 Client URL/scope의 동적화.
- `canvas object count===180` attach 조건 제거.
- 안정적 source object/band IDs 및 Viewer ID parser 규칙 충족.
- generic object metadata/source mapping과 Imported target resolver.
- Imported UBTable에서 logical column/row/composite identity를 동적으로 구축.
- History draft scope가 arbitrary project/form을 허용하도록 일반화.
- Capability가 새 object/table/band 구조에서 source/pdf support를 재평가하도록 변경.
- Candidate materializer가 template/Imported source를 복제하고 혼합 patch를 canonical하게 serialize.

현재 본문 Composite Table은 네 고정 source table(`TB3039`, `TB3979`, `TB5514`, `TB8715`)과 168 render members를 `ctbl:main-report-table`로 묶는다. 결재표는 별도 `tbl:approval:UBA6577`로 model JSON에 존재하며 rowSpan Cell을 가진 `UBApproval` static table이다. 이 구분은 discovery 결과가 정적 JSON으로 저장된 것이지 runtime generic discovery가 아니다. 신규 UBTable 자동 인식은 **추가 adaptation 필요**다.

ID 정책도 Cell 전용 random generator 외에는 없다. Import에는 Object/Table/Cell/Band ID namespace, collision scan, bandItems 관계, logical identity 규칙을 새로 정의해야 한다.

# 13. Reusable Modules

## A. 그대로 또는 얇은 wrapper로 재사용 가능

- UBJF container codec의 read/write와 recursive find/diff.
- hash/integrity 검증과 atomic-ish temp-file write 패턴.
- Viewer UView5 URL/proxy 형식.
- Browser 기반 savePDF 호출/응답 검증 방식.
- Candidate의 원본 보호, 실패 cleanup, 감사 log 패턴.
- History transaction/cursor/branch/rollback 개념과 UI.
- Registry/Capability/Validation의 계약 구조.

“그대로”는 알고리즘/패턴 기준이다. 현재 scope/name 하드코딩은 Imported Form 사용 전에 제거해야 한다.

## B. 일부 수정/일반화 후 재사용 가능

- Candidate/project copy naming, whitelist, form metadata 처리.
- Target Resolver와 logical table discovery/model.
- Viewer attach/selection/render replay와 Render Instance Key.
- Source Patch serializer와 property mapper.
- Add Static Column/Row의 Cell clone, relayout, binding strip, border/style 보존.
- Cell ID generator를 전 object type ID service로 일반화.
- page geometry/width guard를 orientation/margin/다중 page로 일반화.
- Capability/Validation/History scope를 Imported project/form으로 일반화.
- Server PDF를 explicit Imported Form export workflow로 감싸는 부분.

## C. 새로 구현 필요

- DIM schema, validator, coordinate/style normalization.
- image/PDF/PPTX/DOCX/XLSX parser 및 layout analyzer.
- blank/static template 계약 또는 zero-based UBJF document builder.
- UBLabel/UBTable/UBImage/Line/Rectangle/Band/Page creation helpers와 schema validation.
- generic ID/relationship generator와 collision validator.
- generic logical table/target discovery.
- image encoding/resource policy와 font substitution policy.
- visual fidelity comparison/oracle 및 multi-page Import tests.
- mixed Source Patch+Structure/Reflow canonical serializer.

# 14. Known Gaps

- Generic parser라는 이름에 비해 semantic adapters가 sample ID/shape에 고정돼 있다.
- zero-based form, static-only minimal band, multi-page, orientation/margin은 runtime 검증되지 않았다.
- Page는 794×1123이고 width guard는 table x=2, right margin=0에서 `794-2=792`로 계산된다. orientation/printable area 필드는 sample에 없으며 단위는 Viewer source coordinate와 거의 1:1로 취급되지만 물리 단위/DPI 변환 근거는 없다.
- x/y는 source page 좌표이며 band object와 child에 absolute `x/y`와 `band_x/band_y`가 함께 관찰된다. Fabric left/top과 source x/y는 일부 object에서만 mapping confidence를 검증했다. 이미지 1000×1400 px 변환식은 추가 검증이 필요하다.
- Static-only `Page -> Static Band -> objects`의 Viewer/PDF 성공 증거가 없다. sample은 PageHeader/DataHeader/GroupHeader/Data/GroupFooter/PageFooter와 datasets를 사용한다.
- 현재 근거로 제안할 수 있는 1페이지 정적 scaffold는 **검증된 PageHeaderBand를 full-page static container로 복제/확장하고 bandItems에 정적 object를 등록하는 template**다. 이는 추천 실험안이지 현재 지원 사실이 아니다. PageFooter나 data/group band를 최소 계약에서 제거할 수 있는지는 spike로 확인해야 한다.
- info.xml과 UBJF root의 project/form metadata가 실제 folder/query 이름과 다르더라도 sample alias는 열리지만, arbitrary rename 계약은 검증되지 않았다.

# 15. Top Technical Risks

1. **UBJF 생성 계약 부재**: container 직렬화는 가능하지만 필수 root/page/band/object key, ID/bandItems, encoding과 Viewer/PDF acceptance를 보장하는 builder/schema가 없다.
2. **좌표·레이아웃 충실도**: pixel/DPI/page/band/Fabric 좌표, font metric, border, pagination과 orientation 변환 근거가 부족하다.
3. **Editor identity의 sample 결합**: Resolver, logical model, scope, attach count와 ID가 sample에 고정되어 생성물이 렌더돼도 기존 편집 기능이 자동으로 붙지 않는다.
4. **객체 유형 gap**: Image는 읽기 샘플만 있고 shape 생성 근거가 없으며 resource/encoding/PDF 호환이 미검증이다.
5. **canonical serializer gap**: Imported Form 편집 후 Source+Structure/Reflow 혼합 후보 materialization이 깨질 수 있다.

# 16. Recommended Import MVP Starting Point

**Option A: 검증된 empty/static template clone 기반을 추천한다.**

첫 단계에서 기존 sample 전체를 import scaffold로 쓰는 것보다, MySuit Designer 또는 최소 변형으로 만든 1페이지 static template을 Viewer와 Server PDF에서 먼저 검증하고 immutable fixture로 둔다. Candidate isolation을 일반화하여 그 template project를 `import_<id>`로 복제한 뒤, template에 미리 둔 Page/Band와 prototype UBLabel/UBTable/UBImage를 clone하는 generator를 만든다.

Zero-based generation은 필수 schema와 최소 band 계약을 먼저 reverse-engineer/검증해야 하므로 MVP 시작점으로 권장하지 않는다. 기존 sample scaffold는 빠른 Text POC에는 쓸 수 있으나 dataset/group/footer와 고정 logical model이 섞여 Import의 static-only 계약을 오염시킨다.

# 17. Import MVP Proposed Phases

1. **Template acceptance spike**: 1페이지 static template, info.xml, label 1개를 Viewer/PDF로 검증하고 hash/object/geometry signature를 고정한다.
2. **Manual DIM Text-only**: DIM schema 최소판, coordinate conversion, prototype Label clone, ID/bandItems validator.
3. **Simple static Table**: Cell clone/relayout 로직을 generic table builder로 분리하고 no-binding table을 검증한다.
4. **Image**: UBImage data encoding/size/resource policy를 실증하고 Viewer/PDF 비교를 추가한다.
5. **Editor adaptation**: dynamic scope/attach, generic object resolver, imported logical table discovery, History/Capability 연결.
6. **Canonical materialization**: Source+Structure mixed serializer와 Imported candidate/PDF regression.
7. **Input adapters**: 먼저 raster image/PDF page를 DIM으로, 이후 PPTX; DOCX/XLSX는 각 문서 layout semantics를 별도 단계로 둔다.

난이도 재평가:

| 항목 | 난이도 | 근거 |
|---|---|---|
| Manual DIM → Text-only Form | MEDIUM | template Label clone과 band/ID 계약 검증 필요 |
| Manual DIM → Text + Simple Table | HIGH | generic table/border/row/column builder 없음 |
| Manual DIM → Text + Table + Image | HIGH | Image encoding/writer/PDF 미검증 |
| Manual DIM → Full Static Layout | VERY_HIGH | shape/font/coordinate/pagination gap |
| Image → DIM using Codex | HIGH | 인식 출력의 schema/측정/검증 체계 없음 |
| Image → DIM → MySuit E2E | VERY_HIGH | 분석과 UBJF 생성 양쪽 gap 결합 |
| PDF → DIM | VERY_HIGH | vector/text/raster, font/page 좌표 복원 필요 |
| PPTX → DIM | HIGH | OOXML geometry는 있으나 font/shape/table mapping 필요 |

## 핵심 질문 답변

1. **Q1: 0부터 form.ubjf 생성?** 아니오. codec은 있으나 valid document builder가 없다.
2. **Q2: template 복제 필요?** 현재 근거로는 그렇다. 검증된 static template clone이 최선이다.
3. **Q3: 신규 UBLabel 안전 생성?** 아니오. 기존 Label 수정만 있고 clone 생성은 미검증이다.
4. **Q4: 신규 UBTable 0부터 생성?** 아니오. 기존 table Cell/row/column clone POC만 있다.
5. **Q5: 신규 UBImage 근거?** sample schema와 내장 PNG data 관찰만 있으며 생성 근거는 없다.
6. **Q6: Line/Rectangle 근거?** 없다.
7. **Q7: 최소 Band 구조를 아는가?** 확정할 실증 근거가 없다. full-page static PageHeader template을 우선 검증할 수 있다.
8. **Q8: 기존 Editor에서 바로 편집?** 아니오. UView5 preview는 조건부 가능하나 Editor는 sample assumptions를 일반화해야 한다.
9. **Q9: 기존 Server PDF?** valid Viewer form이면 경로 재사용 가능성이 높고 candidate 증빙도 있으나 Imported/static-only form은 아직 조건부이며 독립 API가 없다.
10. **Q10: 최대 위험 3개?** UBJF 생성 계약, 좌표/폰트/layout fidelity, Editor identity/sample coupling이다.

## Baseline

- PRE-AI v1 공식 문서: 판정 A, `AI_READY_FOR_PLANNER_POC=true`.
- PRE-AI v1.1 결과: 판정 B. Core 31/31, Capability 18/18, History/Adapter 24/24, Direct UX 9/9; Product Defect 0, 강제 저장 실패 pointer preview 자동계측 Test Debt 1.
- Import 시작 기준선은 최신 **PRE-AI v1.1 B**와 v1의 planner POC flag를 함께 사용해야 한다. 이 flag는 existing editor operation planner 준비도를 뜻하며 Import generator readiness를 뜻하지 않는다.
- 현재 known limitation에는 Add/Remove runtime 미연결, bound field 제한, mixed serializer 부분 지원, 일반 cross-band/summary/rowSpan/rendered detail/multi-page 미검증, Excel/HWP export 미지원이 포함된다.

## 감사 방법과 비변경 확인

이번 감사에서는 source, tests, 현재 UBJF/info.xml과 기존 증빙 JSON/문서를 정적으로 읽었다. 신규 Import 기능, server 실행, candidate 생성/삭제, Store 변경, 기존 테스트 실행/수정은 하지 않았다. 보고서와 machine-readable 요약만 신규 생성했다.
