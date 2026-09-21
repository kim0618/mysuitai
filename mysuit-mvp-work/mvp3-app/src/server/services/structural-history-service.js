const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const formContext = require('./form-context-service');
const { readForm } = require('./form-patch-service');
const { sha256File } = require('./integrity-service');
const { semanticSignature } = require('../ai-builder/unified-materializer');

const file = path.join(config.appRoot, 'data/structural-history.json');

function fail(code, message, status = 500) {
  throw Object.assign(new Error(message), { code, status });
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function scopeKey(scope) { return `${scope.layoutDraftId}|${scope.projectName}|${scope.formName}`; }
function loadRoot() {
  if (!fs.existsSync(file)) return { schemaVersion: 1, states: {} };
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (value?.schemaVersion !== 1 || typeof value.states !== 'object') throw new Error();
    return value;
  } catch (_) {
    fail('STRUCTURAL_HISTORY_RESTORE_FAILED', 'Structural History Store를 읽을 수 없습니다.');
  }
}
function saveRoot(value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(temp, file);
}
function staticState(scope) {
  const context = formContext.resolve(scope);
  const formPath = context.form || path.join(config.projectsRoot, context.projectName, context.formName, 'form.ubjf');
  return {
    schemaVersion: 1,
    kind: 'STATIC_SOURCE',
    projectName: context.projectName,
    formName: context.formName,
    formSha256: sha256File(formPath),
    semanticSignature: semanticSignature(readForm(formPath)),
  };
}
function validate(scope, state) {
  if (!state) return staticState(scope); // backward compatibility for pre-0.4.1 histories
  if (state.schemaVersion !== 1 || !['STATIC_SOURCE', 'DYNAMIC_CANDIDATE'].includes(state.kind))
    fail('STRUCTURAL_HISTORY_RESTORE_FAILED', 'Structural snapshot 형식이 올바르지 않습니다.');
  if (!/^[A-Za-z0-9_]+$/.test(state.projectName || '') || !/^[A-Za-z0-9_]+$/.test(state.formName || ''))
    fail('STRUCTURAL_HISTORY_RESTORE_FAILED', 'Structural snapshot target이 안전하지 않습니다.');
  const formPath = path.join(config.projectsRoot, state.projectName, state.formName, 'form.ubjf');
  if (!fs.existsSync(formPath)) fail('STRUCTURAL_HISTORY_RESTORE_FAILED', 'Structural snapshot target을 찾을 수 없습니다.');
  const formSha256 = sha256File(formPath);
  const signature = semanticSignature(readForm(formPath));
  if (formSha256 !== state.formSha256 || signature !== state.semanticSignature)
    fail('STRUCTURAL_HISTORY_SIGNATURE_MISMATCH', 'Structural snapshot signature가 일치하지 않습니다.');
  return clone(state);
}
function get(scope) {
  const stored = loadRoot().states[scopeKey(scope)];
  return validate(scope, stored || null);
}
function findDynamic(projectName, formName) {
  const matches=Object.values(loadRoot().states).filter(x=>x?.kind==='DYNAMIC_CANDIDATE'&&x.sourceProjectName===projectName&&x.sourceFormName===formName);
  if(matches.length!==1)return null;
  const scope={projectName,formName,layoutDraftId:'lookup'};
  return validate(scope,matches[0]);
}
function replace(scope, state) {
  const valid = validate(scope, state);
  const root = loadRoot();
  if (valid.kind === 'STATIC_SOURCE') delete root.states[scopeKey(scope)];
  else root.states[scopeKey(scope)] = valid;
  saveRoot(root);
  return valid;
}
function createDynamic(scope, result) {
  const formPath = path.join(config.projectsRoot, result.candidateProject, result.candidateForm, 'form.ubjf');
  if (!fs.existsSync(formPath)) fail('STRUCTURAL_HISTORY_SNAPSHOT_FAILED', 'Dynamic candidate를 찾을 수 없습니다.');
  return {
    schemaVersion: 1,
    kind: 'DYNAMIC_CANDIDATE',
    projectName: result.candidateProject,
    formName: result.candidateForm,
    formSha256: sha256File(formPath),
    semanticSignature: semanticSignature(readForm(formPath)),
    sourceProjectName: scope.projectName,
    sourceFormName: scope.formName,
  };
}
function clear(scope) {
  const root = loadRoot();
  delete root.states[scopeKey(scope)];
  saveRoot(root);
}
function previewUrl(state) {
  return `/mysuit/UView5/index.jsp?projectName=${state.projectName}&formName=${state.formName}`;
}

module.exports = { file, get, findDynamic, replace, createDynamic, clear, validate, previewUrl };
