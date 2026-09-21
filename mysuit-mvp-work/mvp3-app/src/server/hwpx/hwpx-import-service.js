const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { readHwpxPackage } = require('./package-reader');
const { parseHwpxSemantic } = require('./semantic-parser');
const { semanticToDim } = require('./dim-mapper');
const { validateDim } = require('../import/dim-validator');
const { createImportedProject } = require('../import/import-project-service');

const stable = (value) => JSON.stringify(value, (key, item) => key === 'bytes' ? undefined : item);
const signature = (value) => crypto.createHash('sha256').update(stable(value)).digest('hex');
function analyzeHwpx(input) { const pkg = readHwpxPackage(input), semantic = parseHwpxSemantic(pkg), dim = validateDim(semanticToDim(semantic)); return { pkg, semantic, dim, signatures: { semantic: signature(semantic), dim: signature(dim), assets: semantic.assets.map((a) => a.sha256) } }; }
function stageAssets(semantic, root) { for (const asset of semantic.assets) fs.writeFileSync(path.join(root, asset.relativePath), asset.bytes, { flag: 'wx' }); }
function importHwpx(input, options = {}) {
  const analyzed = analyzeHwpx(input), staging = fs.mkdtempSync(path.join(os.tmpdir(), 'mysuit-hwpx-'));
  try { stageAssets(analyzed.semantic, staging); const project = createImportedProject(analyzed.dim, { ...options, assetRoot: staging, sourceType: 'HWPX', importVersion: 'HWPX-MVP-0.1' }); return { ...analyzed, project }; }
  finally { fs.rmSync(staging, { recursive: true, force: false }); }
}

module.exports = { stable, signature, analyzeHwpx, stageAssets, importHwpx };
