# MVP 5.5 Page Width Policy

## 기준

페이지와 표의 source metadata를 기준으로 계산한다.

| 값 | sample |
|---|---:|
| pageWidth | 794 |
| pageHeight | 1123 |
| marginLeft / marginRight | 0 / 0 |
| Table x | 2 |
| 현재 Table width | 790 |
| 최대 Table width | 792 |
| 남은 폭 | 2 |

`maxTableWidth = pageWidth - marginRight - tableX`다. 현재 sample에는 실용적인 새 Column을 단독 추가할 공간이 없다.

## 적용 대상

- `addStaticColumn`
- `addBoundColumn`
- 기존 `resizeColumn`
- 기존 `resizeTableWidth`
- 향후 Column add/resize 조합

Reorder와 remove/hide처럼 폭을 늘리지 않는 operation도 최종 geometry 검증은 통과해야 한다.

## 정책

1. 모든 operation을 메모리 clone에 적용한다.
2. 네 source Table의 최종 width가 같아야 한다.
3. 최종 width가 `maxTableWidth` 이하여야 한다.
4. 초과하면 후보 저장 전에 전체 작업을 폐기한다.
5. UI/API에는 현재/요청/최대 폭을 반환한다.
6. 최소 Column width는 20이다.
7. 암묵적으로 다른 Column을 축소하지 않는다. 폭 보상은 별도 operation으로 명시한다.

## 오류 형식

```json
{
  "success": false,
  "code": "TABLE_WIDTH_OVERFLOW",
  "message": "표 너비 793는 페이지 출력 가능 폭 792를 넘습니다.",
  "currentWidth": 790,
  "requestedWidth": 793,
  "maxWidth": 792
}
```

## UI

Composite Table 패널은 `현재 / 최대 / 남음`을 표시한다. 숫자 입력과 drag handle은 792에서 제한하며, API가 최종 방어선으로 동일 정책을 다시 적용한다. UI preview가 먼저 움직여도 저장 실패 시 기존 operation을 reload해 rollback한다.

## 출력 안전성

폭 초과 상태의 후보 UBJF와 PDF는 생성하지 않는다. add Column 성공 POC는 기존 Column 0을 30 줄이고 신규 Column 30을 추가해 총 width 790을 유지했다. 이는 페이지를 넓히거나 PDF를 축소하는 방식이 아니라 source geometry 자체를 출력 가능 폭 안에 유지하는 정책이다.
