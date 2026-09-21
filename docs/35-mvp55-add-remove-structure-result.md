# MVP 5.5 Add/Remove Structure 결과

## 최종 판정

**A — Static Column/Row 추가·삭제, 제한적 Bound Column과 Page Width Guard가 후보 UBJF, MySuit Viewer, 서버 PDF까지 동작한다.**

## Operation 판정표

| Operation | Viewer | UBJF | PDF | 안전성 |
|---|---:|---:|---:|---|
| addStaticColumn | 성공 | 4개 신규 Cell, 8열 | 성공 | A, 명시적 폭 보상 필요 |
| removeColumn | 성공 | 4개 Cell 실제 제거, 6열 | 성공 | A, index 0/마지막 열 차단 |
| addStaticRow | 성공 | Header 2행, 7개 신규 Cell | 성공 | A, Header Static Row 한정 |
| removeStaticRow | 성공 | 추가 행 실제 제거 | 성공 | A, binding 없는 추가 행 한정 |
| addBoundColumn | 성공 | 기존 `dataset_2.col_8` 제한 복제 | 성공 | B, 신규 field 생성 금지 |
| pageWidthGuard | 성공 | 저장 전 원자 차단 | 해당 없음 | A |

## 실제 결과

### Static Column 추가

- Column 0: `370 → 340`
- 신규 Column: index 7, width 30, Header `비고`
- 네 source Table: `1×7 → 1×8`
- Table width: 790 유지
- 신규 source Cell ID: 4개, 모두 고유
- Viewer 객체: `180 → 204`
- 새 Column은 반복 Band를 통해 Header 1 + Group 3 + Detail 17 + Summary 3, 총 24개 Render Instance로 출력
- Viewer 우측 경계는 page width 안에 유지

### 기존 Column 제거

- 대상: index 6 (`2018`, Detail `dataset_2.col_8`, 대응 Summary)
- 네 source Cell 4개 실제 제거
- Table: `1×7 → 1×6`, width `790 → 720`
- Viewer 객체: `180 → 156`
- 오른쪽 빈 slot 없이 collapse

### Static Row 추가/제거

- 대상: `UDHB4114` Header Band
- Header Table: `1×7 → 2×7`, height `33 → 53`
- 신규 문구: `검수 메모`
- Viewer에서 기존 연도 Header와 신규 행이 서로 다른 Y로 함께 출력
- 신규 row가 없던 초기 구현은 row overlap이 발생했으며 wrapper/Cell `rowIndex=1`을 추가해 해소
- remove 후보는 add 후 같은 Static Row를 제거해 원본 `1×7`, height 33 및 Viewer 180개로 복원

### Bound Column 제한 POC

- Column 0: `370 → 320`, 신규 width 50, 총 width 790
- 기존 field `dataset_2.col_8`만 복제
- Viewer 객체 `180 → 204`, Detail 값과 Summary 값 출력
- 신규 Dataset field/SQL/임의 binding은 미지원

## 폭 초과 차단

단독 width 20 Column 추가는 `790 → 810`이 되어 저장 전에 차단됐다.

```json
{
  "code": "TABLE_WIDTH_OVERFLOW",
  "currentWidth": 790,
  "requestedWidth": 810,
  "maxWidth": 792
}
```

기존 UI/API의 `resizeColumn`으로 793을 요청한 경우에도 HTTP 409와 `currentWidth=790`, `requestedWidth=793`, `maxWidth=792`를 반환했다. UI는 현재/최대/남은 폭을 표시하고 최대 입력을 792로 제한한다.

## 서버 PDF

| 파일 | 결과 | 크기 |
|---|---:|---:|
| `mvp55-original.pdf` | 성공 | 64,536 bytes |
| `mvp55-add-column.pdf` | 성공 | 66,292 bytes |
| `mvp55-remove-column.pdf` | 성공 | 62,758 bytes |
| `mvp55-add-row.pdf` | 성공 | 65,696 bytes |
| `mvp55-remove-row.pdf` | 성공 | 64,536 bytes |
| `mvp55-bound-column.pdf` | 성공 | 66,635 bytes |

모두 MySuit `savePDF`의 `application/pdf` 응답이며 HTTP 200이다. 후보 Viewer 자체가 최종 폭을 넘지 않도록 source 저장 전에 차단했기 때문에 초과 후보/PDF는 생성되지 않았다.

## 테스트와 무결성

- 신규 Adapter 단위 검증: 5/5 성공
- Structure Operation/폭 가드: 5/5 성공
- 실제 Viewer/PDF assertion: 7/7 성공
- 폭 초과 UI/API E2E: 성공
- 원본 form SHA-256: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` 전후 동일
- 원본 info SHA-256: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` 전후 동일
- `sample_mvp55_*` 테스트 후보: 전부 cleanup
- 기존 사용자 후보: 보존

## 근거

- 로그: `mysuit-mvp-work/logs/mvp55-*.json`
- 화면: `mysuit-mvp-work/screenshots/mvp55-*.png`
- PDF: `mysuit-mvp-work/output/mvp55-*.pdf`
- 코드: `mysuit-mvp-work/mvp3-app/src/server/services/ubjf-add-remove-adapter.js`

## 남은 제한

- Data Detail Row의 구조 삽입/삭제
- 새로운 Dataset field 및 SQL 생성
- 임의 formula/binding 생성
- 여러 Band를 가로지르는 일반 Row 삽입과 전체 vertical reflow
- 구조 operation을 사용자 UI에서 직접 add/remove하는 제작 UX

다음 연구 단계는 MVP 5.6의 cross-band vertical reflow다.
