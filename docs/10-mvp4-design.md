# MySuit MVP 4 다중 Patch 설계

## 목표

MVP 3의 안전 경계를 유지하면서 여러 렌더 객체와 여러 속성 변경을 DRAFT Change Set에 누적하고, 후보 프로젝트를 한 번 복사해 메모리에서 모든 Patch를 검증·적용한 뒤 `form.ubjf`를 한 번만 저장한다.

## 실제 원본 구조에 따른 지원 등급

sample 첫 페이지의 직접 원본 `UBLabel`은 `LB6417` 하나다. 나머지 렌더 `UBLabel`은 원본 테이블의 `Cell`이다.

- 직접 `UBLabel` + ROW0: text, fontSize, fontWeight, textAlign, visible, x, y, width, height
- 정적 `Cell`: text, fontSize, fontWeight, textAlign, visible, width, height
- 데이터식 Cell: 원본과 렌더 text가 달라 text 변경 차단; 안전한 style/visible만 허용
- Cell x/y: 부모 테이블·band·row offset이 있으므로 `POSITION_MAPPING_UNVERIFIED`

원본 조회 API가 source class, 원본 값, 기본값, 지원 속성과 좌표 confidence를 반환한다. 브라우저는 이 결과로만 입력을 활성화한다.

## 원자적 후보 생성

```text
DRAFT Change Set
→ 전체 Patch 스키마/ID/source 값 검증
→ 원본 form/info 해시 기록
→ sample 프로젝트를 sample_mvp4_*로 한 번 복사
→ 후보 form을 한 번 파싱
→ width/height → x/y → text/style → visible 순으로 메모리 적용
→ 예상 semantic diff 집합 검증
→ 후보 form 한 번 저장 및 재파싱
→ 모든 최종값 확인
→ 원본 해시 재확인
→ CANDIDATE_ACTIVE
```

한 Patch라도 실패하면 저장 전 중단하거나 후보 프로젝트 전체를 제거하고 Change Set을 FAILED로 기록한다. 부분 후보는 ACTIVE가 될 수 없다.

## Change Set 상태

`DRAFT → CREATING_CANDIDATE → CANDIDATE_ACTIVE → DISCARDED`. 실패는 `FAILED`. 동일 `sourceObjectId + sourceProperty + scope` Patch는 before를 유지하고 after만 갱신한다.

## 안전성

원본 allowlist, 엄격한 Viewer ID, source/band 관계, 후보명/경로 검증, symlink 차단, 속성 whitelist, 타입·범위 검증, 원본 해시, 단일 프로세스 잠금, 원자 상태 저장과 JSONL 감사를 사용한다. 좌표가 검증되지 않은 Cell에는 위치 Patch를 만들지 않는다.
