# MySuit MVP 4.1 검수 편집 앱

## MVP 4.1 Render Position Patch

검수 편집 모드를 켜면 속성 편집과 위치 이동이 동시에 활성화된다. 기존 UBLabel을 드래그하고 마우스를 놓으면 그 위치가 즉시 저장되며 방향키 이동도 지원한다. 좌표는 `form.ubjf`가 아니라 `data/render-patches.json`에 `RENDER_INSTANCE` 범위로 저장되고, MySuit 렌더 완료 후 정확한 Viewer 객체 ID에 자동 재적용된다.

```bash
scripts/start-mvp41.sh
scripts/test-mvp41.sh
scripts/cleanup-mvp41.sh
```

Arrow는 1px, Shift+Arrow는 10px 이동한다. 개별 `위치 초기화`와 `모든 위치 변경 초기화`를 지원한다. 이 좌표는 Viewer 후처리이며 PDF/Excel/서버 출력에는 반영되지 않는다. 상세 결과는 `docs/13-mvp41-render-position-result.md`에 있다.

> 현재 UI/API는 MVP 3을 보존하면서 MVP 4 Change Set 기능까지 확장되었다.

## MVP 4 변경 사항

MVP 3은 검증된 제목의 text 한 건으로 후보를 만들었다. MVP 4는 여러 객체의 `text`, `fontSize`, `fontWeight`, `textAlign`, `visible`, `width`, `height`를 Change Set에 누적하고 후보 프로젝트 복사 및 form 저장을 각각 한 번만 수행한다. X/Y는 band 렌더 과정에서 재계산됨이 확인되어 UI에서 비활성화한다.

사용 순서:

1. 검수 모드를 켜고 객체를 선택한다.
2. 서버가 반환한 원본 속성과 지원 범위를 확인한다.
3. 여러 필드를 바꾸고 `변경 목록에 추가`를 누른다.
4. 다른 객체에서도 반복한다. 동일 객체·속성은 기존 Patch가 갱신된다.
5. 변경 목록에서 Patch를 수정·삭제하거나 `모든 변경 취소`를 사용한다.
6. `후보 생성` 후 원본/후보/변경 목록 탭으로 비교한다.
7. 필요하면 `변경 객체 강조`를 켠다.
8. `후보 폐기`로 활성 후보를 제거한다.

정적 테이블 Cell은 text/style/visible을 지원하지만 데이터식 Cell의 text와 모든 Cell의 X/Y는 차단된다. `POSITION_MAPPING_UNVERIFIED`, `UNSUPPORTED_PROPERTY`는 안전을 위한 제한이다.

MVP 4 실행·테스트·cleanup:

```bash
scripts/start-mvp4.sh
scripts/test-mvp4.sh
scripts/cleanup-mvp4.sh
```

실행 전에 MySuit Tomcat이 9990에서 동작해야 한다. UI는 `http://localhost:3100`이다. 테스트 결과는 `mvp4-e2e-result.json`, `mvp4-integrity-result.json`, `mvp4-performance.json`에 저장된다.

## 목적과 지원 범위

MySuit 원본 Viewer에서 기존 `UBLabel`을 클릭하고 text 변경 후보를 생성·미리보기·폐기하는 localhost 전용 내부 시연 앱이다. `sample/sample`, `UBLabel.text`, `SOURCE_OBJECT_ALL_INSTANCES`만 지원한다. 원본 저장, 운영 승격, 위치/스타일/표/Band/SQL 편집은 지원하지 않는다.

MVP 5.0 조사 도구는 `scripts/mvp50-discover.js`로 sample UBJF의 명시적 Table/Cell/Band metadata를 읽고 Logical Table Model을 생성한다. `tests/e2e-mvp50-table-discovery.test.js`는 Viewer의 Cell 유래 UBLabel을 Render Instance Key에 연결하고 Table/Column/Row outline 및 10회 반복 안정성을 검증한다. 구조 편집 Patch는 만들지 않는다.

MVP 5.1은 검수 모드에서 본문 Header Cell을 Logical Column으로 선택한다. 화면 왼쪽 아래 Column toolbar에서 너비 적용, 열 숨기기, 선택 열 초기화, 전체 구조 초기화를 사용할 수 있다. 구조 변경은 `data/structure-operations.json`에 별도로 저장되며 원본 UBJF와 Source/Render Patch를 수정하지 않는다. 숨긴 열은 변경 목록의 `다시 표시`로 복원한다.

MVP 5.2에서는 같은 Column toolbar의 `← 이동`/`이동 →`로 logical identity와 24개 member를 유지한 채 시각 순서를 바꿀 수 있다. 오른쪽 아래 `행 모드 켜기`를 누르면 Header/Group Header/Summary 같은 고정 행을 선택해 높이 변경, 숨김, 복원할 수 있다. 데이터 밴드 상세 행은 선택만 가능하고 구조 변경은 차단된다. Row reorder는 Band/data 의미 안전성 때문에 비활성화되어 있다.

MVP 5.3에서는 `표 모드 켜기` 후 본문 Cell을 선택해 Header/Group Header/Detail/Summary의 168개 객체를 하나의 Composite Table로 편집한다. 보라색 상단 grip으로 전체 이동, 우측 handle이나 toolbar로 비율 너비 변경, `편집 화면 접기`로 출력과 무관한 UI collapse, `출력에서 숨기기`로 전체 member hide/restore가 가능하다. Table 높이 자동 scaling과 아래 독립 객체 reflow는 안전성 때문에 비활성화되어 있다.

MVP 5.4의 `ubjf-structure-adapter`는 검증된 Structure Operation을 `sample_mvp54_*` 후보의 네 source UBTable에 원자 적용한다. Column resize/hide/reorder와 고정 Row resize는 MySuit 자체 Viewer 및 서버 PDF까지 반영된다. 원본에는 절대 적용하지 않으며 Cell ID와 binding signature 검증, serialize/reparse 검증, 실패 후보 cleanup을 거친다. 테스트 후보는 종료 시 삭제되고 기존 사용자의 후보는 유지된다.

## 필수 환경

- WSL/Linux, Node.js 20 이상(검증: 24.14.0)
- Java 17, Apache Tomcat 8.5.78
- `/home/tjd618/mysuit-ai-viewer` 프로젝트
- E2E용 프로젝트 로컬 Chromium과 `mysuit-mvp-work/runtime/browser-libs`

외부 npm 패키지는 사용하지 않는다.

## 실행

먼저 프로젝트 루트에서 테스트 Tomcat을 실행한다.

```bash
apache-tomcat-8.5.78/bin/catalina.sh run
```

다른 터미널에서 MVP 앱을 실행한다.

```bash
mysuit-mvp-work/mvp3-app/scripts/start-mvp3.sh
```

브라우저에서 `http://127.0.0.1:3100`에 접속한다. 앱은 외부 인터페이스가 아닌 `127.0.0.1`에만 바인딩한다.

## 사용 방법

MVP 4.4에서는 검수 편집 모드를 켠 뒤 UBLabel을 더블클릭해 문구를 직접 수정할 수 있다. Enter는 저장, Esc는 취소다. 선택 객체 위 floating toolbar에서 글꼴 크기·굵기·정렬을 바꾸고, 객체 컨트롤로 크기를 조정하며, 우클릭 메뉴에서 문구 편집·크기/위치 초기화·숨김·전체 초기화를 실행한다. 위치는 Render Position Patch, 나머지 속성은 기존 Source Patch로 각각 저장된다.

1. `검수 편집 모드 켜기`를 누른다.
2. iframe 안의 `연도별 실적보고서` 제목을 클릭한다.
3. 우측에서 Viewer/source/band/row와 현재 문구를 확인한다.
4. 변경 문구를 입력하고 `후보 생성`을 누른다.
5. 후보 탭에서 서버가 렌더링한 변경 문구를 확인한다.
6. `원본 Viewer` 탭에서 기존 문구를 비교한다.
7. `후보 폐기`를 눌러 후보 프로젝트를 제거한다.

## API

- `POST /api/candidates`: 후보 생성
- `GET /api/candidates`: 목록
- `GET /api/candidates/:candidateId`: 단건 조회
- `DELETE /api/candidates/:candidateId`: 안전한 후보 폐기

브라우저에는 스택과 서버 절대경로를 반환하지 않는다. 후보 이름은 서버만 생성하고 원본 프로젝트 삭제는 이름·경로·메타데이터 검증으로 차단한다.

## 테스트와 무결성

단위/API 테스트:

```bash
cd mysuit-mvp-work/mvp3-app
npm test
```

Tomcat이 실행된 상태의 전체 E2E:

```bash
mysuit-mvp-work/mvp3-app/scripts/test-mvp3.sh
```

결과는 `mysuit-mvp-work/logs/mvp3-e2e-result.json`과 `mvp3-integrity-result.json`, 캡처는 `mysuit-mvp-work/screenshots/mvp3-*.png`에 남는다. 원본 `form.ubjf`와 `info.xml`의 전후 SHA-256이 모두 같아야 성공이다.

## 전체 cleanup

```bash
mysuit-mvp-work/mvp3-app/scripts/cleanup-candidates.sh
```

이 명령은 `candidates.json`에서 ACTIVE인 서버 생성 후보만 폐기한다. 사용자 입력 경로나 `sample` 원본은 삭제 대상으로 사용할 수 없다.

## 제한과 문제 해결

- MySuit Tomcat이 9990에서 먼저 실행돼야 한다. 502이면 Tomcat 상태를 확인한다.
- 다른 프로세스가 3100을 사용하면 `MVP3_PORT`로 바꿀 수 있으나 현재 UI allowlist와 E2E는 3100 기준이다.
- 확인된 단순 합성 ID만 지원한다. underscore가 추가된 복합 ID는 후보 생성이 비활성화된다.
- POC form 파서는 확인된 Base64/zlib/JSON 형식만 지원한다.
- 후보 렌더 캐시는 고유 프로젝트명 최초 호출로 분리한다.
# PRE-AI BASELINE v1.1

후속 Row pointer 안정화 결과는 `docs/54-pre-ai-v11-stabilization-design.md`와 `docs/55-pre-ai-v11-stabilization-result.md`에 기록되어 있다. 현재 판정은 B이며 기존 PRE-AI v1의 AI Planner POC 준비 상태는 유지된다.
