# HWPX Import MVP 0.1 — Result

## Current result

The Golden fixture was found at `/mnt/c/Users/jinsung/Desktop/시연/인사.hwpx`. Native parse, DIM 1.3 validation, the existing project generator, UBJF parse-back, Viewer, reload ×3, two new browser contexts, screenshots, and server PDF all pass.

Source and generated counts match: 8 tables, 186 logical master cells, 56 merged masters, and one GIF/UBImage. All 13 required major text values are present. Three independent parses produced identical semantic, DIM, and asset signatures.

## Verification

```text
npm run test:hwpx                                      PASS
DIM 1.3 + existing Import Core unit regression         PASS
Dynamic/editor/history/binding regression              PASS
Golden 8 tables / 186 cells / 56 merges / 1 image     PASS
Viewer HTTP 200 / fatal errors 0                       PASS
Reload ×3 / new contexts ×2                            PASS
Server PDF HTTP 200 / 63,747 bytes                     PASS
```

Final generated project: `import_mvp13_20260917_152137_96d522`.

Re-run:

```bash
cd /home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/mvp3-app
npm run import:hwpx -- '/mnt/c/Users/jinsung/Desktop/시연/인사.hwpx' ../output/hwpx-personnel-record --project
```

## Verdict and answers

Verdict: **B**. Structure is faithful and all hard gates pass. Minor exact column-width, line-spacing, and text placement differences remain in the complex `인적사항` table.

- Q1: YES
- Q2: YES
- Q3: YES
- Q4: YES
- Q5: YES
- Q6: YES — `.hwpx` can move to MVP 0.2 official upload integration; `.hwp` remains unsupported.
