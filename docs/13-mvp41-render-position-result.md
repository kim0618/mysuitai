# MVP 4.1 Render Position Patch 구현 결과

## 최종 판정

**A — Viewer 위치 편집 시연 가능**

원본 `form.ubjf`를 수정하지 않고 기존 Fabric `UBLabel`을 실제 마우스로 드래그하고, 별도 Render Position Patch에 저장하여 새로고침과 새 브라우저 Context에서 같은 객체 ID에 재적용했다. 개별 및 전체 원복도 성공했다.

## 구현 결과

- 통합 검수 모드: 속성 편집과 위치 이동 동시 활성화
- 대상: 최초 렌더에 존재하는 정확한 ID의 `UBLabel`
- 범위: `RENDER_INSTANCE`
- 저장: `data/render-patches.json`, 임시 파일 후 atomic rename
- 감사: `data/audit/render-patch-events.jsonl`
- 동일 객체 재이동: 최초 `before` 유지, `after` 갱신
- 드래그: 자유 이동, Shift 10px 스냅, `mouse:up` 즉시 종료·저장
- 키보드: Arrow 1px, Shift+Arrow 10px, 250ms debounce 저장
- 재적용: Canvas 준비 후 정확한 `pageIndex + viewerObjectId + className` 검증
- 미발견 객체: 생성/추측 없이 SKIPPED
- 실패 저장: 드래그 전 좌표 즉시 복구
- 개별 `위치 초기화` 및 `모든 위치 변경 초기화` 구현

## 실제 E2E 실측

대상: `LB6417_UPHB2584_ROW0`

| 단계 | left | top | 객체 수 |
|---|---:|---:|---:|
| 이동 전 | 367 | 100 | 180 |
| 마우스 드래그 후 | 397 | 80 | 180 |
| iframe 새로고침 후 | 397 | 80 | 180 |
| 새 Browser Context | 397 | 80 | 180 |
| 개별 초기화 후 | 367 | 100 | 180 |
| 개별 초기화 후 새로고침 | 367 | 100 | 180 |
| Shift+ArrowRight | 377 | 100 | 180 |
| 전체 초기화 및 새로고침 후 | 367 | 100 | 180 |

- 객체 선택: 2,115 ms(초기 Viewer 준비 포함)
- 드래그 Patch 저장: 184 ms
- 새로고침 후 Patch 적용: 1,612 ms
- 개별 초기화: 61 ms
- 전체 초기화: 63 ms
- 최종 `render-patches.json`: 0건

## 무결성

- `form.ubjf`: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` 전후 동일
- `info.xml`: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` 전후 동일
- MySuit `UView5` 제품 트리: `4aaab5acd778efb2d61de57e22a3cf48d965ef673e554b3e6ed450f2bf0c4e8f` 전후 동일
- 신규 Fabric 객체 없음, 객체 수 180 유지
- 후보 프로젝트 및 후보 form 생성 없음

## 테스트와 근거

- 단위/API 회귀: 9개 테스트 파일 통과
- 실제 Chromium E2E: 성공
- E2E: `mysuit-mvp-work/logs/mvp41-position-e2e-result.json`
- 무결성: `mysuit-mvp-work/logs/mvp41-integrity-result.json`
- 성능: `mysuit-mvp-work/logs/mvp41-performance.json`
- 저장소 사본: `mysuit-mvp-work/logs/mvp41-render-patches.json`
- 화면: `mysuit-mvp-work/screenshots/mvp41-*.png`

## 제한

이 위치는 Viewer 렌더 후처리다. `form.ubjf`, PDF, Excel, 서버 인쇄 및 대량 출력에는 반영되지 않는다. 현재 검증 범위는 sample 첫 페이지이며 후보에서 객체 ID가 사라지는 경우 다른 객체로 대체 매핑하지 않는다.
