# MVP 5.6 Collapse Safety Policy

## Hide와 Collapse

```text
Hide     = 출력 제거 + 기존 flow height 유지
Collapse = 출력 제거 + flow height 제거 + 검증된 후속 구조 재배치
```

`visible=false`만으로 Collapse 성공 처리하지 않는다. 두 기능은 UI와 Operation Store에서 별도 operation이다.

## 허용 근거

Collapse는 다음을 모두 만족해야 한다.

1. target source identity가 하나로 결정됨
2. Band/section membership이 metadata로 확인됨
3. collapsed height가 source height와 반복 cardinality로 계산됨
4. 후속 flow 관계가 source order와 실측 height dependency로 확인됨
5. Page Header/Footer가 reflow 대상에서 제외됨
6. rowSpan, grouping, aggregate, page-break dependency가 없음
7. 후보 저장 후 reparse와 실제 Viewer/PDF 검증 가능

하나라도 충족하지 못하면 `VERTICAL_REFLOW_UNVERIFIED`다.

## 오류

| 코드 | 의미 |
|---|---|
| `VERTICAL_REFLOW_UNVERIFIED` | source flow dependency 미확정 |
| `UNSUPPORTED_ROWSPAN_DEPENDENCY` | target이 merged rowSpan과 연결됨 |
| `DATA_ROW_STRUCTURE_EDIT_REJECTED` | 반복 Data row/template 변경 시도 |
| `SOURCE_TABLE_STRUCTURE_MISMATCH` | 검증된 source identity/shape 불일치 |

오류가 발생하면 후보를 저장하지 않고 해당 MVP 5.6 후보만 제거한다.

## Scope

- `SAME_BAND`: 같은 Band의 source order와 follower가 확인된 경우
- `SAME_SECTION`: 하나의 검증된 Band chain 전체
- `CROSS_BAND_VERIFIED`: 실제 height delta가 후속 Band runtime top에 동일하게 반영된 관계
- `UNSUPPORTED`: 좌표 외의 dependency 근거가 없음

sample에서 지원되는 것은 Header Row의 `CROSS_BAND_VERIFIED`와 Composite BODY의 `SAME_SECTION`뿐이다.

## Footer/Pagination

Page Footer의 source y를 BODY collapse delta만큼 변경하지 않는다. Footer 위치는 page engine에 맡긴다. 페이지 수 감소 자체는 허용하지만 object duplication, 누락, footer overlap, header 위치 오류는 실패다.

현재 sample은 1페이지이고 collapse 전후 1페이지를 유지했다. 다중 페이지 일반화는 미검증이다.

## Restore/Replay

Restore는 현재 좌표에 collapsedHeight를 다시 더하지 않는다. original model에서 남은 Structure Operation을 권장 순서대로 다시 적용한다.

```text
add/remove → column reorder/resize/hide → row resize/hide
→ row collapse → table width → table hide/collapse → table move
→ source/render patches → editor state
```

Collapse 대상과 resize/hide가 충돌하면 source candidate validator가 최종 geometry와 capability를 다시 평가해야 한다.
