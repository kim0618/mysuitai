# MVP 5.6 Vertical Reflow 결과

## 최종 판정

**A — 검증된 Header Row와 Composite BODY section의 실제 source collapse가 후보 UBJF, MySuit Viewer, 서버 PDF까지 성공했다.**

일반 Same-Band/Cross-Band reflow는 sample에 안전한 follower 표본이 없거나 dependency 근거가 부족해 지원하지 않는다.

## Operation 판정표

| Operation | Viewer | UBJF | PDF | Vertical Collapse | 판정 |
|---|---:|---:|---:|---:|---|
| hideRow | 성공 | output hide | 성공 | X, 공간 유지 | B |
| collapseRow | 성공 | Band/Table height 0 | 성공 | 33px | A, Header 한정 |
| hideTable | 성공 | output hide | 성공 | X, 공간 유지 | B |
| collapseTable | 성공 | BODY 4-Band height 0 | 성공 | 654px source flow | A |
| crossBandCollapse | 차단 | 후보 없음 | 없음 | 미검증 | UNSUPPORTED |

## Header Row Collapse

- Header 객체: 출력에서 제거
- Group Header top: `333 → 300`
- Detail top: `360 → 327`
- 첫 Summary top: `495 → 462`
- 모든 후속 BODY row: 정확히 `-33`
- Page Footer top: 1086 유지
- Viewer page count: 1 유지

단순 visible false가 아니라 `UDHB4114.height=0`이 MySuit source layout engine에 입력되어 후속 Band 전체가 재배치됐다.

## Composite Table Collapse

- 본문 Composite member: 168개 전부 제거
- Viewer 전체 객체: `180 → 12`
- Header/Group/Detail/Summary source Band: height 0
- source BODY flow: `654 → 0`
- Page Header의 제목/로고/Approval 유지
- Page Footer runtime top 1086 유지
- page count 1, 중복/추가 객체 없음

sample에는 Table 아래의 일반 BODY object가 없어 별도 object Y 이동은 수행하지 않았다. Footer를 위로 당기지 않은 것은 실패가 아니라 Page Footer 보호 정책이다.

## 안전성 차단

- Approval rowSpan=2 collapse: `UNSUPPORTED_ROWSPAN_DEPENDENCY`
- Summary collapse: HTTP 409 `VERTICAL_REFLOW_UNVERIFIED`
- 임의 Cross-Band collapse: `VERTICAL_REFLOW_UNVERIFIED`
- 미지원 시 후보 생성 없음, 원본/Viewer 변경 없음

UI는 `[출력에서 숨기기]`와 `[출력에서 숨기고 공간 제거]`를 분리한다. Header 외 Row에서는 공간 제거 버튼을 비활성화하고 capability에 `지원 안 함`을 표시한다.

## 복합/Restore

MVP 5.5의 Static Column 추가, Column resize 후 Table collapse를 적용했다. 최종 후보 Viewer는 본문 168+신규 Column 인스턴스를 모두 출력하지 않고 12개 비소속 객체만 유지했다. base source를 다시 로드한 Restore는 180개와 Group Header top 333을 정확히 복구했다.

## Pagination/PDF

| 출력 | page count | bytes | 결과 |
|---|---:|---:|---:|
| Original | 1 | 64,536 | 성공 |
| Row collapsed | 1 | 62,824 | 성공 |
| Table collapsed | 1 | 41,485 | 성공 |

세 PDF 모두 MySuit `savePDF`의 HTTP 200 `application/pdf` 응답이다. PDF post-processing과 OCR은 사용하지 않았다.

## 성능

- Row 후보 copy+apply: 19ms
- Table 후보 copy+apply: 13ms
- Viewer render: original 3,344ms / row 2,138ms / table 1,882ms
- savePDF: original 499ms / row 345ms / table 236ms

## 회귀와 무결성

- Vertical service 단위 검증: 4/4 성공
- Structure Operation/capability: 5/5 성공
- MVP 5.5 Adapter: 5/5 성공
- MVP 5.4 Adapter: 3/3 성공
- MVP 5.6 Viewer/PDF assertions: 8/8 성공
- Collapse UI/API E2E: 성공
- MVP 4.4 Direct Editing 회귀: 성공
- 원본 form/info SHA-256: 전후 동일
- `sample_mvp56_*`: 전부 cleanup
- 기존 사용자 후보: 보존

## 근거

- 로그: `mysuit-mvp-work/logs/mvp56-*.json`
- 화면: `mysuit-mvp-work/screenshots/mvp56-*.png`
- PDF: `mysuit-mvp-work/output/mvp56-*.pdf`
- 구현: `mysuit-mvp-work/mvp3-app/src/server/services/vertical-reflow-service.js`

## 남은 제한

- 같은 Band 안의 후속 Static Object reflow 표본
- 일반 Cross-Band dependency 추론
- Group Header/Summary의 semantic collapse
- Data Detail row 구조 변경
- 다중 페이지에서 page count 감소/이월 검증

다음 단계는 MVP 5.7 Direct Manipulation UX 마무리다.
