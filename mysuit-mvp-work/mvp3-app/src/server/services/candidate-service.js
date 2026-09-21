const fs = require('fs');
const path = require('path');
const config = require('../config');
const locks = require('../utils/file-lock');
const { parseViewerObjectId } = require('../utils/viewer-id-parser');
const { sha256File, assertHash } = require('./integrity-service');
const { patchFormText } = require('./form-patch-service');
const { makeCandidateName, copyProject, removeCandidate } = require('./project-copy-service');

function codedError(code, message, status = 400) { const error = new Error(message); error.code = code; error.status = status; return error; }
function loadCandidates() {
  if (!fs.existsSync(config.dataFile)) return [];
  try { const value = JSON.parse(fs.readFileSync(config.dataFile, 'utf8')); return Array.isArray(value) ? value : []; }
  catch (_) { throw codedError('INVALID_REQUEST', '후보 상태 파일을 읽을 수 없습니다.', 500); }
}
function saveCandidates(items) {
  fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
  const temporary = `${config.dataFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(items, null, 2) + '\n');
  fs.renameSync(temporary, config.dataFile);
}
function audit(event) {
  fs.mkdirSync(path.dirname(config.auditFile), { recursive: true });
  fs.appendFileSync(config.auditFile, JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n');
}
function cleanText(value, field) {
  if (typeof value !== 'string') throw codedError('INVALID_REQUEST', `${field}는 문자열이어야 합니다.`);
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  if (!cleaned.length || cleaned.length > config.maxTextLength) throw codedError('INVALID_REQUEST', `${field} 길이가 허용 범위를 벗어났습니다.`);
  return cleaned;
}
function preserveWhitespaceAffixes(before, replacement) {
  const leading = before.match(/^\s*/)?.[0] || '';
  const trailing = before.match(/\s*$/)?.[0] || '';
  const core = replacement.trim();
  if (!core) throw codedError('INVALID_REQUEST', '변경 문구의 본문이 비어 있습니다.');
  return `${leading}${core}${trailing}`;
}
function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw codedError('INVALID_REQUEST', 'JSON 객체 요청이 필요합니다.');
  if (!config.allowedSources.has(`${body.projectName}/${body.formName}`)) throw codedError('SOURCE_PROJECT_NOT_FOUND', '허용되지 않은 프로젝트 또는 폼입니다.');
  if (body.className !== 'UBLabel') throw codedError('UNSUPPORTED_OBJECT_TYPE', 'UBLabel만 지원합니다.');
  if (body.operation !== 'updateProperty' || body.property !== 'text' || body.scope !== 'SOURCE_OBJECT_ALL_INSTANCES') throw codedError('INVALID_REQUEST', '지원하지 않는 Patch 요청입니다.');
  if (body.pageIndex !== 0) throw codedError('INVALID_REQUEST', '현재 MVP는 첫 페이지만 지원합니다.');
  const parsed = parseViewerObjectId(body.viewerObjectId);
  if (!parsed) throw codedError('UNSUPPORTED_VIEWER_ID', '현재 MVP에서 지원하지 않는 객체 ID입니다.');
  if (parsed.sourceObjectId !== body.sourceObjectId || parsed.bandId !== body.bandId || parsed.rowIndex !== body.rowIndex) throw codedError('SOURCE_ID_MISMATCH', 'Viewer ID와 요청 매핑 정보가 일치하지 않습니다.');
  const before = cleanText(body.before, 'before');
  const after = preserveWhitespaceAffixes(before, cleanText(body.after, 'after'));
  if (before === after) throw codedError('INVALID_REQUEST', '기존 문구와 변경 문구가 같습니다.');
  return { ...body, before, after, parsed };
}

function createCandidate(body) {
  const request = validateRequest(body);
  const lockKey = `${request.projectName}/${request.formName}`;
  if (!locks.acquire(lockKey)) throw codedError('LOCKED', '동일 원본의 후보 생성 작업이 진행 중입니다.', 409);
  let candidateName = null;
  const originalProject = path.join(config.projectsRoot, request.projectName);
  const sourceForm = path.join(originalProject, request.formName, 'form.ubjf');
  const sourceInfo = path.join(originalProject, request.formName, 'info.xml');
  if (!fs.existsSync(sourceForm)) { locks.release(lockKey); throw codedError('SOURCE_FORM_NOT_FOUND', '원본 폼을 찾을 수 없습니다.', 404); }
  const originalFormSha256 = sha256File(sourceForm);
  const originalInfoSha256 = fs.existsSync(sourceInfo) ? sha256File(sourceInfo) : null;
  try {
    candidateName = makeCandidateName(request.projectName);
    const candidateRoot = copyProject(request.projectName, candidateName);
    const candidateForm = path.join(candidateRoot, request.formName, 'form.ubjf');
    const patch = patchFormText({ sourceFormPath: sourceForm, candidateFormPath: candidateForm, sourceObjectId: request.sourceObjectId, bandId: request.bandId, expectedBefore: request.before, after: request.after });
    assertHash(sourceForm, originalFormSha256);
    if (sourceInfo && originalInfoSha256) assertHash(sourceInfo, originalInfoSha256);
    const now = new Date().toISOString();
    const candidateId = `cand_${candidateName.slice('sample_mvp3_'.length)}`;
    const record = {
      candidateId, status: 'ACTIVE', projectName: request.projectName, formName: request.formName,
      candidateProjectName: candidateName, viewerObjectId: request.viewerObjectId,
      sourceObjectId: request.sourceObjectId, bandId: request.bandId, rowIndex: request.rowIndex,
      property: 'text', before: request.before, after: request.after,
      originalFormSha256, originalInfoSha256, candidateFormSha256: patch.candidateSha256,
      createdAt: now, previewUrl: `/mysuit/UView5/index.jsp?projectName=${candidateName}&formName=${request.formName}`,
      changedObjects: patch.changedObjects, structuralDiff: patch.structuralDiff
    };
    const all = loadCandidates(); all.push(record); saveCandidates(all);
    audit({ event: 'CANDIDATE_CREATED', ...record });
    return { success: true, ...record };
  } catch (error) {
    if (candidateName) { try { removeCandidate(candidateName); } catch (_) {} }
    try { assertHash(sourceForm, originalFormSha256); } catch (hashError) { error = hashError; }
    audit({ event: 'CANDIDATE_CREATE_FAILED', candidateId: null, projectName: request.projectName, formName: request.formName, candidateProjectName: candidateName, sourceObjectId: request.sourceObjectId, property: 'text', before: request.before, after: request.after, status: 'FAILED', errorCode: error.code || 'FORM_PATCH_FAILED' });
    throw error;
  } finally { locks.release(lockKey); }
}

function listCandidates() { return loadCandidates(); }
function getCandidate(id) {
  const found = loadCandidates().find(item => item.candidateId === id);
  if (!found) throw codedError('CANDIDATE_NOT_FOUND', '후보를 찾을 수 없습니다.', 404);
  return found;
}
function deleteCandidate(id) {
  if (!/^cand_(?:[0-9]{8}_[0-9]{6}_[a-f0-9]{6}|[a-f0-9]{16})$/.test(id)) throw codedError('CANDIDATE_NOT_FOUND', '후보 ID가 올바르지 않습니다.', 404);
  const all = loadCandidates();
  const index = all.findIndex(item => item.candidateId === id);
  if (index < 0) throw codedError('CANDIDATE_NOT_FOUND', '후보를 찾을 수 없습니다.', 404);
  const item = all[index];
  if ((item.projectName !== 'sample' && !/^(?:import_mvp(?:1[12]|2[0-2])|import_user_test)_\d{8}_\d{6}_[a-f0-9]{6}$/.test(item.projectName)) || item.candidateProjectName === item.projectName) throw codedError('CANDIDATE_DELETE_BLOCKED', '원본 프로젝트 삭제가 차단되었습니다.', 403);
  const sourceForm = path.join(config.projectsRoot, item.projectName, item.formName, 'form.ubjf');
  removeCandidate(item.candidateProjectName);
  assertHash(sourceForm, item.originalFormSha256);
  item.status = 'DELETED'; item.deletedAt = new Date().toISOString();
  saveCandidates(all);
  if (item.changeSetId) {
    const changeSetFile = path.join(config.appRoot, 'data/changesets.json');
    if (fs.existsSync(changeSetFile)) {
      const changeSets = JSON.parse(fs.readFileSync(changeSetFile, 'utf8'));
      const changeSet = changeSets.find(value => value.changeSetId === item.changeSetId);
      if (changeSet) { changeSet.status = 'DISCARDED'; changeSet.candidateId = null; changeSet.updatedAt = new Date().toISOString(); }
      const temporary = `${changeSetFile}.tmp`; fs.writeFileSync(temporary, JSON.stringify(changeSets, null, 2) + '\n'); fs.renameSync(temporary, changeSetFile);
    }
  }
  audit({ event: 'CANDIDATE_DELETED', ...item });
  return { success: true, candidateId: id, status: item.status };
}

module.exports = { codedError, preserveWhitespaceAffixes, validateRequest, createCandidate, listCandidates, getCandidate, deleteCandidate };
