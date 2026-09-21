# MVP 5.4 MySuit 서버 출력 검증 결과

## 결론

후보 UBJF를 MySuit UView5가 직접 렌더한 상태에서 기존 `savePDF`를 호출했다. Fabric JSON이나 Viewer Structure replay를 PDF 요청에 추가하지 않았다. 따라서 결과 PDF는 후보 source 구조에서 서버가 새로 생성한 출력이다.

## 생성 결과

| 출력 | 크기 | SHA-256 앞 12자리 | 결과 |
|---|---:|---|---|
| original | 64,536 bytes | `2b8dcd160853` | 성공 |
| column resized | 64,623 bytes | `c53a8c9b4610` | 성공 |
| column hidden | 62,765 bytes | `2193e2ef934f` | 성공 |
| column reordered | 64,531 bytes | `77b143c952d0` | 성공 |
| row resized | 64,538 bytes | 별도 Tier 3 재검증 | 성공 |
| row hidden | 62,827 bytes | `43f15bb9d303` | hide 성공, collapse 제한 |
| table hidden | 41,485 bytes | `3cc2e3eaff5f` | 전체 Table hide 성공 |

모든 PDF는 서로 다른 binary signature를 가졌고 1페이지 정상 응답이었다. OCR은 사용하지 않았다. PDF viewer 이미지와 후보 Viewer source geometry를 함께 비교했다.

Column resize PDF에서는 늘어난 width가 그대로 반영됐으며 총 width 840이 페이지 가용 폭을 넘어서 오른쪽 끝 clipping도 source와 동일하게 나타났다. Column hide는 파일 크기와 렌더 객체가 감소했고 오른쪽 column이 source X 기준으로 collapse됐다. Reorder는 Cell identity/binding을 유지한 후보 source에서 생성됐다.

## Excel

현재 UView5 runtime `mainModule`에서 Excel/XLS export entrypoint를 발견하지 못했다. 안전하게 호출할 공식 경로가 없어 `UNSUPPORTED_NO_EXPORT_ENTRYPOINT`로 종료했다. PDF 성공 판정에는 영향을 주지 않는다.

## 출력 파일

- `mysuit-mvp-work/output/mvp54-original.pdf`
- `mysuit-mvp-work/output/mvp54-column-resized.pdf`
- `mysuit-mvp-work/output/mvp54-column-hidden.pdf`
- `mysuit-mvp-work/output/mvp54-column-reordered.pdf`
- `mysuit-mvp-work/output/mvp54-row-resized.pdf`
- `mysuit-mvp-work/output/mvp54-row-hidden.pdf`
- `mysuit-mvp-work/output/mvp54-table-hidden.pdf`

관련 화면은 `mysuit-mvp-work/screenshots/mvp54-*.png`, 상세 네트워크/해시는 `mysuit-mvp-work/logs/mvp54-pdf-results.json`과 `mvp54-tier34-results.json`에 있다.

