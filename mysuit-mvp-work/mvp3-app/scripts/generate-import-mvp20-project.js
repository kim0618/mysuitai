const fs = require('fs');
const path = require('path');
const service = require('../src/server/import/import-project-service');

const dimPath = path.resolve(__dirname, '../samples/import/image-analysis-mvp20.freeze.dim.json');
const dim = JSON.parse(fs.readFileSync(dimPath, 'utf8'));
const projectName = service.makeImportProjectName(new Date(), '2.0');
const result = service.createImportedProject(dim, {
  projectName,
  importVersion: 'MVP-2.0',
  sourceType: 'CODEX_IMAGE',
  provider: 'CODEX',
  api: false,
});
process.stdout.write(`${JSON.stringify(result)}\n`);
