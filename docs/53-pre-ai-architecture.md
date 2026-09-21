# PRE-AI Architecture v1

```text
User / future AI proposal
        ↓
Target Resolver → Operation Registry → Capability Service
        ↓                         (deny with reason)
Operation Validator → Execute API → Domain Store/Adapter
        ↓                           ↓
Unified History                 Candidate UBJF
        ↓                           ↓
Undo / Redo rebuild        MySuit Viewer / Server PDF
```

Registry는 operation 이름, target, 성숙도, Viewer/Source/PDF 지원을 정의한다. Resolver는 exact identity만 반환하고 Capability는 현재 상태에 따른 허용 여부를 계산한다. Validator는 width/group/row role/rowSpan/reflow/binding/history 제한을 재검증한다. Execute만 mutation과 History 기록을 원자적으로 수행한다. Candidate 출력은 원본과 분리된다.

AI 경계는 Capability/Validate/Execute API이며 raw Store, Adapter, UBJF 파일은 AI 경계 밖이다. Source+Structure/Reflow 혼합 canonical serializer와 multi-page 일반화는 이후 별도 검증 대상이다.
