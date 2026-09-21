# Dynamic MVP 3.1 Runtime Validation

Project: `dynamic_mvp31_20260831_171431_6c2846`, form `DynamicReport`.

Source reparse found one Dataset with six columns and 25 embedded rows, seven Bands, eight semantic Tables, one 1×6 DataBand Detail template, one GroupHeader, one GroupFooter source, one DataFooter, and one PageFooter. Static flattening was false.

UView5 returned HTTP 200 with no fatal JavaScript errors. Each of the six Detail source cells generated 25 runtime instances: 150 Detail cells total. Eight distinct `POSITION` values generated eight GroupFooter instances. Runtime object identity collisions were zero.

All eight group labels and sums matched fixture-derived expectations. Values were 1010, 2050, 2090, 2130, 3270, 1110, 2250, and 14340. The DataFooter total was 28250. GroupFooter and DataFooter sources contain the identical `FN.Sum('employees','PAY')` expression, proving that Band context supplies different aggregate scopes.

PageFooter source is `dataType: "2"` with `FN.TotalPage() + " / " + FN.CurrentPage()` and rendered `1 / 1`. It is not stored as a literal.

Server PDF returned HTTP 200 and 40,306 bytes. The primary screenshot and PDF are:

- `/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/screenshots/dynamic-mvp31-viewer.png`
- `/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/output/dynamic-mvp31-report.pdf`

Multi-page validation was not attempted. Existing generic Editor attach is not supported: its server model intentionally accepts only `STATIC_SINGLE` forms with exactly one UBTable, while this Dynamic Form has eight Band-owned tables. Source-style History and Candidate validation were therefore not run, and runtime bound-value source edits remain blocked by policy.

Static/Dynamic unit tests totaled 31 PASS. PRE-AI baseline groups 31, 18, and 24 plus browser E2E passed. Ground Truth SHA-256 remained `deb72e9f5b1a0ecc7963700905b1564c07e42bae902f739f5a0f21a741529717`.
