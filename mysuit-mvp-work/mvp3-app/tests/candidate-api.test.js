const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { preserveWhitespaceAffixes, validateRequest, createCandidate, deleteCandidate, getCandidate } = require('../src/server/services/candidate-service');
const { candidatePath } = require('../src/server/services/project-copy-service');
const config = require('../src/server/config');

const valid={projectName:'sample',formName:'sample',pageIndex:0,viewerObjectId:'LB6417_UPHB2584_ROW0',sourceObjectId:'LB6417',bandId:'UPHB2584',rowIndex:0,className:'UBLabel',operation:'updateProperty',property:'text',before:'  연도별 실적보고서',after:'MVP 3 API 테스트',scope:'SOURCE_OBJECT_ALL_INSTANCES'};
test('valid request, whitespace preservation, and validation failures',()=>{const parsed=validateRequest(valid);assert.equal(parsed.parsed.sourceObjectId,'LB6417');assert.equal(parsed.after,'  MVP 3 API 테스트');assert.equal(preserveWhitespaceAffixes('  title  ','next'),'  next  ');for(const change of [{className:'UBImage'},{sourceObjectId:'OTHER'},{after:valid.before},{projectName:'../sample'},{viewerObjectId:'LB6417_EXTRA_UPHB2584_ROW0'}])assert.throws(()=>validateRequest({...valid,...change}))});
test('candidate path blocks traversal and original',()=>{for(const value of ['../sample','/tmp/x','sample','sample_mvp3_bad'])assert.throws(()=>candidatePath(value));assert.equal(path.dirname(candidatePath('sample_mvp3_20260807_130501_ab12cd')),path.resolve(config.projectsRoot))});
test('create, query, and delete candidate without touching original',()=>{const result=createCandidate(valid);assert.equal(result.success,true);assert.equal(result.changedObjects,1);assert.equal(getCandidate(result.candidateId).status,'ACTIVE');const deleted=deleteCandidate(result.candidateId);assert.equal(deleted.status,'DELETED')});
