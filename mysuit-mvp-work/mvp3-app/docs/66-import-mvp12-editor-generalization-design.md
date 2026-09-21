# Import MVP 1.2 Editor Generalization Design

FormContext service는 원본 `sample/sample`과 metadata가 검증된 Imported Form만 resolve한다. Generic readiness는 exact object count 대신 non-empty canvas의 안정 signature를 사용한다. 기존 sample controller는 그대로 유지하고 Imported Form에는 하나의 Source UBTable을 `STATIC_SINGLE` Logical Table로 발견하는 최소 adapter를 추가했다.

Imported Table key는 `tbl:static:IMPTB0001`, Table target은 `ctbl:static:IMPTB0001`이다. Column은 `|col:N`으로 각 4 Cell, Row는 `|row:N`으로 각 3 Cell을 가진다. Table은 12 Cell만 포함하며 외부 Text 3개를 포함하지 않는다.

Static adapter는 Cell ID/text signature를 보존하면서 `resizeColumn`, `hideColumn`, `moveColumn`, `resizeRow`, `hideRow`, `moveTable`, `resizeTableWidth`, `hideTable`을 candidate UBJF에 적용할 수 있다. 이번 E2E 연결 범위는 resizeColumn, resizeRow, moveTable이다. Capability는 Imported origin 자체가 아니라 rectangular source와 target mapping 조건으로 판정한다.

Source-only Candidate와 Structure-only Candidate는 각각 지원한다. Source Patch와 Structure Operation의 혼합은 기존 canonical serializer가 없으므로 `MIXED_CANONICAL_SERIALIZER_UNAVAILABLE`로 명시적으로 차단하며 silent partial apply를 허용하지 않는다.
