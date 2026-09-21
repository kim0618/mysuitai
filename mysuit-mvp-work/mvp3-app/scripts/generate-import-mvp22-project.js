const fs = require('fs');
const path = require('path');
const service = require('../src/server/import/import-project-service');

const mode = process.argv[2];
const file = mode === 'manual' ? 'manual-style-v12.dim.json' : mode === 'image' ? 'image-analysis-mvp22.freeze.dim.json' : null;
if (!file) throw new Error('usage: node scripts/generate-import-mvp22-project.js manual|image');
const dim = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../samples/import/${file}`), 'utf8'));
const projectName = service.makeImportProjectName(new Date(), '2.2');
const result = service.createImportedProject(dim, { projectName, importVersion: 'MVP-2.2', sourceType: mode === 'manual' ? 'MANUAL_STYLE_DIM' : 'REAL_EXTERNAL_IMAGE', provider: mode === 'image' ? 'CODEX' : 'MANUAL', api: false });
process.stdout.write(`${JSON.stringify(result)}\n`);
