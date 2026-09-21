# AI Builder Upload UI Productization 1.0

## 목표

`/ai-builder/import`를 문서 중심의 제품 진입 화면으로 개편한다. 사용자는 HWPX 또는 이미지를 필수 문서로 선택하고 JSON은 선택적으로 연결한다. 이미지 분석 결과가 있을 때만 고급 옵션에서 DIM을 제공한다.

## 기존 계약 재사용

- Client/server 제한: 문서 10MB, JSON 1MB, DIM 5MB
- HWPX: `analyzeHwpx` → DIM 1.3 → `createImportedProject`
- Image: 검증된 이미지 또는 업로드 DIM → 기존 Import Generator
- JSON: 기존 `ai-builder-import-context.json`에 선택 저장
- 완료: 서버의 `builderUrl`(`/ai-builder?projectName=...&layoutDraftId=...`) 사용

새 Import Engine과 HWP fallback은 추가하지 않는다.

## UX 상태

`IDLE → FILE_SELECTED → READY → PROCESSING → SUCCESS`를 기본 흐름으로 사용하며 검증/서버 오류는 `ERROR`로 전환한다. 퍼센트 대신 문서 확인, 구조 분석, 서식 생성, 편집 화면 준비의 실제 단계만 표시한다.

## 입력 정책

- HWPX: DIM 입력을 숨기고 바로 가져오기 가능
- PNG/JPG/JPEG: 현재 서버 정책상 알려진 검증 이미지 또는 유효한 DIM 필요
- JSON: 비어 있어도 가져오기 가능; 파일/직접 입력의 크기와 문법 검증
- HWP: HWPX 재저장 안내와 함께 즉시 차단
- 중복 문서 선택: 동일 이름/크기의 현재 선택 파일은 재추가하지 않음

## 반응형 및 접근성

- 1280px 이상에서 232px sidebar, 유동 main, 336px info panel
- 1120px 이하에서 sidebar 70px 및 info panel 하단 배치
- 760px 이하에서 단일 열 및 info panel 숨김
- 파일 input label, keyboard dropzone, focus 표시, aria label/live/alert 적용

## 인증 범위

브라우저 E2E는 1440×900 및 1024px 화면, HWPX only, HWPX+JSON, Image+DIM, HWP 차단, 오류 표시, 처리 상태, Builder redirect와 Viewer canvas 렌더를 검증한다.
