const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { sha256File, assertHash } = require('./integrity-service');
const { definition, sourceValue, validateValue, encodedValue, supportedProperties } = require('../utils/property-mapper');

function codedError(code, message) { const error = new Error(message); error.code = code; return error; }
function decodedText(value) { try { return decodeURIComponent(value); } catch (_) { return value; } }

function readForm(file) {
  try {
    const encoded = fs.readFileSync(file, 'ascii').replace(/\s/g, '');
    const root = JSON.parse(zlib.inflateSync(Buffer.from(encoded, 'base64')).toString('utf8'));
    if (!Array.isArray(root.pages)) throw new Error('pages missing');
    const pages = root.pages.map((entry, index) => {
      if (typeof entry !== 'string') throw new Error(`page ${index} is not a string`);
      const page = JSON.parse(entry);
      if (!Array.isArray(page.items)) throw new Error(`page ${index} items missing`);
      return page;
    });
    return { root, pages };
  } catch (error) {
    throw codedError('FORM_PARSE_FAILED', 'form.ubjf 구조를 파싱할 수 없습니다.');
  }
}

function writeForm(file, parsed) {
  const root = { ...parsed.root, pages: parsed.pages.map(page => JSON.stringify(page)) };
  const compressed = zlib.deflateSync(Buffer.from(JSON.stringify(root), 'utf8'));
  const base64 = compressed.toString('base64');
  fs.writeFileSync(file, base64.match(/.{1,76}/g).join('\r\n') + '\r\n', 'ascii');
}

function findObjects(pages, id) {
  const found = [];
  function walk(value, pageIndex, keyPath, ancestors) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value) && value.id === id) found.push({ pageIndex, itemIndex: keyPath[1] ?? null, item: value, keyPath, ancestors });
    if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, pageIndex, [...keyPath, index], ancestors));
    else for (const [key, entry] of Object.entries(value)) if (entry && typeof entry === 'object') walk(entry, pageIndex, [...keyPath, key], [...ancestors, value]);
  }
  pages.forEach((page, pageIndex) => page.items.forEach((item, itemIndex) => walk(item, pageIndex, ['items', itemIndex], [])));
  return found;
}

function diff(a, b) {
  const changes = [];
  function walk(left, right, at) {
    if (Object.is(left, right)) return;
    if (left === null || right === null || typeof left !== typeof right || typeof left !== 'object') {
      changes.push({ path: at, before: left, after: right }); return;
    }
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) walk(left[key], right[key], `${at}/${key}`);
  }
  walk(a, b, 'pages');
  return changes;
}

function effectiveBand(match) { if (typeof match.item.band === 'string') return match.item.band; const parent=[...match.ancestors].reverse().find(value => typeof value?.band === 'string'); return parent ? parent.band : null; }
function bandRelation(pages, match, sourceObjectId, bandId) {
  if (effectiveBand(match) !== bandId) return false;
  if (bandId === '') return match.pageIndex >= 0;
  const band = pages[match.pageIndex].items.find(item => item?.id === bandId);
  const topItem = match.ancestors.find(value => value?.id && pages[match.pageIndex].items.includes(value)) || match.item;
  return Boolean(band && Array.isArray(band.bandItems) && (band.bandItems.includes(sourceObjectId) || band.bandItems.includes(topItem.id)));
}

function inspectSourceObject({ formPath, sourceObjectId, bandId, runtimeText }) {
  const parsed=readForm(formPath);const matches=findObjects(parsed.pages,sourceObjectId);
  if(matches.length!==1)throw codedError(matches.length?'SOURCE_OBJECT_DUPLICATED':'SOURCE_OBJECT_NOT_FOUND','원본 객체를 정확히 하나 찾을 수 없습니다.');
  const match=matches[0];if(!['UBLabel','Cell','UBImage'].includes(match.item.className))throw codedError('UNSUPPORTED_OBJECT_TYPE','지원하지 않는 원본 객체 유형입니다.');
  if(!bandRelation(parsed.pages,match,sourceObjectId,bandId))throw codedError('SOURCE_ID_MISMATCH','원본 객체와 band 관계가 일치하지 않습니다.');
  const support=supportedProperties(match,runtimeText);
  const values={};for(const property of support.properties)values[property]=sourceValue(match.item,property);
  return{sourceObjectId,sourceClassName:match.item.className,bandId,effectiveBandId:effectiveBand(match),sourcePath:`pages/${match.pageIndex}/${match.keyPath.join('/')}`,values,...support};
}

function patchFormProperties({sourceFormPath,candidateFormPath,patches}) {
  if(path.resolve(sourceFormPath)===path.resolve(candidateFormPath))throw codedError('FORM_PATCH_FAILED','원본과 후보 경로가 같습니다.');
  if(!Array.isArray(patches)||!patches.length)throw codedError('CHANGESET_EMPTY','Patch가 없습니다.');
  const sourceHash=sha256File(sourceFormPath),source=readForm(sourceFormPath),candidate=readForm(candidateFormPath),beforePages=JSON.parse(JSON.stringify(candidate.pages));
  const order={width:1,height:1,left:2,top:2,text:3,fontSize:3,fontWeight:3,textAlign:3,visible:4};
  const sorted=[...patches].sort((a,b)=>(order[a.viewerProperty]||9)-(order[b.viewerProperty]||9));const expected=[];
  for(const patch of sorted){
    const d=definition(patch.viewerProperty);if(d.sourceProperty!==patch.sourceProperty)throw codedError('UNSUPPORTED_PROPERTY','Viewer/source 속성 매핑이 일치하지 않습니다.');
    validateValue(patch.viewerProperty,patch.after);
    const sourceMatches=findObjects(source.pages,patch.sourceObjectId),candidateMatches=findObjects(candidate.pages,patch.sourceObjectId);
    if(sourceMatches.length!==1||candidateMatches.length!==1)throw codedError('MULTI_PATCH_VALIDATION_FAILED','Patch 대상 객체를 정확히 하나 찾을 수 없습니다.');
    const sourceMatch=sourceMatches[0],candidateMatch=candidateMatches[0];if(!bandRelation(source.pages,sourceMatch,patch.sourceObjectId,patch.bandId))throw codedError('SOURCE_ID_MISMATCH','Patch band 관계가 일치하지 않습니다.');
    const support=supportedProperties(sourceMatch,patch.runtimeText??patch.before);if(!support.properties.includes(patch.viewerProperty))throw codedError(patch.viewerProperty==='left'||patch.viewerProperty==='top'?'POSITION_MAPPING_UNVERIFIED':'UNSUPPORTED_PROPERTY','이 원본 객체에서 검증되지 않은 속성입니다.');
    const actual=sourceValue(sourceMatch.item,patch.viewerProperty);if(!Object.is(actual,patch.before))throw codedError('BEFORE_VALUE_MISMATCH',`${patch.sourceObjectId}.${patch.sourceProperty} 기존 값이 다릅니다.`);
    const encoded=encodedValue(patch.viewerProperty,patch.after,candidateMatch.item[patch.sourceProperty]);candidateMatch.item[patch.sourceProperty]=encoded;
    expected.push({path:`pages/${candidateMatch.pageIndex}/${candidateMatch.keyPath.join('/')}/${patch.sourceProperty}`,after:encoded});
  }
  const changes=diff(beforePages,candidate.pages);const paths=new Set(expected.map(x=>x.path));if(changes.length!==paths.size||changes.some(x=>!paths.has(x.path)))throw codedError('CANDIDATE_PARTIAL_APPLY_BLOCKED','예상하지 못한 변경이 감지되었습니다.');
  writeForm(candidateFormPath,candidate);const reparsed=readForm(candidateFormPath);const saved=diff(source.pages,reparsed.pages);if(saved.length!==paths.size||saved.some(x=>!paths.has(x.path)))throw codedError('FORM_REPARSE_FAILED','다중 Patch 저장 후 검증에 실패했습니다.');
  assertHash(sourceFormPath,sourceHash);return{success:true,patchCount:patches.length,changedPaths:[...paths],candidateSha256:sha256File(candidateFormPath),originalFormSha256:sourceHash,structuralDiff:saved};
}

function patchFormText({ sourceFormPath, candidateFormPath, sourceObjectId, bandId, expectedBefore, after }) {
  if (path.resolve(sourceFormPath) === path.resolve(candidateFormPath)) throw codedError('FORM_PATCH_FAILED', '원본과 후보 경로가 같습니다.');
  const sourceHash = sha256File(sourceFormPath);
  const source = readForm(sourceFormPath);
  const sourceMatches = findObjects(source.pages, sourceObjectId);
  if (!sourceMatches.length) throw codedError('SOURCE_OBJECT_NOT_FOUND', '원본 객체를 찾을 수 없습니다.');
  if (sourceMatches.length !== 1) throw codedError('SOURCE_OBJECT_DUPLICATED', '원본 객체가 중복되었습니다.');
  const sourceMatch = sourceMatches[0];
  if (sourceMatch.item.className !== 'UBLabel') throw codedError('UNSUPPORTED_OBJECT_TYPE', `화면 UBLabel이 원본 ${sourceMatch.item.className || 'unknown'} 구조에 매핑되어 현재 MVP에서 수정할 수 없습니다.`);
  const effectiveBand = sourceMatch.item.band || [...sourceMatch.ancestors].reverse().find(value => typeof value?.band === 'string')?.band;
  if (effectiveBand !== bandId) throw codedError('SOURCE_ID_MISMATCH', '원본 객체의 band가 요청과 다릅니다.');
  const bandMatches = source.pages[sourceMatch.pageIndex].items.filter(item => item?.id === bandId);
  if (bandMatches.length !== 1 || !Array.isArray(bandMatches[0].bandItems) || !bandMatches[0].bandItems.includes(sourceObjectId)) {
    throw codedError('SOURCE_ID_MISMATCH', '원본 객체와 band의 구조적 관계를 확인할 수 없습니다.');
  }
  if (decodedText(sourceMatch.item.text) !== expectedBefore) throw codedError('BEFORE_VALUE_MISMATCH', '원본 객체의 현재 문구가 요청한 기존 문구와 일치하지 않습니다.');

  const candidate = readForm(candidateFormPath);
  const beforePages = JSON.parse(JSON.stringify(candidate.pages));
  const matches = findObjects(candidate.pages, sourceObjectId);
  if (matches.length !== 1) throw codedError(matches.length ? 'SOURCE_OBJECT_DUPLICATED' : 'SOURCE_OBJECT_NOT_FOUND', '후보의 대상 객체 수가 1개가 아닙니다.');
  matches[0].item.text = encodeURIComponent(after);
  const expectedPath = `pages/${matches[0].pageIndex}/${matches[0].keyPath.join('/')}/text`;
  const structuralDiff = diff(beforePages, candidate.pages);
  if (structuralDiff.length !== 1 || structuralDiff[0].path !== expectedPath) throw codedError('FORM_PATCH_FAILED', '예상하지 못한 구조 변경이 감지되었습니다.');
  writeForm(candidateFormPath, candidate);

  let reparsed;
  try { reparsed = readForm(candidateFormPath); } catch (_) { throw codedError('FORM_REPARSE_FAILED', '저장한 후보 폼을 다시 파싱할 수 없습니다.'); }
  const saved = findObjects(reparsed.pages, sourceObjectId);
  const savedDiff = diff(source.pages, reparsed.pages);
  if (saved.length !== 1 || decodedText(saved[0].item.text) !== after || savedDiff.length !== 1 || savedDiff[0].path !== expectedPath) {
    throw codedError('FORM_REPARSE_FAILED', '저장 후 후보 폼 검증에 실패했습니다.');
  }
  assertHash(sourceFormPath, sourceHash);
  return { success: true, sourceObjectId, matchedObjects: 1, changedObjects: 1, before: expectedBefore, after, candidateSha256: sha256File(candidateFormPath), structuralDiff: savedDiff, originalFormSha256: sourceHash };
}

module.exports = { readForm, writeForm, findObjects, diff, effectiveBand, bandRelation, inspectSourceObject, patchFormProperties, patchFormText, decodedText };
