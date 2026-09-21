# AI Builder MVP 0.4.1 Result

## Verdict

**B** — the core runtime and structural history contracts pass. Dynamic source-template editing after conversion was not generalized into the mixed timeline, and the optional array-column manual-correction browser flow was not rerun.

## Environment diagnosis

The prior startup failure was an `ENVIRONMENT_ISSUE`: sandboxed Java could not create the Tomcat shutdown socket (`Operation not permitted`). Outside that network sandbox, Tomcat 8.5.78 on Java 17 started in about five seconds, MYSUIT deployed, port 9990 listened, and UView5 returned HTTP 200. Node and Viewer health were both HTTP 200.

## Product defects fixed

- A sliced detail row retained its old row index/offset, causing `PageInfoSimple.convertTableItem` to throw `IndexOutOfBoundsException`. The generated one-row table is now normalized.
- Switching a free-form page to a band report hid standalone scalar objects. Preserved static objects are now assigned to page header/footer bands.
- Array Apply previously wrote only a marker. It now records and restores a signature-validated structural reference atomically.
- Array Apply now stages current scalar/source/structure/binding state before conversion, preserving scalar bindings.

## Runtime evidence

| JSON rows | Source detail | Viewer detail | PDF | Reload x3 |
|---:|---:|---:|---|---|
| 1 | 1 | 1 | 200 / 29,680 bytes | PASS |
| 3 | 1 | 3 | 200 / 30,252 bytes | PASS |
| 5 | 1 | 5 | 200 / 31,362 bytes | PASS |

All item/quantity/rate/amount values were in JSON order. Runtime identity collisions were zero. `ABC상사` and each scalar total were preserved. Three fresh contexts rendered the five-row case with no fatal page errors.

## Structural evidence

The three-row fixture base signature is `60bc932884ce67d4a6d344b1d9ff69324d9ef258756a02c3c9feb90711ae1a9f`; dynamic/redo is `78d1e0c5402f3c7cae9880a2f53096f046dea246358f0a6a139fc50e74389aad`. Browser Undo selected the exact static project and Browser Redo restored the dynamic candidate and three runtime rows. Unit coverage passes branch removal, persistence, old-history compatibility, invalid-signature fail-closed behavior, and forced undo/redo atomicity.

## Regression and integrity

Foundation 0.1/0.2, MVP 0.1/0.2/0.2.1/0.3/0.4 unit and browser suites passed. PRE-AI baseline v1 passed. Original `sample/sample` and `sample/SampleReport_FreeForm` hashes match existing baseline evidence. No original source was written.

## Limitations

- Post-conversion generated header/detail IDs are not yet exposed as general Builder source-template edit targets, so the full requested mixed timeline is partial.
- MVP 0.4 array-column manual correction was not rerun; the MVP 0.3 manual scalar correction E2E passed.
- PDF was validated through the server renderer request, status, bytes, and the same captured runtime dataset; separate PDF text extraction was unavailable.
