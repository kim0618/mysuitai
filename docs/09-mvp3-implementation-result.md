# MySuit MVP 3 검수 편집 UI/API 구현 결과

## 1. 최종 판정

**A. 내부 시연 가능**

## 2. 한 줄 결론

실제 Viewer의 기존 제목을 마우스로 선택해 UI에서 새 문구를 입력하고, API가 원본 프로젝트 전체 복사본을 구조적으로 Patch한 뒤 후보 Viewer 렌더링·원본 비교·후보 폐기까지 한 흐름으로 완료했다.

## 3. 구현 범위

- `sample/sample` 첫 페이지의 non-empty 기존 `UBLabel`
- `text` 속성 변경
- `SOURCE_OBJECT_ALL_INSTANCES` 고정 범위
- 검수 모드, 객체 선택 정보, 입력 검증, 원본/후보 탭
- 후보 생성/목록/단건/폐기 API
- 프로젝트 단위 잠금, 상태 저장, 감사 로그
- localhost 고정 reverse proxy 및 자동 후보 렌더 검증

위치·크기·스타일·표·Band·SQL·운영 승격·인증은 구현하지 않았다.

## 4. 아키텍처

- MySuit: `http://127.0.0.1:9990/MYSUIT`
- MVP 앱: `http://127.0.0.1:3100`
- `/mysuit/*`, `/MYSUIT/*`: localhost:9990의 고정 `/MYSUIT/*` reverse proxy
- UI와 iframe: 동일 origin이므로 브라우저 보안 비활성화 없이 접근
- 서버: Node.js 24.14.0 표준 라이브러리만 사용
- 후보: `UFile/project/sample_mvp3_...`에 원본 `sample` 프로젝트 전체 복사
- 원본 제품 코드/JAR/JavaScript: 수정 없음

프록시는 임의 URL을 받지 않으며 제품 응답 보안 헤더를 제거하지 않는다. 앱은 `127.0.0.1`에만 바인딩하고 CORS allowlist에 네 개 localhost origin만 둔다.

## 5. Viewer 객체 선택

- Canvas 접근 방식: same-origin iframe의 `canvasModule.getCanvas(0)`
- 연결 방식: 초기 객체 집합 보존 후 Fabric `mouse:down` 이벤트 구독
- 선택 조건: 초기 객체, `UBLabel`, non-empty text, 지원 ID, 사용자 label 제외
- 선택 객체: 제목 UBLabel
- Viewer ID: `LB6417_UPHB2584_ROW0`
- sourceObjectId: `LB6417`
- bandId / row: `UPHB2584` / 0
- className: `UBLabel`
- 기존 문구: `  연도별 실적보고서`

E2E는 Canvas 화면 좌표를 계산해 실제 브라우저 마우스 클릭을 실행했고 우측 패널 값으로 선택 성공을 확인했다. text와 좌표는 변경하지 않았다.

## 6. 후보 생성 API

- 엔드포인트: `POST /api/candidates`
- 조회: `GET /api/candidates`, `GET /api/candidates/:candidateId`
- 최종 E2E 후보 ID: `cand_20260807_131402_7ce8db`
- 후보 프로젝트: `sample_mvp3_20260807_131402_7ce8db`
- 후보 폼: `sample/form.ubjf`
- 적용 객체 수: 1
- semantic diff: `pages/0/items/6/text` 한 경로
- 후보 form SHA-256: `d99385c916f5522e6be82ec58171f6f209be72668a3129553ab3f5b1e42da3b2`
- API 반환 preview URL: `/mysuit/UView5/index.jsp?projectName=sample_mvp3_20260807_131402_7ce8db&formName=sample`

API는 요청 allowlist, 객체 유형/속성/범위, Viewer ID 재파싱, source/band/row 일치, before 값, 객체 유일성 및 band 관계를 다시 검증했다. 복사 후 후보만 재직렬화하고 원본 해시를 전후 확인했다.

## 7. 후보 렌더링

- 후보 HTTP 및 Viewer 로딩: 성공
- 첫 페이지 객체 수: 180
- 대상 객체: `LB6417_UPHB2584_ROW0`
- 변경 문구: `MVP 3 UI 후보 테스트`
- UI 자동검증: 객체 180개 및 대상 text 확인 완료 표시
- 새 프로젝트 최초 호출 렌더: 성공
- 원본 비영향: 객체 180개, `  연도별 실적보고서` 유지

후보 화면에서 runtime `target.set()`이나 `renderAll()`로 문구를 바꾸지 않았다. 후보 파일을 서버가 읽어 만든 렌더 객체를 검사했다.

## 8. 후보 폐기

- 폐기 API: `DELETE /api/candidates/cand_20260807_131402_7ce8db`
- 후보 프로젝트 삭제: 성공
- 상태: `ACTIVE` → `DELETED`
- 활성 `sample_mvp3_*` 폴더: 0개
- 원본 정상: 폐기 후 원본 탭 복귀 및 기존 문구 확인
- 원본 form SHA-256: `020c454c1aef1ff9a6495f8a7501cba52725e58d03bcee493ca8731110ae4f83`
- 원본 info SHA-256: `4fe05421c191e1ee3344db65f51fb54923aa35ee21856d9a294f3c19c6fe502e`

## 9. 테스트 결과

| 테스트 | 결과 | 근거 |
|---|---|---|
| Viewer ID 정상/ROW10/비지원/traversal | 성공 | `viewer-id-parser.test.js` |
| form 단일 Patch/재파싱/원본 해시 | 성공 | `form-patch-service.test.js` |
| 객체 없음/중복/before 불일치/동일 경로 | 차단 성공 | 같은 테스트 |
| 프로젝트 경로 traversal/절대경로/원본명 | 차단 성공 | `candidate-api.test.js` |
| 실제 후보 생성·조회·폐기 | 성공 | API 테스트 및 감사 로그 |
| 실제 Viewer 객체 클릭·패널 표시 | 성공 | `mvp3-object-selected.png` |
| 후보 API·서버 렌더·UI 자동 확인 | 성공 | `mvp3-e2e-result.json` |
| 후보 객체/text | 180개 / `MVP 3 UI 후보 테스트` | E2E JSON 및 캡처 |
| 원본 객체/text | 180개 / 기존 제목 | E2E JSON 및 캡처 |
| 후보 폐기 | 성공 | 상태 DELETED, 활성 폴더 0 |
| 원본 form/info 전후 해시 | 동일 | `mvp3-integrity-result.json` |

초기 E2E 작성 중 Canvas 객체보다 DOM 또는 객체 배열이 늦게 준비되는 두 비동기 조건을 발견했다. Inspector와 자동화가 실제 객체 수 `>0` 및 Canvas DOM을 기다리도록 보강한 뒤 최종 E2E가 성공했다. 실패 시 생성된 후보도 자동 폐기되어 활성 경로에 남지 않았다.

## 10. 보안 및 안전장치

- localhost 전용 bind 및 고정 proxy target
- 제한 CORS, wildcard 미사용
- 브라우저 보안 옵션 비활성화 없음
- source allowlist와 안전한 이름 정규식
- 후보 이름은 서버에서 시간+random으로만 생성
- `path.resolve/relative`로 후보 루트 직접 자식 검증
- 원본 `sample` 삭제 차단
- 후보 ID로 상태 레코드를 조회한 뒤에만 삭제
- form ID 유일성, className, band 관계, before, 단일 diff 검증
- 원본 form/info SHA-256 전후 검증
- 동일 source 잠금 및 `409 LOCKED`
- 상태 파일 원자 rename, 감사 JSONL
- text 제어문자 제거, 200자 제한, DOM `textContent` 사용
- 응답 스택/절대경로 비노출

## 11. 변경 파일

- `mysuit-mvp-work/mvp3-app/`: 별도 UI/API 애플리케이션 전체
- `src/server/`: 서버, 라우트, 후보/폼/복사/무결성 서비스, ID 파서, 잠금
- `src/client/`: iframe UI, Viewer Inspector, 스타일
- `tests/`: 단위/API/E2E
- `scripts/`: Linux/PowerShell 실행·테스트·cleanup
- `data/candidates.json`, `data/audit/candidate-events.jsonl`: 상태 및 감사 이력
- `docs/08-mvp3-design.md`: 설계
- 본 문서와 기존 결과 문서

## 12. 실행 방법

```bash
cd /home/tjd618/mysuit-ai-viewer
apache-tomcat-8.5.78/bin/catalina.sh run
```

다른 WSL 터미널:

```bash
mysuit-mvp-work/mvp3-app/scripts/start-mvp3.sh
```

접속: `http://127.0.0.1:3100`

단위/API 테스트는 `cd mysuit-mvp-work/mvp3-app && npm test`, 전체 테스트는 Tomcat 실행 후 `scripts/test-mvp3.sh`로 수행한다.

## 13. 화면 캡처

- `mysuit-mvp-work/screenshots/mvp3-object-selected.png`
- `mysuit-mvp-work/screenshots/mvp3-candidate-created.png`
- `mysuit-mvp-work/screenshots/mvp3-original-view.png`
- `mysuit-mvp-work/screenshots/mvp3-candidate-view.png`
- `mysuit-mvp-work/screenshots/mvp3-candidate-deleted.png`

## 14. 알려진 제한

- 확인된 단순 합성 ID와 sample UBLabel만 지원한다.
- 메모리 잠금은 단일 MVP 프로세스 기준이며 다중 프로세스 분산 잠금이 아니다.
- 인증/권한은 없으므로 localhost 내부 시연용이다.
- 후보 렌더 검증은 첫 페이지와 선택 source 인스턴스를 검사한다.
- POC form 파서는 제품 전 버전에 대한 공식 파서가 아니다.
- `candidates.json`은 시연용 파일 저장소이며 이력 압축/보존 정책은 없다.

## 15. 다음 단계

정식화하려면 제품 공식 form 직렬화 API, 명시적 `sourceObjectId/bandId/rowKey/baseVersion`, 인증·권한, 다중 프로세스 잠금, 후보 만료 정책과 승인/배포 경계를 추가해야 한다.
