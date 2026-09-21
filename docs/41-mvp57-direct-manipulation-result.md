# MVP 5.7 Direct Manipulation UX 결과

## 최종 판정

**A — Viewer 직접 조작, 저장 단일화, rollback, replay 및 검증된 source/PDF 출력 경로가 모두 성공했다.**

## 실제 포인터 검증

| 대상 | 조작 | 결과 |
|---|---|---|
| Column 2 | Column 1 앞으로 drag/drop | order `0,2,1,3,4,5,6`, 저장 1회, reload 유지 |
| Column 2 | 경계 +30 | width `70→100`, 저장 1회 |
| Page guard | 경계 +500 | total width 792에서 clamp |
| 범위 밖 drop | 왼쪽 -700 | 저장 0회, 순서 유지 |
| Summary Row | gutter 선택 및 +12 resize | height `27→39`, 저장 1회 |
| Detail Row | gutter 선택 | resize/hide/collapse 모두 disabled |
| Composite Table | grip +30/-20 | `(2,300)→(32,280)`, 저장 1회 |
| Composite Table | 우측 경계 -20 | width `792→772`, 저장 1회 |

Column 저장 실패를 HTTP 500으로 강제했을 때 width `138→138`로 즉시 rollback됐다. interaction lock은 pointerup 저장이 끝날 때까지 다음 조작을 차단했다.

## 좌표와 렌더 안정성

실제 canvas DOM rect는 794×1123, intrinsic canvas는 1588×2246, DOM scale은 0.5, Fabric zoom은 2였다. 세 좌표 `(2,300)`, `(442,333)`, `(792,954)`의 canvas→screen→canvas roundtrip 오차는 모두 0이었다. 숨겨진 0×0 canvas 선택과 overlay의 100ms 재생성 문제도 함께 제거했다.

## Output smoke

저장된 move/resize/hide/row operation을 MVP 5.4 adapter로 후보 UBJF에 적용하고, Table collapse를 MVP 5.6 reflow service로 적용했다.

- 후보 Viewer 객체: 12
- 서버 PDF: HTTP 200, 41,485 bytes
- PDF SHA-256: `82963160baedbc70c77ce80bfa8b067f2d8c21ebc3a93cda7baabaf62648867c`
- page count: 1
- 테스트 후보: 종료 시 cleanup

## 회귀와 무결성

- MVP 5.7 assertion: 9/9 성공
- Structure Operation: 5/5 성공
- Vertical Reflow: 4/4 성공
- Add/Remove Adapter: 5/5 성공
- Structure Adapter: 3/3 성공
- MVP 4.4 Direct Editing E2E: 성공
- MVP 5.6 Collapse UI/API E2E: 성공
- 원본 `form.ubjf`: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` 유지
- 원본 `info.xml`: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` 유지
- 기존 사용자 후보: 보존

## 근거

- 로그: `mysuit-mvp-work/logs/mvp57-*.json`
- 화면: `mysuit-mvp-work/screenshots/mvp57-*.png` 7개
- PDF: `mysuit-mvp-work/output/mvp57-direct-source-smoke.pdf`
- E2E: `mysuit-mvp-work/mvp3-app/tests/e2e-mvp57-direct-manipulation.test.js`

## 남은 제한

Add/Remove Column/Row는 source POC와 operation-store bridge가 없어 direct context menu에서 비활성이다. 데이터 반복 행 구조 변경, 일반 Cross-Band reflow, Table 자동 높이 scaling도 기존 안전 정책대로 지원하지 않는다.

