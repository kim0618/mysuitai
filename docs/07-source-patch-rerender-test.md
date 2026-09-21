# MVP 2단계 원본 Patch 및 서버 재렌더링 결과

## 1. 최종 판정

**B. 부분 가능 유지**

핵심 원본 수정 루프는 모두 성공했다. 다만 합성 ID 생성 코드가 확정되지 않았고 POC 파서 및 band 매핑을 모든 객체 유형으로 일반화할 수 없어 A 대신 B로 판정한다.

## 2. 한 줄 결론

Viewer 객체에서 `LB6417`을 결정적으로 찾아 후보 `form.ubjf`의 text 하나만 구조적으로 바꾼 뒤, 서버 신규 렌더링·새로고침·새 브라우저 세션에서 변경이 유지되고 원본은 무영향임을 확인했다.

## 3. 테스트 환경

- Tomcat: Apache Tomcat 8.5.78, 로컬 포트 9990
- Java: OpenJDK 17.0.13
- 원본 URL: `http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample`
- 후보 URL: `http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample_mvp2`
- 원본 프로젝트: `sample`
- 후보 프로젝트: `sample` 내 별도 폼 `sample_mvp2`
- 원본 폼: `/home/tjd618/mysuit-ai-viewer/apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/sample/form.ubjf`
- 후보 폼(검증 당시): `/home/tjd618/mysuit-ai-viewer/apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/sample_mvp2/form.ubjf`

동일 프로젝트 내 후보 폼 복제를 선택했다. 별도 URL로 최초 호출되어 원본 캐시를 건드리지 않고 로딩할 수 있으며, 검증 후 폴더 단위로 웹앱 밖에 이동할 수 있기 때문이다.

## 4. 원본 무결성

- 테스트 전 SHA-256: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- 후보 생성 후 SHA-256: 동일
- Viewer 검증 후 SHA-256: 동일
- 백업 SHA-256: 동일
- 원본 변경 여부: 없음
- 원본 `info.xml` SHA-256: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e`

## 5. form.ubjf 포맷

- 파일 형식: Base64 텍스트 안의 zlib 압축 JSON
- 인코딩: 외부 Base64 ASCII(CRLF wrapping), 내부 JSON/URL-encoded text
- 압축 여부: zlib/DEFLATE
- 파서 방식: Node.js 표준 `Buffer`, `zlib`, `JSON.parse/stringify`
- 객체 구조: outer JSON → `pages[0]` JSON 문자열 → `items[6]`

## 6. ID 매핑

- Viewer ID: `LB6417_UPHB2584_ROW0`
- sourceObjectId: `LB6417`
- bandId: `UPHB2584`
- rowIndex: 0
- 원본 폼 객체 발견: 정확히 1개
- 매핑 규칙: 관찰상 `<sourceId>_<bandId>_ROW<index>`
- 매핑 확실성: 대상 UBLabel은 source+band+row 및 속성까지 강하게 일치. 전 객체 유형 일반화는 미확정

## 7. 적용 Patch

```json
{
  "reportId": "sample",
  "candidateProjectName": "sample",
  "candidateFormName": "sample_mvp2",
  "baseFormSha256": "020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83",
  "viewerObjectId": "LB6417_UPHB2584_ROW0",
  "sourceObjectId": "LB6417",
  "bandId": "UPHB2584",
  "rowIndex": 0,
  "scope": "SOURCE_OBJECT_ALL_INSTANCES",
  "operation": "updateProperty",
  "property": "text",
  "before": "  연도별 실적보고서",
  "after": "MVP 원본 수정 테스트",
  "temporary": false,
  "candidateOnly": true
}
```

`SOURCE_OBJECT_ALL_INSTANCES`는 현재 렌더 인스턴스 하나가 아니라 원본 설계 객체를 변경하여 그 source에서 파생되는 모든 렌더 인스턴스에 적용한다는 뜻이다.

## 8. 후보 폼 변경

- 후보 SHA-256 전: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- 후보 SHA-256 후: `2446d6c4bf4659f50ae5b3251d51ff1803f8d1a417a35782d733edd5545cfb8e`
- 변경 객체 수: 1
- 변경 속성: `pages/0/items/6/text`
- 기존 값: `  연도별 실적보고서`
- 변경 값: `MVP 원본 수정 테스트`
- 다른 semantic 변경: 없음
- 저장 후 재파싱: 성공

## 9. 서버 재렌더링

- 후보 HTTP 상태: 200
- Viewer 정상 로딩: 성공
- 후보 첫 페이지 객체 수: 180
- 대상 객체 ID: `LB6417_UPHB2584_ROW0`
- 대상 객체 text: `MVP 원본 수정 테스트`
- 새로고침 후 유지: 성공, 객체 수 180
- 새 브라우저 세션 유지: 성공, 객체 수 180
- page error / failed request: 0 / 0
- 런타임 객체 변경 코드 사용: 없음(`runtimeMutationUsed=false`)

캡처는 렌더 DOM 생성까지 대기한 뒤 저장했으며 제목 변경이 실제 화면에 표시됨을 육안 확인했다.

## 10. 원본 비영향 검증

- 원본 객체 text: `  연도별 실적보고서`
- 원본 객체 수: 180
- 원본 SHA-256: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- 후보 변경 유입 여부: 없음
- 원본 HTTP 상태: 200

## 11. 반복 객체 범위

- 동일 source ID 파생 객체 수: 1
- 변경 적용 인스턴스: `LB6417_UPHB2584_ROW0`
- page/row: page 0 / row 0
- text: `MVP 원본 수정 테스트`

대상은 band 소속이지만 이 데이터에서는 한 번만 렌더링됐다. 여러 row에서의 1:N 적용은 이번 결과로 증명하지 않았다.

## 12. 복구 결과

- 후보 복구 방식: 후보 폼 폴더 전체를 `webapps/MYSUIT` 밖 작업 보관소로 이동
- 원본 정상 동작: cleanup 전용 새 Context에서 HTTP 200, 객체 180개, 기존 text로 재확인 성공
- 후보 정리: 활성 경로에서 제거하고 `mysuit-mvp-work/mvp2-candidate-archive/sample_mvp2`에 보관
- 테스트 프로세스 종료: cleanup 검증 성공 후 종료

## 13. 산출물

- 포맷/매핑: `docs/06-form-format-and-id-mapping.md`
- 원본 정보: `mysuit-mvp-work/logs/mvp2-original-form-info.json`
- 구조 diff: `mysuit-mvp-work/logs/mvp2-form-diff.txt`
- Patch: `mysuit-mvp-work/logs/mvp2-applied-patch.json`
- 재렌더 결과: `mysuit-mvp-work/logs/mvp2-rerender-result.json`
- 객체 목록: `mysuit-mvp-work/logs/mvp2-candidate-objects.json`
- 자동화: `mysuit-mvp-work/scripts/mvp2-source-patch-test.js`, `verify-mvp2.js`
- 캡처: `mysuit-mvp-work/screenshots/mvp2-*.png`

## 14. 한계

- sample 첫 페이지의 UBLabel 하나를 수정했다.
- 합성 ID 생성 JavaScript의 단일 원천 코드는 확정하지 못했다.
- table cell은 원본 노드에 직접 band 속성이 없어 일부 매핑은 source-prefix 수준이다.
- 파서는 확인된 포맷용 안전장치를 갖춘 POC이며 제품 버전 전체를 지원하는 공식 파서가 아니다.
- DB, 저장 API, 제품 번들, JAR, 라이선스는 변경하지 않았다.

## 15. 다음 단계

공식 폼 직렬화 규격 또는 제품 파서를 확보하고, 렌더 데이터에 `sourceObjectId`, `bandId`, 안정적인 row key, `baseVersion`을 명시한다. 이후 반복 band 다중 행·테이블 셀·여러 페이지를 대상으로 충돌 및 적용 범위를 검증한다.
