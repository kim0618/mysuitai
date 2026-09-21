# MySuit Viewer 런타임 객체 변경 테스트

## 1. 실행 환경

- 실행 일시: 2026-08-07 (Asia/Seoul)
- OS: Linux/WSL2
- Java: OpenJDK 17.0.13
- WAS: Apache Tomcat 8.5.78
- HTTP 포트: 9990
- Context Path: `/MYSUIT`
- 브라우저: Playwright + 프로젝트 로컬 라이브러리를 사용하는 headless Chromium
- 테스트 대상: `apache-tomcat-8.5.78/webapps/MYSUIT` 및 sample 폼
- 라이선스: `UFile/sys/SYS/lic.dat` 로드 로그 확인, 실패 메시지 없음; 우회 없음

## 2. 실제 Viewer URL

`http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample`

- HTTP 상태: 200
- Viewer 로딩: 성공
- page error: 0
- failed request: 0

## 3. Canvas 인스턴스 탐색 결과

DOM에는 Canvas 7개가 있었다. 리포트 페이지는 다음 Fabric 계층 하나로 확인됐다.

- `canvas#ubicanvas0.lower-canvas`: 1588×2246 내부 픽셀, 794×1123 CSS 크기
- 같은 `.canvas-container`의 `canvas.upper-canvas`: 동일 크기
- `canvasModule.getCanvas(0)`: `getObjects()`와 `renderAll()` 호출 가능한 실제 Fabric Canvas

페이지 Canvas 수는 1이다. 나머지 5개 DOM Canvas는 서명·카메라 마스킹 등 부가 기능용이며 표시 크기가 0이었다. 전체 목록은 `mysuit-mvp-work/logs/runtime-canvases.json`에 저장했다.

## 4. 페이지 객체 통계

| 구분 | 수 |
|---|---:|
| 전체 객체 | 180 |
| UBLabel | 178 |
| UBImage | 1 |
| UBSignature | 0 |
| dummy | 1 |
| 비어 있지 않은 text 보유 | 157 |
| id 보유 | 179 |
| itemId 보유 | 0 |
| className 보유 | 179 |

객체 목록은 `mysuit-mvp-work/logs/runtime-page0-objects.json`에 있다. 페이지가 통이미지 한 장이 아니라 개별 텍스트/이미지 객체로 구성됨을 실행으로 확인했다.

## 5. 선택한 원본 객체

```json
{
  "index": 0,
  "type": "borderLabel",
  "className": "UBLabel",
  "id": "LB6417_UPHB2584_ROW0",
  "itemId": null,
  "text": "  연도별 실적보고서",
  "left": 367,
  "top": 100,
  "width": 425,
  "height": 68,
  "selectable": false,
  "evented": true
}
```

선택 근거는 페이지 최초 로딩 시 존재했고, 제목으로 화면에 원래 표시되며, `UBLabel`이고, `editLblItem`/signature 계열이 아니며, 원본 폼에서 같은 객체와 band를 확인했기 때문이다.

## 6. 텍스트 변경 결과

- 변경 전: `  연도별 실적보고서`
- 변경 후: `MVP 테스트`
- 수행 API: 기존 객체 `set({text})`, `setCoords()`, Canvas `renderAll()`
- 객체 수: 180 → 180
- 속성 변경: 성공
- 화면 변경: `text-changed.png`에서 확인
- 신규 객체 추가: 없음

## 7. 위치 변경 결과

- 변경 전 top: 100
- 변경 후 top: 90
- 변화량: -10
- 수행 API: 기존 객체 `set({top})`, `setCoords()`, Canvas `renderAll()`
- 객체 수: 180 → 180
- Canvas viewport transform: `[2,0,0,2,0,0]`으로 테스트 전후 변경하지 않음
- 화면 이동: `position-changed.png`에서 제목 객체만 위로 이동한 것을 확인

## 8. 원상복구 결과

- 텍스트 복구: 성공
- top 복구: 성공(90 → 100)
- 최종 객체 수: 180
- 변경 전, 텍스트 복구, 위치 복구 이미지 SHA-256: 모두 `2acac7e260b91ac8454d980f0d15d097c3770e9a5618add65062f0576e6f8974`
- 판정: 픽셀 단위로 원상복구 확인

## 9. Viewer ID와 form.ubjf ID 비교

- 원본 폼: `apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/sample/form.ubjf`
- 원본 형식: Base64로 표현된 zlib 압축 JSON
- Viewer 전체 ID: `LB6417_UPHB2584_ROW0`
- 원본 객체 ID: `LB6417`
- 원본 band ID: `UPHB2584`
- 원본 속성: `className=UBLabel`, text는 URL 인코딩된 동일 제목, x=367, y=100, width=425, height=68

Viewer 전체 ID가 원본 객체 ID와 정확히 같지는 않다. 관찰된 구성은 `<원본객체ID>_<bandID>_ROW<렌더행>`이며 이번 객체는 양쪽 속성이 모두 일치한다. 따라서 원본 연결은 확인되지만 명시적인 `sourceObjectId`가 아니라 문자열 규칙에 의존하므로 **부분 연결**로 판정한다.

## 10. 실제 Report Patch

`mysuit-mvp-work/logs/runtime-patches.json`에 실제 ID로 텍스트 및 top Patch 2건을 저장했다. `baseVersion`은 제공되지 않아 null이다. 이 Patch는 임시 변경 표현이며 서버 저장에는 사용하지 않았다.

## 11. 화면 캡처

- 변경 전: `mysuit-mvp-work/screenshots/before-change.png`
- 텍스트 변경: `mysuit-mvp-work/screenshots/text-changed.png`
- 텍스트 복구: `mysuit-mvp-work/screenshots/text-restored.png`
- 위치 변경: `mysuit-mvp-work/screenshots/position-changed.png`
- 위치 복구: `mysuit-mvp-work/screenshots/position-restored.png`

## 12. 오류 및 제한

- 최초 WSL Chromium 실행은 시스템 `libnspr4.so` 부재로 실패했다. 전역 설치 없이 필요한 세 `.deb`를 `mysuit-mvp-work/runtime/browser-libs`에만 압축 해제해 해결했다.
- 브라우저 console에는 비표준 viewport key와 password-form 관련 경고만 있었고 page error와 failed request는 없었다.
- `itemId`는 첫 페이지 어떤 객체에도 없었다.
- Viewer ID는 원본 ID에 band/row 문맥이 붙은 합성 ID이다. 반복 band의 행 추가·정렬·필터 변경 시 suffix 안정성을 별도 검증해야 한다.
- 원본/사용자 객체를 모든 종류에서 일반화하는 명시적 `origin` 필드는 확인되지 않았다.
- 테스트는 sample 폼 첫 페이지의 한 UBLabel에 한정된다.

## 13. 최종 판정

**B. 부분 가능**

원본 객체의 개별 존재, 실제 텍스트/위치 변경, `renderAll()`, 객체 수 유지, 화면 변경 및 완전 복구가 모두 성공했다. 다만 Viewer ID가 원본 폼 ID와 동일한 불변 ID가 아니라 파생 합성값이고 `sourceObjectId`, `origin`, `baseVersion`이 없으므로 정식 개발 전 메타데이터 보강이 필요하다.

## 14. MVP 2 후속 검증

MVP 1의 메모리 변경 결과를 지우지 않고, MVP 2에서 `LB6417_UPHB2584_ROW0`을 원본 `LB6417`에 매핑해 별도 후보 폼을 구조적으로 Patch했다. Viewer 객체를 런타임에서 변경하지 않은 상태로 서버가 후보를 신규 렌더링했고, 최초 로드·새로고침·새 BrowserContext에서 `MVP 원본 수정 테스트`가 유지됐다. 원본은 기존 text와 파일 SHA-256을 유지했다.

- MVP 1 정적 판정: D
- MVP 1 런타임 판정: B
- MVP 2 원본 Patch 판정: B(핵심 루프 성공, 전 객체 매핑/공식 파서 미확정)
- 상세: `docs/07-source-patch-rerender-test.md`
