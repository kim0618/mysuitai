const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const service = require('../src/server/import/import-project-service');

const dimPath = path.resolve(__dirname, '../samples/import/user-test-my-report.freeze.dim.json');
const dim = JSON.parse(fs.readFileSync(dimPath, 'utf8'));
const now = new Date();
const pad = (value) => String(value).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const projectName = `import_user_test_${stamp}_${crypto.randomBytes(3).toString('hex')}`;
const result = service.createImportedProject(dim, {
  projectName,
  importVersion: 'MVP-2.2',
  sourceType: 'USER_TEST_IMAGE',
  provider: 'CODEX',
  api: false,
});
process.stdout.write(`${JSON.stringify(result)}\n`);
