# Import MVP 1.1 Result

최종 판정은 **A**다. `sample/SampleReport_FreeForm` clone에 Text 3개와 실제 Source `UBTable` 1개(3×4, 12 Cells)를 생성했다. Dataset/Binding/Formula/Span은 0이며 저장 직후 재파싱 검증을 통과했다.

Viewer HTTP 200, fatal JS error 0, Text 3개와 Cell 12개가 표시됐다. Cell은 Viewer에서 원 Source Cell ID를 유지한 `UBLabel`로 분해됐다. 모든 텍스트·좌표·크기가 일치했고 최대 geometry 오차는 0, 전 셀 grid border가 확인됐다. Reload와 새 Browser Context도 동일했다. 1×1 선행 검증도 Viewer/PDF 모두 통과했다.

Server PDF는 HTTP 200, 1 page, 29,269 bytes다. 환경에 `pdftotext/pdfinfo`가 없어 PDF 내부 text extraction은 하지 않았으며 OCR도 사용하지 않았다. 대신 실제 Viewer border 속성과 non-empty server PDF로 smoke 검증했다.

Import unit 23개가 통과했고 PRE-AI baseline 최종 재실행도 전 suite PASS였다. 첫 회귀의 History E2E는 초기 canvas를 0 objects로 조기 캡처한 timing failure였고 cleanup 후 동일 baseline에서 180 objects, full undo/redo PASS로 확인됐다. 원본 sample, FreeForm template, Table prototype, 기존 사용자 후보는 보존됐다.

증빙 프로젝트는 `import_mvp11_20260827_170551_e59e1d` 하나를 보존했다. Editor discovery는 `NOT_DISCOVERED_STATIC_MODEL`이며 Source 생성/Viewer/PDF 성공과 별개로 MVP 1.2에서 resolver와 logical model을 일반화해야 한다.
