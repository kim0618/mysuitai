# form.ubjf 포맷 및 Viewer ID 매핑

## 1. 분석 대상과 결론

- 원본: `/home/tjd618/mysuit-ai-viewer/apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/sample/form.ubjf`
- 실제 형식: CRLF로 줄바꿈된 Base64 ASCII → zlib/DEFLATE 압축 → JSON
- 직렬화 구조: 바깥 JSON의 `pages` 원소가 다시 JSON 문자열인 이중 JSON 구조
- 암호화 및 ZIP/GZIP 컨테이너: 확인되지 않음
- 구조적 파싱 및 재직렬화: 성공

확장자나 평문 검색으로 추정하지 않고 Base64 디코딩, zlib 해제, 바깥 JSON 파싱, 각 page JSON 파싱을 차례대로 수행했다.

## 2. 대상 객체의 구조적 위치

| 항목 | 결과 |
|---|---|
| 객체 ID 속성명 | `id` |
| 객체 ID | `LB6417` |
| 객체 위치 | `pages/0/items/6` |
| 발견 개수 | 1 |
| className | `UBLabel` |
| 텍스트 속성명 | `text` |
| 원래 text | URL 인코딩된 `  연도별 실적보고서` |
| 좌표/크기 | x=367, y=100, width=425, height=68 |
| band ID | `UPHB2584` |
| band 발견 개수 | 1 |

`UPHB2584` 정의의 `bandItems`에 `LB6417`이 포함되고, `LB6417` 자체의 band 참조도 `UPHB2584`와 일치한다. 따라서 대상 객체와 band의 관계는 구조적으로 확정됐다. 압축 해제된 page JSON에서 band의 `bandItems` 참조가 객체 정의보다 먼저 나타나며, 객체 정의는 `pages/0/items/6`에 있다. 바이트 오프셋은 재직렬화에 따라 달라지므로 안정 식별자로 사용하지 않았다.

## 3. Viewer 합성 ID 관계

대상 런타임 ID는 `LB6417_UPHB2584_ROW0`이다. 이 객체에서는 다음 분해가 원본 구조 및 렌더 결과와 모두 일치했다.

```text
LB6417   → source object ID
UPHB2584 → band ID
ROW0     → 렌더 행 인덱스 0
```

고정 제목 Label에도 `ROW0`가 붙었다. 대상 source 객체의 실제 파생 인스턴스는 첫 페이지에서 1개뿐이므로 이번 결과만으로 source/render 관계를 항상 1:N이라고 일반화할 수 없다.

## 4. 표본 비교

첫 페이지 런타임 ID 179개 모두 원본 정의의 ID prefix에 연결됐다. 다음은 15개 표본 중 대표 항목이다.

| Viewer ID | source ID | band/row 관찰 | 원본 존재 | 강도 |
|---|---|---|---:|---|
| `LB6417_UPHB2584_ROW0` | `LB6417` | `UPHB2584` / 0 | 예 | source+band+row |
| `IMG4979_UPHB2584_ROW0` | `IMG4979` | `UPHB2584` / 0 | 예 | source+band+row |
| `UB5115957_UPHB2584_ROW0` | `UB5115957` | suffix / 0 | 예 | source-prefix |
| `UB5103966_UPHB2584_ROW0` | `UB5103966` | suffix / 0 | 예 | source-prefix |
| `UB5077625_UPHB2584_ROW0` | `UB5077625` | suffix / 0 | 예 | source-prefix |
| `UB5305348_UDHB4114_ROW0` | `UB5305348` | suffix / 0 | 예 | source-prefix |
| `UB5302287_UDHB4114_ROW0` | `UB5302287` | suffix / 0 | 예 | source-prefix |
| `UB5313710_UDHB4114_ROW0` | `UB5313710` | suffix / 0 | 예 | source-prefix |
| `UB5297739_UDHB4114_ROW0` | `UB5297739` | suffix / 0 | 예 | source-prefix |
| `UB5337756_UDHB4114_ROW0` | `UB5337756` | suffix / 0 | 예 | source-prefix |
| `UB5316883_UDHB4114_ROW0` | `UB5316883` | suffix / 0 | 예 | source-prefix |

전체 15개 표본은 `mysuit-mvp-work/logs/mvp2-id-map-samples.json`에 있다. 재귀 탐색한 원본 정의 49개, 런타임 ID 179개 중 prefix 매핑 179개, 미매핑 0개였다. 다만 table cell 정의에는 자체 band 속성이 없어 source+band+row를 모두 독립 검증한 strong mapping은 2개다.

## 5. 코드 확인 결과와 한계

제품 JavaScript에서 `_ROW` 문자열이 등장하는 위치를 조사했지만 이 합성 ID를 만드는 단일 생성 함수는 확정하지 못했다. 따라서 `<sourceId>_<bandId>_ROW<index>`는 대상 객체에서 구조와 실행 결과로 강하게 확인된 관찰 규칙이지, 모든 객체 유형에 대한 제품 계약으로 선언하지 않는다.

이번 POC 파서는 확인된 sample 포맷을 구조적으로 처리하고, ID 유일성·기존 값·band 관계·재파싱·단일 semantic diff·원본 해시를 모두 검증한다. 제품 전체 버전과 객체 유형을 포괄하는 공식 파서는 아니다.
