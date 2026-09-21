# MVP 4.1 Render Position Patch 설계

## 목적

MySuit가 `form.ubjf`를 정상 렌더링한 뒤 기존 Fabric `UBLabel`의 `left/top`만 후처리한다. 위치는 외부 저장소에 `RENDER_INSTANCE` Patch로 보관하며 원본 템플릿, 후보 템플릿, MySuit 제품 파일은 수정하지 않는다.

## 식별 및 범위

- 기본 Draft: `layout_sample_default`
- 식별 키: `layoutDraftId + projectName + formName + pageIndex + viewerObjectId`
- Viewer ID를 서버에서 다시 파싱하여 `sourceObjectId`, `bandId`, `rowIndex`와 일치하는지 검증한다.
- 지원 대상은 최초 렌더에 존재하는 ID 보유 `UBLabel`뿐이다.
- 좌표 범위는 `-5000..5000`, 유한 숫자로 제한한다.
- 객체가 없거나 유형이 다르면 새 객체를 만들거나 유사 객체를 추측하지 않고 `SKIPPED` 처리한다.

## 저장 구조

`mvp3-app/data/render-patches.json`을 임시 파일 작성 후 rename으로 교체한다. 프로세스 내 잠금으로 쓰기를 직렬화한다. 동일 키 PUT은 최초 `before`를 유지하고 `after`만 갱신한다. 감사 이벤트는 `data/audit/render-patch-events.jsonl`에 기록한다.

## API

- `GET /api/render-patches?...`: Draft 위치 Patch 조회
- `PUT /api/render-patches/position`: 생성 또는 갱신
- `DELETE /api/render-patches/:patchId?...`: 소유 Draft 검증 후 개별 삭제
- `DELETE /api/render-patches?...`: 현재 Draft 전체 삭제
- `POST /api/render-patches/events`: 적용/건너뜀 클라이언트 감사 이벤트

## Viewer 적용 순서

1. iframe load 후 Canvas와 최초 객체가 준비될 때까지 제한적으로 재시도한다.
2. Patch 목록을 조회한다.
3. 정확한 `pageIndex` Canvas에서 정확한 `viewerObjectId`를 찾는다.
4. 기존 객체와 `className`을 검증한다.
5. `left/top`, `setCoords()`, `renderAll()` 순서로 적용한다.
6. 결과를 재확인하고 APPLIED 또는 SKIPPED 이벤트를 남긴다.

## 편집 동작

- 검수 모드를 켜면 `속성 편집`과 `위치 이동`을 동시에 활성화한다.
- 위치 모드에서만 지원 UBLabel을 selectable/evented 상태로 만들고 이동 잠금을 해제한다.
- 드래그 시작 좌표를 보존하고 이동 중 현재 좌표와 delta를 표시한다.
- `object:modified`와 `mouse:up`에서 이동 종료를 확정해 마우스를 놓는 즉시 PUT 저장하고, 실패 시 시작 좌표로 즉시 복구한다.
- Arrow는 1px, Shift+Arrow는 10px 이동하며 250ms debounce 후 같은 API로 저장한다.
- Shift 드래그 종료 좌표는 10px 단위로 스냅한다.

## 원복

개별 초기화는 서버 삭제 성공 후 해당 객체를 Patch의 `before`로 복구한다. 실패하면 `after`로 되돌린다. 전체 초기화는 서버 Patch 전체 삭제 후 저장된 모든 `before`를 적용한다.

## 비범위

PDF, Excel, 서버 인쇄, 대량 출력, `form.ubjf` 좌표 변경, 다중 페이지 완전 지원 및 후보에서 사라진 객체의 대체 매핑은 포함하지 않는다.
