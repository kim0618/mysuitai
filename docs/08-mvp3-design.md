# MySuit MVP 3 설계

## 범위

별도 localhost 애플리케이션에서 MySuit Viewer를 same-origin reverse proxy iframe으로 표시하고, 기존 `UBLabel` 클릭 → text 입력 → 후보 프로젝트 생성 → 후보 Viewer 확인 → 후보 폐기를 연결한다. 원본 제품 코드, 원본 프로젝트, DB, 라이선스는 수정하지 않는다.

지원 범위는 `className=UBLabel`, `property=text`, `scope=SOURCE_OBJECT_ALL_INSTANCES`, `projectName=sample`, `formName=sample` 하나다.

## 구성

```text
Browser http://127.0.0.1:3100
├─ /                         정적 검수 UI
├─ /api/candidates           후보 생성/조회/폐기 API
├─ /mysuit/*                 localhost:9990/MYSUIT/* 고정 프록시
└─ /MYSUIT/*                 Viewer 내부 절대경로용 고정 프록시

Tomcat http://127.0.0.1:9990/MYSUIT
└─ UFile/project/
   ├─ sample/                읽기 전용 원본
   └─ sample_mvp3_.../       일시 후보 프로젝트
```

MVP 서버는 `127.0.0.1:3100`에만 바인딩한다. 프록시 목적지는 설정된 localhost Tomcat 하나로 고정하며 사용자 URL을 받지 않는다. 브라우저 보안 기능과 제품 응답 헤더를 우회하지 않는다.

## 후보 생성 트랜잭션

1. 요청 스키마와 고정 지원 값 검증
2. Viewer ID를 엄격한 형식으로 재파싱하고 요청 source/band/row와 비교
3. 원본 form/info 해시 기록
4. `projectName+formName` 메모리 잠금 획득
5. 서버 생성 고유 후보명으로 원본 프로젝트 전체 복사
6. 후보 form을 Base64 → zlib → outer/page JSON으로 구조 파싱
7. source ID와 band 관계, 기존 text, 객체 유일성 확인
8. 후보 객체의 text 한 속성만 변경해 재직렬화
9. 재파싱 및 semantic diff 한 경로 확인
10. 원본 해시 재확인, 상태와 감사 이벤트 원자 저장
11. 후보 URL 반환

중간 실패 시 후보 경로만 제거하고 원본 해시를 다시 확인한다. 동일 원본 요청은 잠금 중 `409 LOCKED`를 반환한다.

## 객체 선택

UI가 iframe 로딩 후 `canvasModule.getCanvas(0)`을 얻어 초기 객체 목록을 `Set`으로 보존한다. 검수 모드에서 Fabric `mouse:down` 이벤트를 구독하며 초기 객체인 non-empty `UBLabel`, 유효한 지원 ID만 선택한다. 선택은 우측 패널 상태로 표시하고 원본 객체의 text/좌표는 바꾸지 않는다. Fabric의 일시 selection 상태는 후보에 저장되지 않는다.

## 안전 경계

- 입력 프로젝트/폼은 allowlist와 안전한 이름 정규식 모두 통과해야 한다.
- 후보명과 경로는 서버만 생성한다.
- 모든 해석 경로가 후보 루트의 직접 자식인지 `path.resolve/relative`로 재검증한다.
- 원본 경로와 후보 경로가 같거나 후보명이 패턴에 맞지 않으면 생성/삭제하지 않는다.
- 응답에는 스택과 절대경로를 노출하지 않는다.
- text는 제어문자를 제거하고 200자로 제한하며 HTML로 삽입하지 않는다.
- 상태 파일은 임시 파일 후 rename으로 원자 갱신한다.
- 감사 로그는 JSON Lines append-only다.

## 테스트 전략

- Node 내장 test runner: ID 파서, form parser/Patch, 경로 차단, API 검증
- 실제 E2E: Tomcat + MVP 서버 + Chromium, UI 클릭부터 후보 생성/렌더/원본 비교/폐기까지 수행
- E2E 전후 원본 `form.ubjf`, `info.xml` SHA-256 동일성 기록
- 테스트 종료 시 모든 `sample_mvp3_*` 활성 후보와 두 프로세스를 정리
