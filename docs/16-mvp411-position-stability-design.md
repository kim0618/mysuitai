# MVP 4.1.1 위치 편집 안정화 설계

## 목표

Viewer 위치 편집의 선택·드래그·저장·재적용·초기화를 동일 렌더 인스턴스에 한정하고, `viewerObjectId` 중복 때문에 첫 객체가 잘못 이동하는 구조를 제거한다.

## 확인된 원인

sample 첫 페이지 180개 중 중복 ID 그룹은 2개다. `UB5103966_UPHB2584_ROW0`는 `대표이사/사장/부사장` 세 객체가 공유하고, `UB5077625_UPHB2584_ROW0`도 빈 셀 세 객체가 공유한다. 따라서 ID 기반 `find()`는 안전하지 않다.

iframe `load`, Patch 조회, MySuit 최종 Canvas 교체가 서로 다른 시점에 발생해 Inspector가 중간 Canvas에 중복 연결되는 경쟁 상태도 있었다.

## Render Instance Key

```text
p{pageIndex}|c{canvasIndex}|src:{sourceObjectId}|band:{bandId}|row:{rowIndex}|idx:{renderIndex}
```

예: `p0|c0|src:UB5103966|band:UPHB2584|row:0|idx:3`

- 주 식별자: page, canvas, source/band/row, renderIndex
- 충돌 검증: 원본 `left/top/width/height` fingerprint
- 현재 이동 좌표는 키에 포함하지 않는다.
- 클릭 선택은 Fabric `event.target`을 그대로 사용한다.
- 재적용은 `renderIndex` 객체의 ID/class/fingerprint가 모두 맞을 때만 수행한다.
- 불일치하면 첫 객체를 선택하지 않고 `SKIPPED` 처리한다.

## 안정성 근거

10개 격리 Browser Context에서 매번 객체 수 180개, 대표이사/사장/부사장 renderIndex `3/4/5`, 원본 좌표와 크기가 동일했다. 이 판정은 현재 sample 렌더 버전에 한정하며 fingerprint 불일치 시 안전하게 거부한다.

## 수명주기

1. 위치 Patch 조회 완료
2. MySuit 최종 Canvas 180개 및 실제 upper Canvas 표시 확인
3. iframe 세대당 Inspector 한 번만 연결
4. Source preview 적용
5. Render Instance Patch 적용
6. 첫 paint 직전에 Viewer 표시

검수 모드 ON/OFF는 Inspector를 재연결하지 않고 상호작용 속성만 변경한다. 좌표를 보존한 뒤 `selectable/evented/lockMovement/hasControls`만 변경한다.

## 저장과 rollback

서버 upsert 고유 조건은 Draft 범위와 `renderInstanceKey`다. 최초 before/fingerprint는 유지하고 after만 갱신한다. 실패하면 같은 key로 현재 인스턴스를 찾아 드래그 전 좌표로 복구한다.

## 마이그레이션

기존 파일을 `render-patches.pre-mvp411.json`으로 백업한다. 기존 ID와 정확한 원본 before 좌표가 단 하나의 객체에 대응하는 경우에만 key/fingerprint를 보강한다. 7건 모두 유일하게 식별됐으며 삭제나 좌표 변경 없이 MIGRATED 처리됐다.

