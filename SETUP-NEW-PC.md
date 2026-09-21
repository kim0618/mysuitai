# 다른 PC에서 이어서 작업하기

Git 저장소에는 소스·문서·테스트·검증 산출물과 Tomcat 기본 파일만 들어 있다. 아래 항목은 저장소에 없으므로 기존 PC에서 직접 옮기거나 새로 준비해야 한다.

## 1. 반드시 옮길 것 (저장소에 없음)

| 대상 | 이유 |
|---|---|
| `apache-tomcat-8.5.78/webapps/MYSUIT/` | MySuit 제품 본체(UView5 Viewer, WEB-INF). 원본 폼과 가져온 프로젝트(`UFile/project`)도 이 안에 있다. 공개 저장소라 커밋하지 않았다. |
| `apache-tomcat-8.5.78/conf/server.xml` | 없으면 Tomcat이 시작되지 않는다(포트 9990 설정 포함). 사내 DB 비밀번호가 평문으로 들어 있어 커밋하지 않았다. |

옮기지 않아도 되는 것: `temp/`, `work/`, `logs/`는 Tomcat이 다시 만든다.

## 2. 새 PC에 준비할 것

- **경로**: `mysuit-mvp-work/mvp3-app/src/server/config.js`가 `/home/tjd618/mysuit-ai-viewer`를 고정으로 쓴다. 같은 경로에 clone하거나 이 값을 바꾼다.
- **Java 17**: 기존 PC는 `JAVA_HOME=$HOME/opt/jdk-17.0.13+11` (`~/.bashrc`). Tomcat 실행에 필요한 `--add-opens` 옵션은 `bin/catalina.sh`에 들어 있어 저장소로 함께 온다.
- **Node.js**: npm 의존성은 없다. 기존 PC는 v24.
- **사내 DB**: `server.xml`의 DataSource가 사내 MySQL(`192.168.0.64:3307`)을 가리킨다. MYSUIT가 이 DB를 쓰는 기능은 사내망에서만 동작할 수 있다.

## 3. 실행

```bash
cd /home/tjd618/mysuit-ai-viewer
apache-tomcat-8.5.78/bin/startup.sh          # Viewer, 9990
cd mysuit-mvp-work/mvp3-app && npm start      # AI Builder 개발 서버, 3100
```

- 생성하기: http://127.0.0.1:3100/ai-builder/import
- 종료: `apache-tomcat-8.5.78/bin/shutdown.sh`, 개발 서버는 해당 node 프로세스 종료

## 4. 테스트까지 돌리려면

- 단위 테스트: `cd mysuit-mvp-work/mvp3-app && node --test --test-concurrency=1 $(ls tests/*.test.js | grep -v '/e2e')`
- E2E는 추가로 필요하다(저장소에 없음):
  - Playwright: 테스트 코드가 `/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`와 `~/.cache/ms-playwright/chromium-1223`을 고정 경로로 쓴다.
  - 브라우저 공유 라이브러리: `mysuit-mvp-work/runtime/browser-libs` (기존 PC에서 복사)
  - Editing V2 E2E의 HWPX 원본: `mysuit-mvp-work/uploads/ai-builder/ai_builder_import_muavril6_6d066a71/__.hwpx`
  - 일부 예전 E2E(mvp043 등)는 `mysuit-mvp-work/mvp3-app/data/`의 기존 draft 기록과 `UFile/project`의 특정 import 프로젝트를 기대한다.
  - `e2e-mvp58-history`는 개발 서버를 `MVP58_TEST_FAILURE=1`로 띄워야 통과한다.
