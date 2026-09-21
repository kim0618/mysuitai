# Import MVP 1.0 DIM v1 Schema

## 지원 계약

MVP 1.0은 `version="1.0"`, 단일 794×1123 page, `text` element만 지원한다. 구현은 `mvp3-app/src/server/import/dim-validator.js`, fixture는 `mvp3-app/samples/import/manual-text-only.dim.json`에 있다.

```json
{
  "version": "1.0",
  "page": { "width": 794, "height": 1123 },
  "elements": [{
    "id": "title",
    "type": "text",
    "x": 182, "y": 60, "width": 430, "height": 44,
    "text": "월간 실적 보고서",
    "style": { "fontSize": 24, "bold": true, "textAlign": "center" }
  }]
}
```

## Validation

- version은 정확히 `1.0`.
- page width/height는 양의 유한 number이며 Template과 정확히 같아야 한다.
- elements는 array이고 id는 document 안에서 unique해야 한다.
- element type은 `text`만 가능하다.
- x/y/width/height는 유한 number, width/height는 양수다.
- **부분 overflow도 거부**한다. 모든 Text rectangle이 page 내부에 완전히 포함돼야 한다.
- text는 string이다. 빈 문자열은 허용한다.
- style은 양의 fontSize, boolean bold, `left|center|right` textAlign을 요구한다.
- fontFamily/color/backgroundColor는 현재 generator 계약에서 독립 검증되지 않아 v1에 넣지 않았다.

Error code:

- `IMPORT_DIM_INVALID`
- `IMPORT_DIM_DUPLICATE_ID`
- `IMPORT_DIM_UNSUPPORTED_ELEMENT`
- `IMPORT_DIM_OUT_OF_PAGE`
- `IMPORT_DIM_INVALID_STYLE`
- `IMPORT_TEMPLATE_NOT_FOUND`
- `IMPORT_TEMPLATE_INVALID`
- `IMPORT_LABEL_CREATION_FAILED`
- `IMPORT_SERIALIZATION_FAILED`
- `IMPORT_VIEWER_VALIDATION_FAILED`(E2E/호출 계층 예약)

Import Element Registry는 `import-element-registry.js`에 중앙화됐고 현재 `text: STABLE / prototype-clone`만 등록한다.
