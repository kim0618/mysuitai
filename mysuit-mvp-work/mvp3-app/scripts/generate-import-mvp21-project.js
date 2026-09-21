const fs = require('fs');
const path = require('path');
const service = require('../src/server/import/import-project-service');

const dim = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../samples/import/image-analysis-mvp21.freeze.dim.json'), 'utf8'));
const projectName = service.makeImportProjectName(new Date(), '2.1');
const result = service.createImportedProject(dim, {
  projectName,
  importVersion: 'MVP-2.1',
  sourceType: 'REAL_EXTERNAL_IMAGE',
  provider: 'CODEX',
  api: false,
});
process.stdout.write(`${JSON.stringify(result)}\n`);
