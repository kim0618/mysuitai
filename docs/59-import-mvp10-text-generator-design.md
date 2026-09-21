# Import MVP 1.0 Text Generator Design

## 흐름

```text
Manual DIM
  -> validateDim
  -> clone sample/SampleReport_FreeForm into .creating
  -> select static LB8872 prototype
  -> createImportedLabel × N
  -> replace cloned page.items
  -> writeForm + readForm validation
  -> import-meta.json
  -> atomic rename to import_mvp10_*
  -> UView5 -> savePDF
```

구현 파일:

- `src/server/import/dim-validator.js`
- `src/server/import/import-element-registry.js`
- `src/server/import/import-label-generator.js`
- `src/server/import/import-project-service.js`

## Label 생성

`createImportedLabel({prototype, element, targetBand, idContext})`는 deep clone, collision-free ID, page geometry, URL-encoded text, fontSize, bold→fontWeight, textAlign, static field sanitization을 책임진다. Prototype에 없는 schema를 새로 추측하지 않는다.

기존 Template 객체 정책은 C다. cloned project의 prototype을 포함한 기존 배경 Image/Table/Label을 제거하고 clone만 남긴다. 원본 Template에는 영향이 없다. 이 정책이 FreeForm에서 안전함은 serialize/reparse, Viewer 5 Label, PDF HTTP 200으로 검증했다.

## ID와 mapping

- Source: `IMPLB0001..N`; import 실행마다 DIM 순서에 대해 deterministic하다.
- Viewer: FreeForm에서는 Source ID 그대로다.
- Render identity metadata: `p0|c0|src:<id>|band:FREEFORM|row:0|idx:<renderIndex>`.
- 기존 `viewer-id-parser.js`는 band 합성 ID 전용이므로 FreeForm identity를 아직 resolve하지 않는다.

## Service와 failure atomicity

Service는 path/name validation 후 Template form folder만 복사한다. materialization과 reparse가 끝나기 전에는 `.creating`에 머문다. 어떤 단계에서든 실패하면 Import prefix project만 제거하고 Template hash를 확인한다. Imported Form과 기존 Candidate는 의미적으로 분리했다.

## 향후 구조

```text
External Document -> Analyzer -> DIM -> DIM Validator
  -> MySuit Import Generator -> Imported Form -> Viewer -> Existing Editor
```

MVP 1.0은 Manual DIM부터 Imported Form/Viewer/PDF까지만 구현했다. Table/Image/Line/Rectangle은 Element Registry에 아직 등록하지 않았다.
