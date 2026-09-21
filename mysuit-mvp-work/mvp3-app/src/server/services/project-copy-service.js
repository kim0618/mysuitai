const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

const SAFE_SOURCE = /^[A-Za-z0-9_]+$/;
const CANDIDATE = /^(?:sample_(?:mvp[34]|mvp54|mvp5[5-8](?:_[a-z0-9]+)?)|(?:import_mvp(?:1[12]|2[0-2])|import_user_test)_\d{8}_\d{6}_[a-f0-9]{6}_mvp12)_[0-9]{8}_[0-9]{6}_[a-f0-9]{6}$/;

function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
function validateSourceName(value) { return typeof value === 'string' && SAFE_SOURCE.test(value); }
function candidatePath(name) {
  if (!CANDIDATE.test(name)) throw codedError('CANDIDATE_DELETE_BLOCKED', '후보 프로젝트 이름이 안전 규칙과 일치하지 않습니다.');
  const target = path.resolve(config.projectsRoot, name);
  const relative = path.relative(path.resolve(config.projectsRoot), target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw codedError('CANDIDATE_DELETE_BLOCKED', '후보 경로가 허용 범위를 벗어났습니다.');
  return target;
}
function makeCandidateName(projectName, version = 'mvp3') {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  if (!/^(?:mvp3|mvp4|mvp54|mvp5[5-8](?:_[a-z0-9]+)?|mvp12)$/.test(version)) throw codedError('CANDIDATE_COPY_FAILED', '후보 버전이 올바르지 않습니다.');
  return `${projectName}_${version}_${stamp}_${crypto.randomBytes(3).toString('hex')}`;
}
function copyProject(projectName, candidateName) {
  if (!validateSourceName(projectName) || (projectName !== 'sample' && !/^(?:import_mvp(?:1[12]|2[0-2])|import_user_test)_\d{8}_\d{6}_[a-f0-9]{6}$/.test(projectName))) throw codedError('SOURCE_PROJECT_NOT_FOUND', '허용되지 않은 원본 프로젝트입니다.');
  const source = path.resolve(config.projectsRoot, projectName);
  const target = candidatePath(candidateName);
  if (!fs.existsSync(source)) throw codedError('SOURCE_PROJECT_NOT_FOUND', '원본 프로젝트를 찾을 수 없습니다.');
  if (fs.existsSync(target)) throw codedError('CANDIDATE_COPY_FAILED', '후보 프로젝트 이름이 충돌했습니다.');
  try { fs.cpSync(source, target, { recursive: true, errorOnExist: true }); }
  catch (_) { throw codedError('CANDIDATE_COPY_FAILED', '후보 프로젝트 복사에 실패했습니다.'); }
  return target;
}
function removeCandidate(candidateName) {
  const target = candidatePath(candidateName);
  if (path.basename(target) === 'sample') throw codedError('CANDIDATE_DELETE_BLOCKED', '원본 프로젝트는 삭제할 수 없습니다.');
  if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: false });
  return target;
}

module.exports = { CANDIDATE, validateSourceName, candidatePath, makeCandidateName, copyProject, removeCandidate };
