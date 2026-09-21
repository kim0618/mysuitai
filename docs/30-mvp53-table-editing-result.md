# MVP 5.3 Composite Logical Table Direct Editing 결과

## 최종 판정

**B — Composite Table 선택·이동·너비·Editor Collapse·전체 hide/restore는 성공했고, 아래 비소속 객체의 output collapse reflow는 제한했다.**

## Composite Identity와 선택

- Composite key: `ctbl:main-report-table`
- source UBTable: Header/Group Header/Detail/Summary 4개
- Column: 7개
- Logical/Rendered Row: 24개
- 선택 member: 168개, unique 168개
- 비소속 Viewer 객체 포함: 0개
- 전체 Viewer 180개 중 제외 객체: 12개(로고, 제목, 결재란 등)
- 선택 bounds: `(2,300)–(792,954)`, `790×654`

Membership은 MVP 5.0의 source cell/band/schema/binding 모델로 확정했다. bounds는 highlight와 drag geometry에만 사용하며 identity 판단에는 사용하지 않았다.

## Table 이동

실제 상단 grip pointer drag로 `dx +30`, `dy -20`을 적용했다.

- 168개 member 모두 동일 delta
- 이동 전후 width/height와 내부 상대 좌표 유지
- Column/Row identity와 member ID 유지
- `moveTable` 최초 before와 최종 after를 normalized upsert
- 저장 후 새로고침/context replay 성공
- preview+save: 약 449ms

## Table 전체 너비

`PROPORTIONAL` 정책으로 전체 logical width를 정확히 825로 변경했다.

```text
[370,70,70,70,70,70,70]
→ [386,73,73,73,73,73,74]
합계 = 825
```

마지막 visible Column에 rounding delta를 반영했다. Column reorder/hide 이후에도 visible Column만 비율 계산하며, 숨김 Table의 resize/move는 API 409 `HIDDEN_TABLE_EDIT_REJECTED`로 거부된다. width 저장 실측은 약 89ms다.

Table height 자동 resize는 비활성화했다. Header/Group/Summary fixed row와 17개 Rendered Detail Row를 일괄 scale하면 데이터 반복 의미가 달라지기 때문이다.

## Editor Collapse / Expand

- Editor collapse: 약 57ms
- Expand: 약 64ms
- placeholder: `7 columns / 168 objects`
- draft별 local UI state로 저장
- Structure Operation과 output visibility는 변경하지 않음
- expand 후 Column order/width/hidden과 Row height 상태 그대로 복원

## Output Hide / Restore

- 168개 member 전체 hide: 성공, 약 74ms
- restore: 성공
- Column/Row/Table derived state 보존
- 새로고침 replay 성공
- Editor Collapse와 별개 control/state임을 검증

아래 비소속 객체를 위로 당기는 reflow는 수행하지 않았다. 제외된 12개에는 제목/로고/결재란처럼 표 위 또는 독립 구조 객체가 섞여 있고, 좌표만으로 같은 output section과 독립 Band 안전성을 확정할 수 없다. `hideTable`은 `collapseSpace=false`, `belowObjectReflow=UNSUPPORTED`로 저장한다. 이것이 B 판정 사유다.

## 복합 Operation과 안정성

다음을 동시에 적용했다.

- Column 2 visual index `2 → 1`
- Column 5 hide
- Summary Row height `27 → 37`
- Table width 825
- Table move `+30/-20`

새로고침 5회와 새 Browser Context 5회에서 Column order/width/hidden, Row height/hidden, Table bounds/width/hidden, member IDs가 모두 동일했다. 전체 E2E는 약 17.95초다.

## 회귀와 무결성

- Structure Operation service: 5/5 통과
- MVP 5.2 Column reorder/Row edit/10회 replay: 통과
- MVP 4.4 inline/toolbar/resize/hide/restore: 통과
- 원본 `form.ubjf`: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` 전후 동일
- 원본 `info.xml`: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` 전후 동일
- 신규 후보: 0개
- 기존 보존 후보 `sample_mvp4_20260811_102025_7201dd` 유지
- 테스트 Structure Operation 최종 0건

## 근거

- 설계: [29-mvp53-table-editing-design.md](29-mvp53-table-editing-design.md)
- 로그: `mysuit-mvp-work/logs/mvp53-*.json`
- 화면: `mysuit-mvp-work/screenshots/mvp53-*.png`
- E2E: `mysuit-mvp-work/mvp3-app/tests/e2e-mvp53-table-editing.test.js`

## 다음 단계

다음은 **MVP 5.4 — Structure Operation → UBJF Structure Adapter**다. 현재 Viewer-only Column/Row/Table 연산을 별도 후보 UBJF 구조로 변환하고 MySuit 서버 재렌더 및 PDF/Excel 반영을 검증한다.

