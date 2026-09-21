# MVP 5.6 Vertical Reflow 설계

## Source Layout

sample 첫 페이지의 Band source order는 다음과 같다.

```text
UPHB2584 Page Header       height 300
UDHB4114 Data Header       height 33  → TB3039
UGHB7543 Group Header      height 27  → TB3979
UDB3195  Data Band         height 27  → TB5514
UGFB0223 Group Footer      height 27  → TB8715
UPFB9094 Page Footer       height 37  → TB7301
```

Page Header에는 제목, 이미지, Approval이 있고 Page Footer에는 날짜/페이지 번호 Table이 있다. BODY section의 네 Band에는 각각 본문 Composite Table을 구성하는 UBTable 하나만 있다. 같은 BODY Band 안에 Table 이후의 별도 Static Object는 없다.

## Flow Graph

노드는 Band, Composite member Table, Static Object다. 다음 edge만 source metadata와 기존 실측 근거로 확정했다.

- `INSIDE`: object.band와 bandItems가 일치
- `AFTER`: page item source order의 Band chain
- `DEPENDS_ON_HEIGHT`: `UDHB4114 → UGHB7543 → UDB3195 → UGFB0223`

MVP 5.4에서 Header Band height를 `33→45`로 바꿨을 때 다음 Group Header runtime top이 `333→345`로 같은 delta만큼 이동했다. 따라서 Header에서 이후 BODY Band로 이어지는 높이 의존성은 `CROSS_BAND_VERIFIED`로 분류한다.

좌표가 아래에 있다는 이유만으로 edge를 만들지 않는다. Page Header/Footer는 일반 BODY follower가 아니다.

## Collapsed Height

Dataset payload를 원본에서 inflate해 실제 반복 수를 계산한다.

| 역할 | 인스턴스 | 높이 | 합계 |
|---|---:|---:|---:|
| Header | 1 | 33 | 33 |
| Group Header | 3 | 27 | 81 |
| Detail | 17 | 27 | 459 |
| Summary | 3 | 27 | 81 |
| 합계 | 24 rows | | 654 |

Viewer-derived bounds만 사용하지 않고 source Band height와 Dataset cardinality를 대조한다.

## collapseRow

최초 지원 대상은 `UDHB4114`의 단일 Header Static Row다.

1. `TB3039.visible=false`와 Cell output hide
2. `TB3039.height=0`
3. `UDHB4114.height=0`
4. MySuit Band flow engine이 후속 BODY runtime top을 33만큼 재계산

source Band의 절대 y를 임의 변경하지 않는다. Band order와 height가 layout input이고 runtime 위치는 MySuit가 계산한다.

Group Header는 grouping boundary, Summary는 aggregate footer, Data는 반복 template이므로 collapse를 차단한다. Approval row는 `rowSpan=2` dependency 때문에 `UNSUPPORTED_ROWSPAN_DEPENDENCY`다.

## collapseTable

검증된 `ctbl:main-report-table`의 네 Table을 숨기고 네 BODY Band height를 모두 0으로 만든다. scope는 `SAME_SECTION`이다. BODY section의 source flow height는 654에서 0이 된다.

sample에는 BODY section 뒤의 일반 body follower가 없다. 따라서 임의 객체 Y 이동은 하지 않으며 Page Footer는 source `y=1086`, runtime top 1086을 유지한다. 이는 Footer 보호 정책이다.

## Capability

| 대상 | Hide | Collapse | Scope |
|---|---:|---:|---|
| Header Static Row | 가능 | 가능 | CROSS_BAND_VERIFIED |
| Group Header | 가능 | 불가 | UNSUPPORTED |
| Summary | 가능 | 불가 | UNSUPPORTED |
| Rendered Detail | 불가 | 불가 | UNSUPPORTED |
| Composite BODY Table | 가능 | 가능 | SAME_SECTION |
| Same-Band follower | 가능 | 표본 없음 | UNSUPPORTED |
| 일반 Cross-Band | 가능 | 불가 | UNSUPPORTED |

## 원자성 및 Restore

후보 clone에서 전체 operation을 검증한 뒤 한 번 저장하고 reparse한다. Restore는 delta를 반대로 더하지 않고 collapse operation을 제거한 base source 전체 replay로 표현한다. E2E에서는 원본 후보를 다시 로드해 객체 수와 위치가 정확히 복원되는지 확인한다.
