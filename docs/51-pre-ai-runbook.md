# PRE-AI Baseline Runbook

작업 위치는 `/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/mvp3-app`이다.

```bash
npm run test:pre-ai
```

Runner는 원본/사용자 후보 해시를 기록하고, 필요할 때만 Tomcat과 Node 서버를 기동하며, unit/API/History/Adapter/MVP 5.7/5.8/5.9/Viewer/PDF 회귀를 순차 실행한다. 종료 trap은 Runner가 직접 켠 서버만 끈다. 성공 시 테스트 후보와 runtime draft를 정리하고 `mysuit-mvp-work/logs/pre-ai-*.json`을 갱신한다.

성공 조건은 7개 검증군 PASS, 원본 두 파일과 사용자 후보 트리 해시 동일, 테스트 후보 0개다. 실패 시 최종 signature를 기준선으로 사용하지 말고 해당 로그를 먼저 분류한다.
