# Import MVP 2.2 DIM Style v1.2 Design

DIM v1.2 adds `textColor`, `backgroundColor`, and `verticalAlign` to TEXT style and adds optional `fontSize`, `bold`, `textAlign`, `verticalAlign`, colors, and vendor-independent per-side `border` to TABLE CELL style. Colors use `#RRGGBB`; vertical alignment is `top|middle|bottom`; border sides carry `visible`, optional color, and width 0–2.

Unknown style fields are rejected. v1.0/v1.1 remain valid and retain prototype-compatible behavior. A v1.2 cell without explicit fields is sanitized to black text, white background, centered/middle alignment, and hidden borders. DIM never exposes `borderString`.

Validator errors include `IMPORT_DIM_INVALID_COLOR`, `IMPORT_DIM_INVALID_VERTICAL_ALIGN`, `IMPORT_DIM_INVALID_BORDER`, and `IMPORT_DIM_UNSUPPORTED_BORDER_STYLE`.
