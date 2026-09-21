# MySuit MVP 4 다중 Patch 검수 편집 구현 결과

## 1. 최종 판정

**B. 다중 Patch 핵심 가능, 위치 속성 미완료**

## 2. 한 줄 결론

두 객체의 네 속성을 하나의 Change Set으로 누적·검토·삭제·재추가하고 후보 폼에 원자적으로 적용해 서버 렌더링과 원본 비교 및 폐기까지 성공했으나, band가 좌표를 재계산해 X/Y 위치 Patch는 안전하게 비활성화했다.

## 3. 구현 범위

- DRAFT Change Set 생성/조회/폐기
- Patch 추가, 동일 키 갱신, 수정, 삭제, 전체 취소
- 원본 속성 조회 및 객체별 지원 범위
- text, fontSize, fontWeight, textAlign, visible, width, height
- 원자적 다중 Patch 후보 생성
- 원본/후보/변경 목록 탭과 변경 객체 강조
- 상태 파일, 잠금, 감사 로그, rollback, 후보 cleanup

## 4. Change Set 구조

상태는 `DRAFT`, `CREATING_CANDIDATE`, `CANDIDATE_ACTIVE`, `FAILED`, `DISCARDED`다. 식별 키 `sourceObjectId + sourceProperty + scope`가 같으면 before는 유지하고 after만 갱신한다. 후보 생성 후 Patch는 잠긴다.

API:

- `POST /api/change-sets`
- `GET/DELETE /api/change-sets/:id`
- `POST/DELETE /api/change-sets/:id/patches`
- `PUT/DELETE /api/change-sets/:id/patches/:patchId`
- `POST /api/change-sets/:id/candidate`
- `GET /api/source-object`

## 5. 지원 객체 및 속성

| 객체 | 속성 | 결과 | 제한 |
|---|---|---|---|
| 직접 원본 UBLabel | text/style/visible/width/height | 성공 | sample 검증 범위 |
| 정적 Cell→렌더 UBLabel | text/style/visible/width/height | 성공 | 원본 정적 text가 런타임과 일치해야 함 |
| 데이터식 Cell | style/visible | 제한 지원 | text는 식 손상 방지를 위해 차단 |
| UBLabel/Cell | x/y | 비활성화 | band 렌더가 source y를 재계산하여 runtime top 미반영 |
| 기타 객체 | 전체 | 미지원 | whitelist 밖 |

지원 원본 속성은 `text`, `fontSize`, `fontWeight`, `textAlign`, `visible`, `width`, `height`다. `left/top`의 원본 매핑은 `x/y`지만 렌더 검증 실패로 API가 `POSITION_MAPPING_UNVERIFIED`를 반환한다.

## 6. Viewer 편집 UI

선택 시 주황 점선 테두리와 Viewer/source/band/row, 렌더/원본 유형, 좌표 confidence를 표시한다. 원본 조회가 성공한 필드만 활성화하며 Cell의 X/Y는 비활성화한다. 입력은 후보 생성 전 원본 파일에 반영되지 않는다.

## 7. 변경 목록

총 객체/Patch/미지원 수, 속성명, before/after, 수정·삭제를 표시한다. 동일 객체·동일 속성 재추가는 Patch 갱신이며, 전체 취소로 DRAFT Patch를 비운다. 최종 E2E는 Patch 4건 → 1건 삭제 → 3건 → 재추가 → 4건 흐름을 통과했다.

## 8. 다중 Patch 후보 생성

- Patch 수: 4
- 변경 객체 수: 2 (`LB6417`, `UB5302287`)
- 후보 프로젝트: 최종 실행의 서버 생성 `sample_mvp4_*`
- 후보 폼: `sample/form.ubjf`
- 적용 성공: 4건 모두 성공
- 저장 횟수: 후보 form 1회
- 부분 적용: 없음
- 실패 원자성: 잘못된 두 번째 Patch 테스트에서 후보 전체 삭제, 활성 후보 0

## 9. 속성별 검증 결과

| 속성 | before | after | 후보 반영 | 원본 비영향 |
|---|---|---|---|---|
| text | `  연도별 실적보고서` | `  2026년 연도별 실적보고서` | 성공 | 성공 |
| fontSize | 32 | 30 | 성공 | 성공 |
| width | 425 | 440 | 성공 | 성공 |
| visible (`2013`) | true | false | 성공: 렌더 객체 제외 | 성공 |
| y 실험 | source 100→95 | runtime top 100 유지 | 미지원 판정 | 원본 보존 |

숨김 객체가 후보 렌더 목록에서 제외되어 후보 객체 수는 179개, 원본은 180개였다.

## 10. 원본/후보 비교

탭은 원본, 후보, 변경 목록을 제공한다. 변경 목록에는 4건의 최종 before/after가 표시된다. 강조 옵션은 후보 메모리 상단 Canvas에 번호와 점선 테두리만 그리고 후보 form에는 저장하지 않는다.

## 11. 후보 폐기

`DELETE /api/candidates/:candidateId`로 후보 프로젝트를 제거하고 후보 상태를 DELETED, Change Set을 DISCARDED로 바꿨다. 테스트 종료 후 활성 `sample_mvp4_*` 프로젝트는 0개다.

## 12. 원본 무결성

- form.ubjf before/after: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83` / 동일
- info.xml before/after: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e` / 동일
- 원본 Viewer: 객체 180개, 제목 text/fontSize/width 및 2013 표시 유지

## 13. 성능

최종 E2E 실측:

| 항목 | 시간 |
|---|---:|
| 객체 선택+원본 조회 | 166 ms |
| 첫 3-Patch 추가 | 83 ms |
| 후보 API 생성 | 81 ms |
| 후보 Viewer 렌더 준비 | 906 ms |
| 후보 폐기+새 Change Set | 62 ms |
| 전체 E2E | 7,334 ms |

## 14. 테스트 결과

- 단위/API 파일 7개 모두 통과
- property whitelist/범위/enum/NaN/0 이하 차단
- 직접 Label/정적 Cell 지원과 좌표 차단 검증
- Change Set 생성/upsert/수정/삭제/초기화/폐기
- 4-Patch 단일 저장 및 재파싱
- 일부 Patch 실패 rollback, 원본 해시, 활성 후보 0
- 실제 UI 다중 객체 E2E 성공

## 15. 변경 파일

- `src/server/routes/changeset-routes.js`
- `src/server/services/changeset-service.js`
- `src/server/schemas/patch-schema.js`
- `src/server/utils/property-mapper.js`
- 확장된 `form-patch-service.js`, `project-copy-service.js`, `candidate-service.js`
- 교체된 MVP 4 client UI/Inspector
- `tests/property-mapper.test.js`, `coordinate-mapping.test.js`, `changeset-service.test.js`, `multi-patch-api.test.js`, `e2e-mvp4.test.js`
- MVP 4 실행/테스트/cleanup 스크립트

## 16. 실행 방법

Tomcat 9990 실행 후:

```bash
cd /home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/mvp3-app
scripts/start-mvp4.sh
```

접속: `http://localhost:3100`

## 17. 화면 캡처

- `mvp4-object-properties.png`
- `mvp4-multiple-patches.png`
- `mvp4-patch-deleted.png`
- `mvp4-candidate-created.png`
- `mvp4-original-view.png`
- `mvp4-candidate-view.png`
- `mvp4-changed-objects-highlighted.png`
- `mvp4-candidate-deleted.png`

## 18. 알려진 제한

- X/Y 위치 이동은 원본 y 변경이 runtime top에 반영되지 않아 비활성화했다.
- Cell width/height는 테이블 레이아웃과 상호작용할 수 있어 직접 Label보다 confidence가 낮다.
- 미리보기는 후보 생성 전 원본 객체 속성을 바꾸지 않는다. 목록 기반 검토만 제공한다.
- Patch 수정 UI는 MVP용 prompt이며 정식 편집 폼이 아니다.
- 단일 프로세스 파일 저장소와 메모리 잠금이다.

## 19. 다음 단계

band별 좌표 산식과 table layout 규격을 확보한 뒤 위치/Cell 크기를 다시 검증한다. 정식화 시 공식 form API, 인증, 분산 잠금, Change Set 복제/재시도, 후보 만료를 추가한다.
