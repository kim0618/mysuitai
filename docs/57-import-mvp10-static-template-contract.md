# Import MVP 1.0 Static Template Contract

## 선택 결과

Template은 `sample/SampleReport_FreeForm`이다.

- `form.ubjf`: `apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/SampleReport_FreeForm/form.ubjf`
- `info.xml`: 같은 폴더의 `info.xml`
- Viewer: `/MYSUIT/UView5/index.jsp?projectName=sample&formName=SampleReport_FreeForm`
- 선택 이유: 1 page, dataset 0, band 0인 FreeForm이며 top-level static UBLabel 5개가 존재한다.
- 제외 후보: `SampleReport_ConnectLink`는 dataset 0이지만 4 page/UBDocArea이고 Label prototype이 없다. 다른 후보는 dataset 또는 data/group band 의존성이 있었다.

## Page 계약

| 항목 | 값 |
|---|---|
| report/project type | 1 / FreeForm |
| page count | 1 |
| width / height | 794 / 1123 |
| margin | UBJF에 명시되지 않음 |
| orientation | portrait(치수 기반 판정) |
| dataset | `[]` |
| body/static band | 없음 |
| object collection | `pages[0].items` |
| coordinate | page-absolute x/y; band 변환 없음 |

MVP 1.0 DIM은 Template과 같은 794×1123만 허용한다. scaling은 하지 않는다. FreeForm이므로 `sourceY=dimY`이며 `band=""`를 유지한다.

## UBLabel prototype

Prototype은 `LB8872`다. `className=UBLabel`, `band=""`, dataset/column/systemFunction이 빈 값이고 formula가 없다. 주요 property는 id, className, x/y/width/height, text, fontSize, fontWeight, textAlign, verticalAlign, fontFamily, borderSide와 border type이다.

생성 계약:

1. Prototype을 deep clone한다.
2. ID를 `IMPLB0001`부터 deterministic sequence로 부여하고 전체 Template ID와 collision 검사한다.
3. x/y/width/height를 DIM 값으로 덮는다.
4. text는 `encodeURIComponent`, style은 fontSize/fontWeight/textAlign에 매핑한다.
5. 실제 prototype에 존재하는 dataSet/column/systemFunction만 빈 값으로 정규화하고 formula가 있으면 제거한다.
6. Imported clone의 기존 `page.items`를 모두 제거하고 생성된 Label만 삽입한다. 원본 Template은 수정하지 않는다.

FreeForm Viewer는 Source ID를 그대로 Viewer ID로 사용한다. 실측 관계는 `title -> IMPLB0001 -> IMPLB0001`이다. 일반 Render Instance 표현에는 band가 없음을 명확히 하기 위해 adapter-side sentinel `FREEFORM`을 사용한다. 이는 기존 sample Viewer ID parser에 바로 전달하는 값이 아니라 Import metadata용 identity다.

## Project/Form 계약

- 원본: `sample/SampleReport_FreeForm`.
- Imported project: `import_mvp10_<YYYYMMDD>_<HHMMSS>_<6hex>`.
- Imported formName: `SampleReport_FreeForm` 유지.
- Template form folder만 새 project 아래로 복제한다.
- `info.xml`은 width=794, height=1123, type=1, form_id=SampleReport_FreeForm이므로 그대로 보존한다.
- `import-meta.json`은 project root에 sidecar로 두며 UBJF에 미지의 metadata를 삽입하지 않는다.
- Viewer URL: `/mysuit/UView5/index.jsp?projectName=<importProject>&formName=SampleReport_FreeForm`.
- PDF 조건: UView5 load 후 `canvasModule.captureAll(); mainModule.callService('savePDF')`.

## 원자성과 보호

`.creating` 임시 project에 clone/materialize/serialize/reparse/metadata 저장을 끝낸 후 최종 이름으로 rename한다. 실패하면 이번 Import prefix의 임시/최종 project만 제거한다. Template form/info hash는 성공과 실패 모두 재검증한다.
