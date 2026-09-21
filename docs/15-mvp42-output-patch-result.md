# MySuit MVP 4.2 Render Patch 출력 반영 검증

## 1. 최종 판정

**C — Viewer에는 반영되지만 PDF/서버 출력에는 직접 반영되지 않음**

## 2. 한 줄 결론

Fabric Canvas에 후처리한 `RENDER_INSTANCE left/top`은 `savePDF` 요청에 포함되지 않으므로 MySuit 서버 PDF는 원본 폼 위치로 다시 렌더링된다.

## 3. Viewer 렌더링 파이프라인

`form.ubjf → getHtmlViewer → 페이지 렌더 데이터 → Fabric Canvas → Render Position Patch → Viewer` 순서다. 제목 `LB6417_UPHB2584_ROW0`은 원본 `(367, 100)`에서 `(357.0000007687047, 62)`로 이동했고 객체 수 180개를 유지했다.

## 4. PDF 렌더링 파이프라인

`form.ubjf → savePDF POST → HTTPServletEntryPoint → 서버 파서/PDF worker → application/pdf` 순서다. JAR에서 `CallableExportServerSide`, `JobPdfExportConsumer`, `JobPdfExportConsumerSimple`, `xmlToUbForm`을 확인했다.

## 5. Viewer와 PDF의 공통 지점

공통 지점은 원본 폼, 프로젝트/폼 식별자와 파라미터다. Render Patch가 적용된 Fabric 인스턴스는 공통 모델이 아니다.

## 6. PDF 버튼 네트워크 분석

이동된 Viewer에서 `canvasModule.captureAll()`과 `mainModule.callService("savePDF")`를 실제 호출했다.

- POST `/MYSUIT/ubiform.do`
- `METHOD_NAME=savePDF`, `PROJECT_NAME=sample`, `FORM_ID=sample`, `LOAD_TYPE=div`
- 요청 1,311 bytes, 응답 HTTP 200 `application/pdf`
- Fabric/Canvas JSON, pageData, `left`, `top`, Render Patch 키 없음
- `CHANGE_ITEM_DATA`, `CHANGE_DATASET`도 빈 값

`captureAll()`은 전체 Canvas를 직렬화하지 않고 특수 폰트 객체의 이미지만 변경 데이터에 넣는다. 전체 요청 키와 시점은 `mvp42-pdf-network.json`에 보존했다.

## 7. Render Patch 삽입 가능 지점

제품 JAR 밖의 검수 앱 출력 어댑터가 가장 안전하다. 출력 직전에 source 좌표로 검증 가능한 Patch만 격리 후보 폼에 적용하고, 후보 프로젝트를 `savePDF` 대상으로 지정한 뒤 폐기한다. 공식 pageData override가 확인되면 그 경계를 대안으로 사용할 수 있다.

## 8. 기존 PDF 기능 테스트

기존 `savePDF`는 정상 동작했고 1페이지 64,535-byte PDF를 반환했다. 즉 실패 원인은 PDF 기능 장애가 아니라 Render Patch 전달 경로의 부재다.

## 9. PDF POC 결과

현재 외부 Render Patch를 둔 채 서버 PDF를 생성하는 POC는 성공했지만 위치 반영은 실패했다. PDF를 후처리하거나 그래픽을 덧씌우지 않았다. 따라서 `mvp42-position-patched.pdf`는 성공 산출물처럼 만들지 않았다.

## 10. 일반 객체 위치 검증

Viewer 제목은 `(357.0000007687047, 62)`였으나 서버 PDF 화면은 원본 제목 배치를 유지했다. 서버 요청에 해당 좌표가 없다는 네트워크 결과와 일치한다.

## 11. 데이터 밴드 객체 위치 검증

일반 객체와 같은 외부 Patch 저장소를 사용하지만 서버 요청에 7개 Patch 모두 전달되지 않았다. 또한 특정 band row의 runtime 좌표를 source 좌표로 되돌리는 공식 산식이 입증되지 않아 PDF용 좌표 추측 POC는 중단 조건에 따라 수행하지 않았다.

## 12. Browser Print 결과

동일 좌표를 적용한 현재 Canvas를 Chromium PDF로 출력했다. 2페이지 10,194 bytes로 생성됐지만 이는 브라우저 출력이며 MySuit 서버 PDF 반영 성공으로 판정하지 않았다.

## 13. 출력별 지원 가능성

| 출력 | 현재 Patch 반영 | 구현 난이도 | 비고 |
|---|---|---|---|
| Viewer | 예 | 완료 | Fabric 후처리 |
| MySuit 서버 PDF | 아니오 | 중~상 | 후보 폼 또는 공식 override 필요 |
| 브라우저 인쇄 | 예 | 하 | 서버 출력과 다름 |
| 로컬 PDF/인쇄 실행기 | 아니오로 판단 | 상 | 프로젝트/폼 재출력 경로 |
| Excel/HWP 등 서버 출력 | 아니오로 판단 | 중~상 | 공통 서버 출력 분기 |

## 14. 성능

- Viewer 준비 및 Patch 확인: 1,428 ms
- 서버 PDF 요청→응답: 152 ms
- PDF 재요청·파일 보존 포함: 791 ms
- 브라우저 출력: 98 ms

단일 로컬 sample 진단값이며 벤치마크 수치는 아니다.

## 15. 원본 무결성

- `form.ubjf`: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- `info.xml`: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e`
- 사용자 Render Patch: 7건 유지
- MySuit JAR/class 수정, 후보/테스트 Draft 생성, PDF 후처리 없음

## 16. 권장 아키텍처

`확정 변경 세트 → 출력 적합성 검증 → 격리 후보 form 생성 → 후보를 서버 출력 → 결과 반환 → 후보 폐기` 흐름을 권장한다. source 좌표가 검증되지 않은 `RENDER_INSTANCE`는 거부하고, Viewer에는 현재 Patch를 그대로 사용한다.

## 17. 다음 단계

1. 일반 free-form 객체의 Render 좌표를 source 좌표로 변환하는 명시적 규칙을 검증한다.
2. 후보 폼 PDF 출력 어댑터를 트랜잭션 형태로 구현한다.
3. band row는 공식 pageData/instance override 또는 좌표 산식 확보 전까지 제외한다.
4. PDF 외 Excel/HWP도 같은 출력 적합성 정책으로 검증한다.

## 산출물과 회귀

- 서버 PDF: `mysuit-mvp-work/output/mvp42-original.pdf`
- 브라우저 출력: `mysuit-mvp-work/outputs/mvp42-browser-print.pdf`
- 화면: `mysuit-mvp-work/screenshots/mvp42-viewer-position.png`, `mvp42-pdf-original.png`
- 로그: `mysuit-mvp-work/logs/mvp42-*.json`
- 단위/API 9개는 개별 실행 기준 통과했다. 일괄 실행에서 한 테스트가 공유 상태 경쟁으로 실패했지만 단독 재실행은 통과했다.

