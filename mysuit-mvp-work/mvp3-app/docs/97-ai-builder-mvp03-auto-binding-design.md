# AI Builder MVP 0.3 Auto Binding Design

## Pipeline

`raw JSON → deterministic schema → source target resolver → scalar matcher → persisted proposal → user confirmation → existing binding/history → unified materializer`

Proposal 생성은 History event가 아니다. Apply만 기존 `history.transact`와 `binding-operation-service.replaceScope`를 사용해 하나의 event로 기록한다.

## Schema

Analyzer는 key를 정렬해 `path`, `normalizedPath`, `key`, `type`, `value`, `parentPath`, `depth`, `isLeaf`, `isArray`, `isArrayItem`, `sampleValue`를 생성한다. `string`, `number`, `boolean`만 scalar 후보이며 array leaf는 `DEFERRED_ARRAY`다. 입력 제한은 1 MiB다.

## Target resolution

- Static table: 첫 행의 non-empty header Cell과 같은 열의 다음 행 Cell을 연결한다.
- Standalone: 같은 y축에서 오른쪽 후보가 정확히 하나일 때만 연결한다.
- source `id`가 target identity다. DOM text나 fixture ID를 답으로 사용하지 않는다.
- 후보가 복수면 `BINDING_TARGET_AMBIGUOUS`로 fail-closed 한다.

## Matching

우선순위는 exact, normalized exact, bilingual alias, token, path context다. `AUTO_THRESHOLD=0.88`, `REVIEW_THRESHOLD=0.58`이며 모든 점수는 deterministic하다. 동일 scalar field의 multi-target 사용은 허용하고 target 중복은 차단한다.

## Dataset and apply

Dataset 기본 ID는 `ai_input`이며 충돌 시 `_2`, `_3`을 붙인다. Nested path는 `__` 구분 canonical column으로 변환하고 원래 JSON path mapping을 보존한다. Apply 전에 target/path/scalar/dataset mapping 전체를 검증한 후 임시 candidate를 materialize하고, 기존 Binding Store를 단일 History transaction으로 교체한다.

## Persistence and safety

Schema, proposal, selection, version, generated dataset mapping은 `ai-builder-import-context.json`에 저장한다. 분석 실패는 imported project를 유지하고 proposal만 ERROR로 만든다. invalid target batch는 Binding/History/Candidate를 모두 변경하지 않는다.
