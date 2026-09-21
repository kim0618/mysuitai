const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { patchFormText, readForm } = require('../src/server/services/form-patch-service');
const { sha256File } = require('../src/server/services/integrity-service');

function fixture(dir, items) {
  const root={pages:[JSON.stringify({items})]};const b=zlib.deflateSync(Buffer.from(JSON.stringify(root))).toString('base64');const file=path.join(dir,'form.ubjf');fs.writeFileSync(file,b.match(/.{1,76}/g).join('\r\n')+'\r\n');return file;
}
const items=id=>[{id:'BAND1',className:'UBPageHeaderBand',bandItems:[id]},{id,className:'UBLabel',band:'BAND1',text:encodeURIComponent('before')}];
test('patches exactly one object and preserves source',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp3-form-'));const source=fixture(d,items('LABEL1'));const candidate=path.join(d,'candidate.ubjf');fs.copyFileSync(source,candidate);const hash=sha256File(source);const result=patchFormText({sourceFormPath:source,candidateFormPath:candidate,sourceObjectId:'LABEL1',bandId:'BAND1',expectedBefore:'before',after:'after'});assert.equal(result.changedObjects,1);assert.equal(result.structuralDiff.length,1);assert.equal(sha256File(source),hash);assert.equal(decodeURIComponent(readForm(candidate).pages[0].items[1].text),'after');fs.rmSync(d,{recursive:true})});
test('rejects same paths',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp3-form-'));const source=fixture(d,items('LABEL1'));assert.throws(()=>patchFormText({sourceFormPath:source,candidateFormPath:source,sourceObjectId:'LABEL1',bandId:'BAND1',expectedBefore:'before',after:'after'}),/같습니다/);fs.rmSync(d,{recursive:true})});
test('rejects missing, duplicate, and before mismatch',()=>{for(const mode of ['missing','duplicate','before']){const d=fs.mkdtempSync(path.join(os.tmpdir(),'mvp3-form-'));let sourceItems=items('LABEL1');if(mode==='duplicate')sourceItems.push({...sourceItems[1]});const source=fixture(d,sourceItems),candidate=path.join(d,'c.ubjf');fs.copyFileSync(source,candidate);const args={sourceFormPath:source,candidateFormPath:candidate,sourceObjectId:mode==='missing'?'NONE':'LABEL1',bandId:'BAND1',expectedBefore:mode==='before'?'wrong':'before',after:'after'};assert.throws(()=>patchFormText(args));fs.rmSync(d,{recursive:true})}});
