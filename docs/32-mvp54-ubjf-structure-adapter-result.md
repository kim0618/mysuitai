# MVP 5.4 UBJF Structure Adapter 결과

## 최종 판정

**A — 핵심 Column Structure Operation을 실제 후보 UBJF와 MySuit 서버 PDF까지 반영할 수 있다.**

Tier 1의 `resizeColumn`, `hideColumn`과 Tier 2의 `moveColumn`이 모두 성공했다. 네 source UBTable 전체가 함께 변경됐고 Cell ID/binding/style/border signature가 유지됐다. 후보는 Viewer Structure replay 없이 MySuit 자체 Viewer에서 기대 geometry로 렌더됐다.

## Source Column Mapping

- logical columns: 7
- source tables per column: 4
- mapped source cells: 28
- source Table IDs: `TB3039`, `TB3979`, `TB5514`, `TB8715`
- source width schema: `[370,70,70,70,70,70,70]`

Column metadata는 별도로 존재하지 않았다. wrapper와 Cell의 width/X 집합 및 UBTable width가 source column structure다.

## Operation별 결과

| Operation | Viewer | UBJF Candidate | Server PDF | Excel | 판정 |
|---|---:|---:|---:|---:|---|
| resizeColumn | 성공 | 성공 | 성공 | 미지원 | A |
| hideColumn | 성공 | 성공 | 성공 | 미지원 | A |
| moveColumn | 성공 | 성공 | 성공 | 미지원 | A |
| resizeRow | 성공 | Header source/PDF 성공 | 성공 | 미지원 | A(고정 Row 한정) |
| hideRow | 성공 | 출력 hide 성공, 공간 collapse 제한 | 성공 | 미지원 | B |
| hideTable | 성공 | 네 Table 전체 hide 성공, 아래 reflow 제한 | 성공 | 미지원 | B |

## Column Resize

두 logical column을 한 후보에서 검증했다.

- Column 2: `70 → 100`
- Column 4: `70 → 90`
- source widths: `[370,70,100,70,90,70,70]`
- source X: `[0,370,440,540,610,700,770]`
- Table width: `790 → 840`

MySuit Viewer의 최종 좌표는 `UBTable.x=2 + wrapper.x`다. 따라서 Column 2 left 442/width 100, 다음 Column left 542, Column 4 left 612/width 90으로 정확히 렌더됐다. 최초 E2E 판정식이 Table x를 누락해 false를 기록했지만 별도 offset 검증과 3/3 Adapter 테스트로 교정했다.

840 width는 원본 페이지 가용 폭을 넘어 서버 PDF 우측 끝이 잘릴 수 있음을 발견한 당시 진단값이다. MVP 5.5에서 source Adapter와 UI/API 모두에 Page Width Guard를 추가했으므로 현재 코드는 이 요청을 `TABLE_WIDTH_OVERFLOW`로 저장 전에 차단한다. 현재 허용 최대 Table width는 792다.

## Column Hide

- logical Column 5의 네 source Cell identity 유지
- `visible=false`, `width/columnWidth=0`
- Table width `790 → 720`
- Column 6 Viewer left `722 → 652`
- Viewer 객체 수 `180 → 156`(해당 Column 24개 미생성)
- 빈 horizontal slot 없이 collapse

## Column Reorder

- visual order `[0,1,2,3,4,5,6] → [0,2,1,3,4,5,6]`
- Column 2 Viewer left `442 → 372`
- Column 1 Viewer left `372 → 442`
- 네 UBTable row array를 동일하게 reorder
- Header/Detail/Summary Cell ID와 dataset field/summary expression 그대로 유지
- Viewer 객체 수 180 유지

## Row와 Table

Header Row resize `33 → 45`는 Cell/Table/Band height를 함께 변경했다. 후보 Viewer에서 Header height 45, 다음 Group Header top `333 → 345`로 자동 source reflow됐고 서버 PDF도 생성됐다.

Header Row hide는 7개 객체가 출력되지 않아 객체 수가 173이 됐지만 다음 Group Header top은 333으로 유지됐다. 즉 hide는 성공했으나 vertical collapse는 실패/제한이다.

Table hide는 네 source Table/Cell을 모두 숨겨 후보 Viewer 객체가 비소속 12개만 남았다. 서버 PDF도 생성됐지만 아래 독립 객체 upward reflow는 수행하지 않았다.

## 원자성과 무결성

- Adapter 단위 검증: 3/3 통과
- 결과 geometry 보정 검증: 2/2 통과
- Structure Operation 회귀: 5/5 통과
- 모든 후보 binding signature: 동일
- 원본 form/info hash: 전후 동일
- `sample_mvp54_*` 테스트 후보: 전부 cleanup
- 기존 `sample_mvp4_20260811_102025_7201dd`: 보존

## 근거

- `mysuit-mvp-work/logs/mvp54-source-column-mapping.json`
- `mysuit-mvp-work/logs/mvp54-*-source.json`
- `mysuit-mvp-work/logs/mvp54-viewer-source-geometry-compare.json`
- `mysuit-mvp-work/logs/mvp54-geometry-offset-verification.json`
- `mysuit-mvp-work/logs/mvp54-tier34-results.json`
