# MVP 결과 이력

## MVP 4.1 판정

**A — Viewer Render Position 편집 시연 가능.** 기존 `UBLabel`을 실제 드래그해 `(367,100) → (397,80)`으로 이동하고 별도 `RENDER_INSTANCE` Patch에 저장했다. iframe 새로고침과 새 Browser Context에서 위치가 유지됐고, 개별 원복·Shift+Arrow 10px 이동·전체 원복·재새로고침도 성공했다. 객체 수는 180개로 유지됐으며 `form.ubjf`, `info.xml`, MySuit UView5 제품 트리 해시는 전후 동일하다. 상세는 `docs/12-mvp41-render-position-design.md`, `docs/13-mvp41-render-position-result.md`에 있다.

## 판정 이력

- 초기 정적 분석 판정: D
- 초기 사유: 원본 WAR 및 실행 환경 미확인
- 재개 후 런타임 판정: **B. 부분 가능**
- 재개 사유: 실제 원본 객체의 텍스트·위치 변경, Canvas 재렌더링 및 복구에는 성공했지만 Viewer ID가 원본 ID를 그대로 보존하지 않고 렌더링 문맥을 붙인 합성 ID이기 때문
- MVP 2 원본 Patch 판정: **B. 부분 가능 유지**
- MVP 2 사유: 대상 UBLabel의 후보 원본 Patch→서버 재렌더링→새로고침/새 세션 유지→원본 비영향 루프는 성공했지만, 합성 ID 생성 코드와 전 객체 유형 매핑 및 공식 포맷 파서는 미확정
- MVP 3 검수 편집 UI/API 판정: **A. 내부 시연 가능**
- MVP 3 사유: 실제 Viewer 객체 클릭, 정보 표시, text 입력, 후보 프로젝트 전체 복사와 구조 Patch, 후보 서버 렌더, 원본 비교, 후보 폐기 및 원본 form/info 해시 유지 E2E가 모두 성공

## MVP 3 핵심 결과

- 별도 앱: `http://127.0.0.1:3100`, localhost 전용
- reverse proxy iframe으로 제품 수정이나 브라우저 보안 해제 없이 Canvas 접근
- 실제 `LB6417_UPHB2584_ROW0` 마우스 선택 및 우측 패널 표시
- `POST /api/candidates`로 고유 후보 프로젝트 생성, 한 객체/한 속성만 변경
- 후보 180개 및 `MVP 3 UI 후보 테스트`, 원본 180개 및 기존 제목 확인
- `DELETE /api/candidates/:id`로 후보 폐기, ACTIVE 후보 0개
- 원본 form/info SHA-256 전후 동일
- 상세: `docs/09-mvp3-implementation-result.md`

## MVP 4 판정

- MVP 4 다중 Patch 실무형 데모: **B. 다중 Patch 핵심 가능, 위치 속성 미완료**
- 두 객체/네 Patch의 누적, 수정·삭제·전체 취소, 단일 후보 복사·단일 form 저장, 서버 렌더, 비교, 강조, 폐기 E2E 성공
- text 1건, fontSize 1건, width 1건, visible 1건 동시 반영
- 잘못된 중간 Patch가 있으면 후보 전체 rollback 및 활성 후보 0 확인
- X/Y는 source y 변경이 runtime top에 반영되지 않아 추측 적용을 중단하고 UI/API에서 차단
- 상세: `docs/11-mvp4-implementation-result.md`

## MVP 2 핵심 결과

- 원본 `form.ubjf` SHA-256 before/after 동일: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- Viewer `LB6417_UPHB2584_ROW0` → source `LB6417`, band `UPHB2584`, row 0 매핑 성공
- 후보 `sample_mvp2`의 `LB6417.text` 한 항목만 구조적으로 변경
- 후보 Viewer HTTP 200, 객체 180개, text `MVP 원본 수정 테스트`
- 새로고침 및 새 BrowserContext 유지 성공
- 원본 Viewer 객체 180개 및 기존 text 유지
- Viewer 런타임 객체 변경 없음

상세 결과는 `docs/06-form-format-and-id-mapping.md`와 `docs/07-source-patch-rerender-test.md`에 있다.

## 실제 검증 결과

1. 원본 리포트 객체가 Canvas 내부에 개별 객체로 존재하는가: **예**. 첫 페이지 Fabric Canvas에 객체 180개가 존재했다.
2. 페이지 전체가 이미지 한 장인가: **아니오**. UBLabel 178개, UBImage 1개, dummy 1개가 개별 객체로 존재했다.
3. 원본과 주석 객체 구분: 최초 로딩 객체, `className`, ID와 원본 폼 비교로 테스트 대상을 원본으로 확인했다. 해당 페이지 UBSignature는 0개였다. 모든 객체에 명시적인 `origin` 값이 있는 것은 아니다.
4. 객체 ID: 179개가 `id` 보유, `itemId` 보유 객체는 0개였다.
5. 원본 텍스트 임시 변경: **성공**. `"  연도별 실적보고서"` → `"MVP 테스트"`.
6. 원본 위치 임시 변경: **성공**. `top` 100 → 90.
7. Canvas 재렌더링: **성공**. 기존 객체에 `set`, `setCoords`, `renderAll`을 호출했고 화면에서 확인했다.
8. 원상복구: **성공**. 텍스트와 top 모두 복구되었고 복구 이미지 SHA-256이 변경 전 이미지와 동일했다.
9. Report Patch: 실제 Viewer ID로 2건 생성했다.
10. 원본 ID 연결: **부분 연결**. Viewer ID `LB6417_UPHB2584_ROW0`은 원본 객체 `LB6417`, 원본 band `UPHB2584`, 런타임 row `ROW0`의 합성값이다.

## 필수 수치

| 항목 | 결과 |
|---|---|
| 실제 Viewer URL | `http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample` |
| 페이지 Canvas 수 | 1 |
| DOM canvas 수 | 7 |
| 첫 페이지 객체 수 | 180 |
| UBLabel 수 | 178 |
| UBImage 수 | 1 |
| UBSignature 수 | 0 |
| 텍스트 객체 수 | 157 |
| id 보유 객체 수 | 179 |
| itemId 보유 객체 수 | 0 |
| className 보유 객체 수 | 179 |
| 선택 객체 | `UBLabel`, index 0 |
| 선택 객체 id | `LB6417_UPHB2584_ROW0` |
| 선택 객체 itemId | `null` |
| 텍스트 변경 | `  연도별 실적보고서` → `MVP 테스트` |
| top 변경 | 100 → 90 |
| 텍스트 테스트 객체 수 | 180 → 180 |
| 위치 테스트 객체 수 | 180 → 180 |
| 복구 | 성공 |
| form.ubjf ID 일치 | 전체 문자열 불일치, 원본 `LB6417`+band `UPHB2584`와 파생 연결 확인 |

## 실제 Report Patch

실제 결과는 `mysuit-mvp-work/logs/runtime-patches.json`에 있다. Viewer ID는 런타임 합성 ID이므로 서버 저장 식별자로 곧바로 사용해서는 안 된다.

```json
[
  {
    "reportId": "sample",
    "baseVersion": null,
    "pageIndex": 0,
    "objectId": "LB6417_UPHB2584_ROW0",
    "objectType": "UBLabel",
    "operation": "updateProperty",
    "property": "text",
    "before": "  연도별 실적보고서",
    "after": "MVP 테스트",
    "temporary": true
  },
  {
    "reportId": "sample",
    "baseVersion": null,
    "pageIndex": 0,
    "objectId": "LB6417_UPHB2584_ROW0",
    "objectType": "UBLabel",
    "operation": "updateProperty",
    "property": "top",
    "before": 100,
    "after": 90,
    "temporary": true
  }
]
```

## 변경 및 안전성

- `webapps/MYSUIT`와 원본 `form.ubjf`는 수정하지 않았다.
- 변경은 브라우저 메모리에서만 수행하고 같은 세션에서 복구했다.
- 신규 Canvas 객체를 추가하지 않았다.
- 서버 저장 API와 DB는 호출하지 않았다.
- 라이선스 파일은 정상 로딩만 확인했으며 변경하거나 우회하지 않았다.
# MVP 4.2 추가 메모

Render Position Patch의 출력 검증 결과는 `docs/14-mvp42-output-pipeline-analysis.md`와 `docs/15-mvp42-output-patch-result.md`를 따른다. 현재 외부 `RENDER_INSTANCE` Patch는 Viewer 후처리이며 서버 PDF 요청에는 전달되지 않는다. 안전한 후속 POC는 검증 가능한 source 좌표만 격리 후보 폼에 적용해 서버 출력하는 방식이다.

# MVP 4.1.1 안정화 추가 메모

중복 Viewer ID를 renderIndex와 원본 fingerprint로 구분하는 Render Instance Key를 도입했다. 최신 UI의 드래그, 새로고침, 모드 전환, 키보드, 실패 rollback과 중복 객체 독립 이동·초기화가 실제 E2E로 통과했다. 상세는 `docs/16-mvp411-position-stability-design.md`, `docs/17-mvp411-position-stability-result.md`를 따른다.
# MVP 4.4 업데이트

Viewer 내부 UBLabel 직접 편집은 판정 **B**다. 더블클릭 문구 편집, Enter 저장/Esc 취소, floating toolbar, width/height 정규화 resize, 숨김/복원 및 기존 위치 Patch 회귀가 성공했다. 실제 포인터 모서리 resize의 완전 자동화가 남아 A 판정은 보류한다. 상세는 [MVP 4.4 결과](21-mvp44-direct-editing-result.md)를 참고한다.

# MVP 5.0 업데이트

Table Structure Discovery 최종 판정은 **B**다. sample에는 명시적 `UBTable` 5개와 `UBApproval` 1개가 있고, 본문 7열은 Header 1 + Group Header 3 + Detail 17 + Summary 3의 Column별 24개 Render Instance로 안정적으로 복원됐다. 새로고침 5회와 새 페이지 5회 구조 서명이 동일했다. 다만 네 source Table을 하나의 업무 표로 묶는 직접 parent ID가 없어 Band 역할·source schema·dataset binding을 합성해야 한다. 상세는 [구조 조사](22-table-structure-discovery.md), [논리 모델](23-logical-table-model.md), [연산 가능성](24-table-operation-feasibility.md)을 참고한다.

# MVP 5.1 업데이트

Logical Column Direct Editing 판정은 **B**다. 한 Column의 24개 member 선택, handle resize, 오른쪽 열 reflow, hide+collapse, restore, multiple operation과 10회 replay가 성공했다. composite parent ID와 multi-column span 일반화, Column reorder는 제한으로 유지한다. 상세는 [MVP 5.1 결과](26-mvp51-column-editing-result.md)를 참고한다.

# MVP 5.2 업데이트

Logical Column Reorder + Logical Row Editing 판정은 **B**다. Column identity와 binding을 유지한 Viewer-level reorder, resize/hide 조합, fixed Row 선택·높이·hide/restore와 결정적 replay가 성공했다. Rendered Detail Row 구조 변경은 UI/API에서 차단했다. fixed Row reorder는 Band hierarchy와 summary 의미를 안전하게 보존할 근거가 없어 제한했다. 상세는 [MVP 5.2 결과](28-mvp52-column-row-result.md)를 참고한다.

# MVP 5.3 업데이트

Composite Logical Table Direct Editing 판정은 **B**다. 네 source UBTable에서 구성된 168개 member를 하나의 표로 선택해 실제 drag 이동, 비율 너비 변경, Editor collapse/expand, 전체 hide/restore와 복합 replay에 성공했다. 독립 Band 안전성이 확인되지 않은 아래 비소속 객체의 output collapse reflow는 제한했다. 상세는 [MVP 5.3 결과](30-mvp53-table-editing-result.md)를 참고한다.

# MVP 5.4 업데이트

UBJF Structure Adapter와 서버 출력 판정은 **A**다. resizeColumn/hideColumn/moveColumn을 네 source UBTable의 wrapper/Cell 구조로 원자 변환했고, Structure replay 없는 후보 Viewer와 MySuit 서버 PDF에 반영됐다. Cell ID와 dataset/binding/summary expression/border가 유지됐다. 고정 Row resize도 성공했지만 Row hide와 Table hide의 공간 collapse는 제한되며 Excel entrypoint는 확인되지 않았다. 상세는 [Adapter 결과](32-mvp54-ubjf-structure-adapter-result.md)와 [서버 출력 결과](33-mvp54-server-output-result.md)를 참고한다.

# MVP 5.5 업데이트

Add/Remove Structure와 Page Width Guard 판정은 **A**다. Static Column/Row의 실제 Cell ID 생성과 제거, 기존 Dataset field만 사용하는 제한 Bound Column이 후보 UBJF, MySuit Viewer, 서버 PDF까지 성공했다. sample의 페이지 폭 794와 Table x 2를 기준으로 최대 폭 792를 계산하며, 기존 resize API와 신규 add adapter 모두 초과 상태를 저장 전에 `TABLE_WIDTH_OVERFLOW`로 차단한다. 상세는 [MVP 5.5 결과](35-mvp55-add-remove-structure-result.md)와 [폭 정책](36-mvp55-page-width-policy.md)을 참고한다.

# MVP 5.6 업데이트

Vertical Reflow / Output Collapse 판정은 **A**다. Header Row의 33px collapse는 다음 Group Header와 이후 BODY 전체를 정확히 33px 위로 재배치했고, Composite Table collapse는 네 BODY Band의 source flow 654px와 168개 렌더 객체를 제거했다. Page Footer는 top 1086에 유지됐다. 일반 Same-Band/Cross-Band는 안전 표본이나 dependency 근거가 없어 `VERTICAL_REFLOW_UNVERIFIED`로 차단한다. 상세는 [MVP 5.6 결과](38-mvp56-vertical-reflow-result.md)와 [안전 정책](39-mvp56-collapse-safety-policy.md)을 참고한다.
