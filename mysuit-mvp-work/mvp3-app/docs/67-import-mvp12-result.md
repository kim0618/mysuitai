# Import MVP 1.2 Result

최종 판정은 **A**다. Existing PRE-AI Editor가 Imported MVP 1.1 Form에 16 objects로 generic attach됐으며 exact 180 dependency는 generic attach에서 제거됐다.

Imported `IMPLB0001`을 Object Target으로 선택해 문구를 `AI 변환 실적 보고서`로 변경했다. History 1건, Undo/Redo, reload, 새 Browser Context, Candidate Viewer가 모두 동일했다. Object Candidate PDF는 HTTP 200, 29,907 bytes였다.

`IMPTB0001`은 `STATIC_SINGLE` Logical Table 하나로 발견됐다. Column 3개는 각각 정확히 4 Cells, Row 4개는 각각 3 Cells, Table target은 정확히 12 Cells를 가졌다. Column 210→240 resize, 두 번째 Row 40→52 resize, Table +20/+20 move가 History 3건으로 저장됐고 Undo/Redo, reload, 새 Context에서 동일 geometry였다. Structure Candidate PDF는 HTTP 200, 29,288 bytes였다.

Store는 draft/project/form 조합으로 분리됐으며 sample 상태의 유입은 0이다. Imported Base SHA-256 `7f26b5581f87e5f3d3417bde21125ab993edbd2dc0c8b8de72ac1de0be1e4505`는 유지됐다. sample, FreeForm template, Table prototype, 기존 사용자 candidate도 보존됐다. PRE-AI baseline은 Object/Column/Row/Composite/Approval/History/Capability/PDF 전부 PASS했다.

지원 범위를 과장하지 않는다. Text update와 검증한 Column/Row/Table subset은 연결됐지만 Source+Structure 혼합 Candidate는 canonical serializer 부재로 차단한다. 이 제한 아래에서 Image → DIM 단계로 진행할 준비가 됐다.
