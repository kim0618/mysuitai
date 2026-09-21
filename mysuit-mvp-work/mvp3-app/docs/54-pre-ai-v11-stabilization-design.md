# PRE-AI v1.1 안정화 설계

신규 기능 없이 Row direct-resize pointer 안정화와 세 레거시 브라우저 테스트를 현재 정책에 정렬한다.

원인은 정적 결재표 overlay에서 Fabric `getBoundingRect()`의 viewport 좌표를 공통 Adapter에 다시 전달한 이중 변환이었다. 수정은 원본 Fabric 좌표에 Adapter를 한 번만 적용하고, Row boundary 10px hit zone과 pointer capture를 유지한다. pointermove는 preview, pointerup은 저장 1회 정책을 따른다. Operation Registry와 Capability는 변경하지 않는다.
