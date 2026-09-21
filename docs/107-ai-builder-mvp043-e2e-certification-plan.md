# AI Builder MVP 0.4.3 E2E Certification Plan

## Scope

This certification reuses the verified MVP 0.4.1 three-row DIM/JSON fixture and the repository-provided Chromium runtime libraries. It adds no product capability. Test projects and drafts use the `ai_builder_mvp043_*` prefix; original forms, user projects, and prior evidence fixtures remain immutable.

## Environment

- Chromium: `/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`
- Runtime libraries: `mysuit-mvp-work/runtime/browser-libs/root/usr/lib/x86_64-linux-gnu`
- Launch: headless, `--no-sandbox`, repository `LD_LIBRARY_PATH`
- Services: Builder 3100, Tomcat/UView5 9990

The earlier `libnspr4.so` failure is classified `ENVIRONMENT_ISSUE`; no product change is used to mask it.

## Certification sequence

1. Record protected-file SHA-256 values.
2. Create an isolated six-event timeline: scalar apply, array apply, header text, column width, detail font, scalar rebind.
3. Undo to cursor zero and compare the full editor-state signature; redo and compare the final signature.
4. Force undo/redo failures and confirm cursor/state atomicity.
5. Materialize one preserved final candidate and parse it back.
6. Verify Viewer, three reloads, three new Chromium contexts, and server PDF.
7. Run MVP 0.4.2 regression and PRE-AI baseline.
8. Record every incomplete browser assertion as a limitation rather than inferring PASS.

