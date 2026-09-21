# MVP 4.1.1 위치 편집 안정화 결과

## 최종 판정

**A — 위치 편집 안정화 완료**

## 일반 객체 드래그

- 대상: `LB6417_UPHB2584_ROW0`, renderIndex 0
- `(367,100) → (397,80)`, 정확히 `+30,-20`
- PUT 저장 요청 1회
- T+0/100/500/1000/2000ms 모두 `(397,80)`
- 포인터 이동 후 따라오지 않음
- 객체 수 180 유지
- 새로고침 후 `(397,80)` 유지

## 화면 점프와 모드

첫 표시 프레임부터 `(397,80)`이었고 원본 위치 노출은 없었다. 검수 모드 ON/OFF를 5회 반복한 10개 표본 모두 `(397,80)`이었다. iframe 세대당 최종 Canvas에 한 번만 연결하도록 수정했다.

## 키보드와 실패 복구

- 시작 `(397,80)`
- Right, Down, Shift+Right, Shift+Up
- 최종 `(408,71)`, Patch after와 일치
- 250ms debounce 후 최종 상태 저장
- 테스트 전용 HTTP 500 시도 `(423,86)`은 `(408,71)`로 정확히 rollback

## 중복 ID 독립성

| 객체 | renderIndex | 원본 | 이동 | 새로고침 |
|---|---:|---:|---:|---:|
| 대표이사 | 3 | `(65,193)` | `(85,183)` | 유지 |
| 사장 | 4 | `(140,193)` | `(125,218)` | 유지 |

대표이사 초기화 후 `(65,193)`으로만 복구됐고 사장은 `(125,218)`을 유지했다. 서로 다른 Patch와 Render Instance Key로 저장됐다.

## Render Index 검증

10개 새 Browser Context에서 객체 수와 중복 객체 index/fingerprint가 모두 동일했다. 현재 sample에 대해 안정적이며, 이후 제품 렌더 순서가 바뀌면 fingerprint 검증이 적용을 차단한다.

## 기존 7건 마이그레이션

- 백업 7건, 마이그레이션 후 7건
- MIGRATED 7, AMBIGUOUS 0, UNRESOLVED 0
- patchId, before, after와 사용자 의미 전부 유지
- 기본 Draft 새 로드에서 7건 모두 기대한 index와 after 좌표에 적용됨

## MVP 4 회귀

- 단위/API 테스트 9종은 순차 실행 기준 통과
- 병렬 일괄 실행의 공유 JSON 상태 경쟁은 순차 재실행으로 통과 확인
- 실제 MVP 4 E2E 성공: text/fontSize/width/visible, Patch 추가·삭제, 후보 생성, 후보 Viewer 179개, 원본 180개, 후보 폐기
- 원본 form/info 해시 유지

## 무결성

- form: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- info: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e`
- 제품 JAR/class/JS 수정 없음
- 테스트 Draft Patch 0건으로 정리

## 근거

- `mysuit-mvp-work/logs/mvp411-*.json`
- `mysuit-mvp-work/screenshots/mvp411-*.png`
- 테스트: `mysuit-mvp-work/mvp3-app/tests/e2e-mvp411-stability.test.js`

## 다음 단계

MVP 4.3에서는 이 key 중 source 좌표가 검증 가능한 고정 객체만 후보 UBJF/PDF 어댑터 대상으로 삼는다. 데이터 밴드 인스턴스는 공식 역매핑이 확보되기 전까지 제외한다.

