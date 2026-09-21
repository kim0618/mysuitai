# Dynamic MVP 3.1 Semantic Model v0.1

Semantic Model v0.1 is separate from Visual DIM v1.2 and does not expose MySuit class names, numeric `dataType` values, `FN.*` syntax, internal IDs, or `borderString`.

The MVP supports one 794×1123 page, one embedded dataset, string/number columns, one single-column group, seven ordered semantic Band types, six Detail bindings, Group/Report SUM, five-column footer merge, and `TOTAL_CURRENT` page numbering.

Required top-level fields are `version`, `page`, `title`, `datasets`, `groups`, `bands`, `detailColumns`, `headers`, `groupFooter`, `dataFooter`, and `pageFooter`. The canonical fixture is [manual-dynamic-report.semantic.json](../samples/import/manual-dynamic-report.semantic.json).

Validation resolves every dataset, column, group, Band, binding, aggregate, scope, merge, and page-function reference before generation. GROUP aggregate placement is restricted to GroupFooter and REPORT aggregate placement to DataFooter. Numeric SUM columns are mandatory.

The fixture contains only synthetic data: 25 rows, six columns, eight consecutive `POSITION` groups, and deterministic `PAY` values. Expected group/report totals are calculated from fixture rows during evidence generation rather than stored as generated output literals.

Visual DIM remains the static pipeline contract. Future image import should produce Visual DIM plus this separate Semantic Model only after the user confirms repetition, schema, group, aggregate scope, and pagination assumptions.
