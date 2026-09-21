# MySuit AI Studio — Product UI Architecture 1.0 Result

**Baseline.** Commit `8fedbcf` (feat(ai-studio): complete direct edit interaction 3.2) freezes the state before this work.

## Brand

The visible product name is now **MySuit AI Studio** on every Studio screen:

- the sidebar brand and its `aria-label`;
- the sidebar navigation label (`AI Studio 메뉴`);
- page titles (`편집하기 · MySuit AI Studio`, `사용자 편집 · MySuit AI Studio`, `서식 생성 · MySuit AI Studio`);
- breadcrumbs;
- the create page copy.

Server APIs, routes (`/ai-builder…`), global names (`AiBuilderSidebar`, `window.aiBuilder`) and file names are unchanged.

**Brand asset contract**

| Slot | How it is used | Current state |
| --- | --- | --- |
| `studio-logo-mark` | `AiBuilderSidebar.BRAND.logoMark` (image URL) or `--studio-logo-mark`; square, shown in the expanded and the collapsed sidebar | empty; the existing "M" letter mark is the fallback |
| `studio-logo-full` | `AiBuilderSidebar.BRAND.logoFull` or `--studio-logo-full` | empty |
| `favicon` | `/ai-builder/brand/favicon.svg`, linked from both pages | temporary SVG of the existing "M" mark; add 16/32 px PNG or ICO when the artwork is approved |

No new logo was designed. The approved artwork goes into `src/client/ai-builder/brand/`.

## Theme

`studio-theme.css` holds the tokens and is loaded first on every page. The Viewer's document rendering is not themed.

**Colours**

- Accent:
  - `--studio-primary` `#087F52`: white text on it reaches about 5.0:1, and it reads at about 4.6:1 on the mint surface.
  - `--studio-primary-hover` `#066B45`.
  - Soft fills: `--studio-primary-soft` (mint), `--studio-primary-softer`.
  - `--studio-primary-border`.
- Neutrals: `--studio-bg` `#F5F7F6`, `--studio-surface` white, `--studio-border`, `--studio-border-strong`, and the text scale (`--studio-text` … `--studio-text-subtle`).
- Danger: `--studio-danger` keeps the existing red.

**Rhythm.** Spacing uses 4/8/12/16/24 px, radius 6/8/12 px, and one control height of 34 px.

**Migration.** The legacy `--ai-*` variables now resolve to the Studio tokens. Hard-coded colours in the Studio stylesheets (`ai-builder.css`, `editing-workspace.css`, `import.css`, `refinement.css`) were mapped to tokens by hue and lightness; semantic reds and oranges were kept.

**Where green appears.** Green is limited to the selected navigation item (mint background, green text and icon), the primary button, the active tab, the selected-object outline in the Viewer, the text toolbar's active state and small highlights.

**Surfaces.** The sidebar, top bar and panels are white.

## Sidebar

The menu is 생성하기, 편집하기, **사용자 편집**, 내 작업, 템플릿, 설정.

- 편집하기 and 사용자 편집 reopen the last opened document through one shared query string, so switching screens keeps the document.
- Width and collapse behaviour are unchanged.

## Screens

| | 편집하기 (developer / template designer) | 사용자 편집 (user) |
| --- | --- | --- |
| Route | `/ai-builder?projectName&layoutDraftId` | `/ai-builder/user?projectName&layoutDraftId` |
| Tabs | 채팅 · 직접 편집 · 데이터 연결 | 채팅 · 직접 편집 |
| Direct edit | cell/row/column modes, multi-select, drag & drop, snap, row/column editors, image, text | text (내용, 글자 크기, 굵게, 정렬), image (size, position, fit, replace), visibility, reset |
| Hidden | – | 데이터 연결, JSON, dataset/binding, 셀/행/열 modes, 고급 설정 (source IDs) |
| Chat | developer suggestions | greeting "원하는 수정 내용을 말씀해 주세요." with suggestions 제목 수정, 이미지 교체, 표 정리, 문구 수정; no data attach |
| Without a document | built-in sample (unchanged) | last opened document, otherwise a picker of recent documents (`GET /api/ai-builder/recent`) plus 새 문서 만들기. It never shows the sample. |

## Shared core

Both screens are the same page (`index.html`). They share the UView5 Viewer iframe, app.js, the operation/history/save path, the structure controller and the binding services.

`ai-builder-shell.js` selects a UI profile from the route: `developer` or `user`. The profile sets the tabs, the table modes, the advanced details, the data attach button, the chat copy and the empty states. No editing logic is duplicated, and an edit made on 사용자 편집 is the same draft and history as on 편집하기.

## Also

- **Document title.** The title comes from the original upload name, `document.displayName`, which import now keeps. Older imports fall back to the form name.
- **Text toolbar.** The floating text toolbar in the Viewer is white with a subtle border and a green active state.
- **Save button.** It no longer uses the legacy `.review-primary`, whose `!important` rule forced a different green.

## Verification

- **AI Studio UI E2E on the real 발주서 flow: 11/11.**
  - Brand and favicon; sidebar order.
  - Developer tabs, modes and data connection.
  - Separate user screen on the same document.
  - User tabs, no developer concepts or identifiers, placeholder chat.
  - Undo/redo/save through the shared core.
  - Themed colours.
  - Recent-document picker instead of the sample.
- **Regression.**
  - Pass: interaction-3-2 17/17, selection-lifecycle, structure-3, editing-v2-ux, editing-workspace, import-mvp12-editor, upload-ui, upload-refinement, mvp01, mvp44, mvp57.
  - editing-v2 fails only the font-environment `sidebarVisualConsistency` brand-overflow check, as before.
  - Unit tests: 223/224 (the pre-existing `data/`-dependent test fails). HWPX tests: 15/15.
- **Tests updated for intended changes:**
  - the sidebar menu gained 사용자 편집 (editing-v2, upload-refinement);
  - the brand is MySuit AI Studio (upload-refinement);
  - the chat greeting names the uploaded document instead of the form name (editing-v2-ux).

## Remaining UI architecture work

- 내 작업, 템플릿 and 설정 are still placeholders. A proper document list should replace the minimal recent picker.
- The Viewer's own toolbar (UView5) keeps its styling; its pink active state is outside the Studio theme.
- The legacy review stylesheets (`styles.css`, `design-system.css`) still load on the editor page.
- The approved logo and favicon artwork need to be dropped into the slots.
- User direct edit reuses the developer inspector with a profile. A dedicated user surface with its own wording and action set can be split out once its scope is fixed.
- A user-facing save/version flow (for example "저장 완료 · 버전") and access control between the two screens are not in place.

## Phase 2 (developer designer)

- Reorganise the developer panel into 속성 / 데이터 / Band, replacing 채팅 · 직접 편집 · 데이터 연결.
- Move the table structure tools (modes, row/column card, drag) into a structure panel, and DataBand and binding into 데이터.
- Linked header/body column moves, and moving an item group without splitting table titles.
- An object tree and layer list, and a precise geometry inspector (x/y/w/h with units).
- Rename internal names (`AiBuilder*`, `/ai-builder`) behind compatible aliases, if the product name is final.
