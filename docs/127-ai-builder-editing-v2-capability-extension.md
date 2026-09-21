# AI Builder Editing Workspace 2.0 Capability Extension

## 1. HWPX로 만든 서식을 편집하기에서 열 수 있게 함

생성하기가 만드는 `import_mvp13_*` 프로젝트는 서버 `form-context-service`와 클라이언트 `app.js`의 허용 정규식에 빠져 있어 편집하기에서 열리지 않았다(서버는 `SOURCE_PROJECT_NOT_FOUND`, 클라이언트는 sample로 대체). 두 곳 모두 `import_mvp1[0-3]`으로 넓혔다.

## 2. 가져온 정적 표: N개 표 + 병합 셀

`static-table-model-service`는 이제 페이지의 모든 UBTable을 각자 독립 Logical Table(`tbl:static:<tableId>`)로 모델링한다. 표 선택은 key(`logicalTableKey`, 행/열 key, `sourceTableId`)에서 표 ID를 뽑아 결정하고, 키가 없는데 표가 여럿이면 `STATIC_TABLE_AMBIGUOUS`로 막는다. 이름 `STATIC_SINGLE`은 호환을 위해 유지하며 의미는 "가져온 정적 표"다.

병합 표기: 시작 셀은 `status: MS` + `rowSpan/colSpan`, 가려진 칸은 cell 없는 `MC` wrapper다. 행 높이/열 너비는 `rowHeight`/`columnWidth`에서 읽는다.

## 3. Structure Adapter 재작성 (`static-table-structure-adapter`)

- 행·열은 **기준 인덱스(원본 위치)가 정체성**이다. 모든 연산은 원본 행/열을 가리키고, 앞선 이동과 무관하게 같은 대상을 찾는다. (기존 `moveColumn`은 두 번째 이동부터 현재 위치를 원본 위치로 오인하는 잠재 버그가 있었고 함께 고쳤다.)
- 크기는 행/열 배열에 두고, 끝에서 한 번에 좌표를 다시 계산한다(병합 시작 셀은 걸친 트랙 합).
- 미리보기와 저장이 같은 규칙을 쓴다: `layout()`이 메모리에서 같은 변환을 돌려 셀 좌표를 돌려주고, 클라이언트는 그 좌표만 그린다. 서버 검증도 같은 변환을 "적용해보기"로 판정한다.
- 연산 없이 계산한 좌표는 원본 HWPX 좌표와 186개 셀 전부 일치한다(Viewer 실측).

### 신규 연산

| 연산 | 계약 |
|---|---|
| `moveRow` | 입력 `logicalRowKey`(원본 행), `toRowIndex`(현재 보이는 순서 기준). 서버가 `fromRowIndex`, `rowCellIds`를 채운다. 적용 시 행 셀 ID가 다르면 `STATIC_TABLE_IDENTITY_CHANGED`. append-only(같은 행을 두 번 옮기면 두 연산). |
| `removeRow` | 원본 행 삭제. 셀 ID만 빠지고 나머지 셀 ID·문구는 그대로여야 통과. `removedCellIds` 기록. |

### 병합 규칙 (fail-closed)

- 범위 [a,b]를 재배열하는 이동은 모든 병합 블록에 대해 "블록 안쪽" 또는 "블록 바깥"일 때만 허용한다. 걸치면 `ROWSPAN_DEPENDENCY` / `COLSPAN_DEPENDENCY`.
- 블록 안에서 재배열하면 시작 셀을 블록 좌상단으로 되돌린다(`reanchor`).
- 병합이 시작되는 행은 숨김·삭제 불가. 병합에 덮인 행을 삭제하면 해당 병합의 `rowSpan`을 1 줄인다.
- 병합이 시작되는 열은 숨김 불가. 표 전체를 덮는 제목행 아래의 열 이동은 허용된다(HWPX 표 대부분이 이 구조).

### 삭제와 연결의 정책

- 데이터가 연결된 셀이 있는 행: 거부(`BOUND_ROW_REMOVE_REJECTED`). 원본 셀 연결과 draft binding 연산을 모두 검사
- 직접 수정한 셀이 있는 행: 거부(`EDITED_ROW_REMOVE_REJECTED`)
- Unified Materializer는 `removedCellIds`를 삭제 대상에 포함해, 같은 대상에 대한 source/binding 연산이 있으면 저장을 실패시킨다. 조용히 남는 연결은 없다.

## 4. Unified Materializer

- 구조 연산을 표별로 묶어 각각 적용한다(이전: 표 1개만 허용).
- 소스 패치 적용 시 viewer 속성을 원본 속성으로 변환한다(`left→x`, `top→y`). 이전에는 `item.left`에 써서 위치 변경이 저장본에 반영되지 않았다.

## 5. Image Source Adapter

| Capability | 연산 | 원본 속성 |
|---|---|---|
| IMAGE_RESIZE | `resizeObject` | `width`, `height` |
| IMAGE_MOVE | `moveObject` (신규) | `x`, `y` |
| IMAGE_VISIBILITY | `hideObject`/`restoreObject` | `visible` |
| IMAGE_FIT | `setImageFit` (신규) | `scaleType`: 맞춤=1(비율 유지), 채우기=0(늘이기), 원본=3(원본 크기 가운데). Viewer `uImage._render` 분기를 확인해 매핑 |
| IMAGE_REPLACE | `replaceImage` (신규) | `data` |

이미지 교체는 내용 주소형 저장소를 쓴다.

- `POST /api/image-assets`: PNG/JPEG/GIF 매직 바이트 검사, 1MB 이하, sha256 파일로 temp→rename 원자 저장 → `asset:<sha256>` 반환
- 패치에는 참조만 기록한다. 원본 값은 `inline:<sha256>`로 표현해 history 스냅샷에 이미지 본문이 복제되지 않는다.
- 저장 시 Materializer가 참조를 원본과 같은 인코딩(URL 인코딩 base64)으로 풀어 `UBImage.data`에 쓴다. 파일 해시가 다르면 `IMAGE_ASSET_CORRUPTED`.
- Undo는 패치를 제거하므로 원래 이미지가, Redo는 새 이미지가 돌아온다.

표 셀과 밴드 안 라벨은 X/Y를 노출하지 않는다(표 셀 좌표를 직접 바꾸면 표가 깨짐). 자유배치 라벨과 이미지만 위치를 편집한다.

## 6. Workspace JSON

- `PUT /api/ai-builder/context/json`: 기존 `parseJson` 검증 → Import Context 저장 → 기존 proposal 생성. 실패하면 이전 파일로 원자 복구.
- 변경 시 충돌 검사: 이미 적용된 단일 연결의 `jsonPath`, 적용된 반복 데이터의 `arrayPath`가 새 JSON에 모두 있어야 한다. 없으면 `DATA_BINDING_CONFLICT`(409, 없는 경로 목록 포함)를 화면에 보여준다.
- `DELETE /api/ai-builder/context/json`: 연결이 하나라도 남아 있으면 `DATA_IN_USE`(409). 사용자는 연결 해제나 실행 취소 후 제거한다.
- 단일 항목의 "연결 안 함"(`selectedPath` 비움)을 지원한다.

## 7. Registry

`moveRow`, `removeRow`, `moveObject`, `setImageFit`, `replaceImage` 추가(총 32). Merge/Unmerge는 이번에도 노출하지 않는다.
