# Import MVP 1.2 Editor Generalization Audit

Editor attach 흐름은 client `app.js` → Viewer Inspector → Source/Render/Structure/History APIs → Target Resolver/Capability → Candidate adapters 순서다. 조사 결과 sample 결합은 다음 세 부류였다.

## A. 제거 가능

Generic attach의 `canvas.getObjects().length === 180`, app의 고정 Viewer URL, 고정 ChangeSet/Render scope는 일반 Editor의 안전 조건이 아니므로 제거했다.

## B. 일반화 필요

- readiness: non-empty Fabric canvas와 upper canvas를 확인한 뒤 object ID/class/geometry signature가 연속 두 번 같을 때 attach한다.
- FormContext: `projectName/formName/origin/kind`를 명시한다. 임의 프로젝트는 허용하지 않고 `sample/sample` 또는 유효한 `import-meta.json`을 가진 Import 프로젝트만 허용한다.
- stores: Source Patch, Render Patch, Structure, History를 모두 `draft + project + form`으로 격리한다.
- identity: sample suffix ID와 함께 Imported raw Source ID `IMPLB…/IMPCL…`를 검증한다. FreeForm은 명시적으로 `FREEFORM` render identity와 빈 source band를 매핑한다.
- candidate: Imported Base도 읽기 전용 원본으로 취급하고 별도 `mvp12` candidate에만 기록한다.

## C. sample 특수 로직

`tbl:financial-7col`, `ctbl:main-report-table`, 네 UBTable 합성, 168 members, Approval Table ID/band 규칙은 삭제하지 않았다. `COMPOSITE_SAMPLE` adapter에 남기고 Imported Form은 `STATIC_SINGLE` adapter/controller를 사용한다. 전체 목록과 분류는 `logs/import-mvp12-hardcoded-dependencies.json`에 있다.
