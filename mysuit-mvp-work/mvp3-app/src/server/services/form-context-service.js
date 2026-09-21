const fs = require('fs');
const path = require('path');
const config = require('../config');

const SAFE = /^[A-Za-z0-9_/-]{1,120}$/;
const IMPORT = /^(?:(?:import_mvp(?:1[0-3]|2[0-2])|import_user_test)_\d{8}_\d{6}_[a-f0-9]{6}|ai_builder_mvp043(?:1)?_(?:certification_)?[A-Za-z0-9_-]+)$/;

function fail() { throw Object.assign(new Error('지원하지 않는 Form Context입니다.'), { code: 'SOURCE_PROJECT_NOT_FOUND' }); }
function resolve(value = {}) {
  const projectName = String(value.projectName || ''), formName = String(value.formName || '');
  if (!SAFE.test(projectName) || !SAFE.test(formName) || formName.includes('..')) fail();
  if (projectName === 'sample' && formName === 'sample') return { projectName, formName, origin: 'ORIGINAL', kind: 'COMPOSITE_SAMPLE' };
  if (!IMPORT.test(projectName) || formName !== 'SampleReport_FreeForm') fail();
  const root = path.resolve(config.projectsRoot, projectName), relative = path.relative(path.resolve(config.projectsRoot), root);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail();
  const metadataFile = path.join(root, 'import-meta.json'), form = path.join(root, formName, 'form.ubjf'), info = path.join(root, formName, 'info.xml');
  if (![metadataFile, form, info].every(fs.existsSync)) fail();
  let metadata; try { metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8')); } catch (_) { fail(); }
  const derivedCertification=/^ai_builder_mvp043(?:1)?_(?:certification_)?[A-Za-z0-9_-]+$/.test(projectName);
  if (metadata.origin !== 'IMPORTED' || (!derivedCertification && metadata.projectName !== projectName) || metadata.formName !== formName) fail();
  return { projectName, formName, origin: 'IMPORTED', kind: 'STATIC_SINGLE', root, form, info, metadata };
}
function isAllowed(value) { try { resolve(value); return true; } catch (_) { return false; } }
function defaultDraft(context) { return context.origin === 'IMPORTED' ? `import_${context.projectName}_${context.formName}_default`.slice(0, 80) : 'layout_sample_default'; }
module.exports = { IMPORT, resolve, isAllowed, defaultDraft };
