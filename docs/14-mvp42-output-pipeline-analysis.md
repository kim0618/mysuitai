# MVP 4.2 출력 파이프라인 분석

## 결론

실제 구조는 **TYPE B — Viewer와 서버 PDF가 분리된 렌더링 경로**다. 두 경로는 원본 `form.ubjf`와 요청 파라미터를 공유하지만, MVP 4.1이 Fabric 객체에 후처리한 `left/top`은 공유하지 않는다.

```text
form.ubjf → getHtmlViewer → 페이지 렌더 데이터 → Fabric Canvas
                                               └→ Render Position Patch → Viewer

form.ubjf → savePDF POST → HTTPServletEntryPoint → 서버 파서/PDF worker → PDF
```

## 근거

- PDF UI는 `canvasModule.captureAll()` 뒤 `mainModule.callService("savePDF")`를 호출한다.
- `captureAll()`은 Canvas 전체를 직렬화하지 않고 `specialFontLabel`만 이미지 데이터로 변경 목록에 넣는다.
- `serverExportPDF()`는 프로젝트, 폼, 암호화 파라미터와 선택적 `CHANGE_ITEM_DATA`/`CHANGE_DATASET`을 서버로 보낸다.
- 서버 JAR에는 `HTTPServletEntryPoint`, `CallableExportServerSide`, `JobPdfExportConsumer`, `JobPdfExportConsumerSimple`, `xmlToUbForm`이 있다.

이동된 제목이 Viewer에서 `(357.0000007687047, 62)`인 상태로 `savePDF`를 호출했다. `/MYSUIT/ubiform.do` 요청은 `METHOD_NAME=savePDF`, `PROJECT_NAME=sample`, `FORM_ID=sample`, `LOAD_TYPE=div`였고 HTTP 200 `application/pdf`를 반환했다. 1,311-byte 요청에는 Fabric/Canvas JSON, pageData, `left/top`, Render Patch가 없었고 `CHANGE_ITEM_DATA`와 `CHANGE_DATASET`도 비어 있었다.

| 출력 | 현재 Patch 반영 | 판정 근거 |
|---|---|---|
| Viewer | 예 | Fabric 후처리 실측 |
| MySuit 서버 PDF | 아니오 | 원본 폼을 서버에서 별도 렌더 |
| 로컬 PDF/인쇄 실행기 | 아니오로 판단 | 서버 URL·프로젝트·폼 재출력 경로 |
| 브라우저 인쇄 | 예 | 현재 Canvas 출력, 서버 PDF와 별개 |
| Excel/HWP 등 서버 출력 | 아니오로 판단 | 공통 서버 출력 분기 사용 |

## 권장 삽입 지점

제품 JAR을 수정하지 않는 최소 변경 지점은 검수 앱의 출력 어댑터다. PDF 요청 직전에 검증된 source 좌표 Patch로 격리 후보 폼을 만들고, 후보를 `savePDF` 대상으로 지정한 뒤 폐기한다. 데이터 밴드의 특정 `RENDER_INSTANCE`는 원본 좌표와 일대일 대응이 입증되지 않았으므로 임의 변환하지 않고 거부해야 한다. 공식 pageData/instance override가 확인될 때만 전용 경로를 추가한다.

