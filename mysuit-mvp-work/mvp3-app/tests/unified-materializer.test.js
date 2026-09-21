const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const config=require('../src/server/config');
const {readForm,findObjects,decodedText}=require('../src/server/services/form-patch-service');
const {sha256File}=require('../src/server/services/integrity-service');
const {materializeUnifiedCandidate,normalizeOperations,semanticSignature}=require('../src/server/ai-builder/unified-materializer');

const baseProject='import_mvp11_20260827_170551_e59e1d',baseForm='SampleReport_FreeForm',tableId='IMPTB0001';
const baseRoot=path.join(config.projectsRoot,baseProject),baseFormPath=path.join(baseRoot,baseForm,'form.ubjf'),baseInfoPath=path.join(baseRoot,baseForm,'info.xml');
const original={form:sha256File(baseFormPath),info:sha256File(baseInfoPath)};
let sequence=0;const made=[];
function name(label){return`foundation01_test_${process.pid}_${++sequence}_${label}`;}
function source(){return{operation:'updateText',target:{objectId:'IMPLB0001'},before:{text:'월간 실적 보고서'},after:{text:'AI Builder 통합 보고서'}};}
function structure(){return{operation:'resizeColumn',sourceTableId:tableId,columnIndex:1,beforeWidth:210,afterWidth:225};}
function binding(target='IMPLB0002'){return{operation:'bindField',target:{objectId:target},before:null,after:{dataType:'1',dataSet:'ai_builder_test',column:'applicantName',text:'{ai_builder_test.applicantName}'}};}
const datasets=[{id:'ai_builder_test',columns:['applicantName'],rows:[{applicantName:'홍길동'}]}];
function run(label,extra={}){const destinationProject=name(label);made.push(destinationProject);return materializeUnifiedCandidate({baseProject,baseForm,destinationProject,...extra});}
function parsed(result){return readForm(result.candidateFormPath);}
test.after(()=>{for(const project of made){const target=path.join(config.projectsRoot,project);if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:false});}assert.equal(sha256File(baseFormPath),original.form);assert.equal(sha256File(baseInfoPath),original.info);});

test('same-operation normalization keeps first before and last after',()=>{const ops=normalizeOperations({sourcePatches:[source(),{...source(),before:{text:'AI Builder 통합 보고서'},after:{text:'최종'}}],structureOperations:[structure(),{...structure(),afterWidth:240}],bindingOperations:[binding(),{...binding(),after:{dataType:'3',parameter:'applicantName'}}]});assert.equal(ops.source.length,1);assert.deepEqual(ops.source[0].before,{text:'월간 실적 보고서'});assert.deepEqual(ops.source[0].after,{text:'최종'});assert.equal(ops.structure[0].afterWidth,240);assert.equal(ops.binding[0].after.dataType,'3');});
test('SOURCE only materialization',()=>{const result=run('source',{sourcePatches:[source()]});assert.equal(decodedText(findObjects(parsed(result).pages,'IMPLB0001')[0].item.text),'AI Builder 통합 보고서');});
test('STRUCTURE only materialization',()=>{const p=parsed(run('structure',{structureOperations:[structure()]}));const table=findObjects(p.pages,tableId)[0].item;assert.equal(table.table[0][1].width,225);});
test('BINDING only materialization',()=>{const p=parsed(run('binding',{datasets,bindingOperations:[binding()]}));const item=findObjects(p.pages,'IMPLB0002')[0].item;assert.deepEqual([item.dataType,item.dataSet,item.column],['1','ai_builder_test','applicantName']);});
for(const [label,extra] of [['source_structure',{sourcePatches:[source()],structureOperations:[structure()]}],['source_binding',{sourcePatches:[source()],datasets,bindingOperations:[binding()]}],['structure_binding',{structureOperations:[structure()],datasets,bindingOperations:[binding()]}],['all',{sourcePatches:[source()],structureOperations:[structure()],datasets,bindingOperations:[binding()]}]])test(label.replace('_',' + '),()=>{const result=run(label,extra);assert.equal(result.validation.parseBack,true);assert.deepEqual(result.operationCounts,{source:extra.sourcePatches?.length||0,structure:extra.structureOperations?.length||0,binding:extra.bindingOperations?.length||0});});
test('missing source target fails without publish',()=>{assert.throws(()=>run('missing_source',{sourcePatches:[{...source(),target:{objectId:'MISSING'}}]}),e=>e.code==='SOURCE_TARGET_NOT_FOUND');});
test('missing structure target fails without publish',()=>{assert.throws(()=>run('missing_structure',{structureOperations:[{...structure(),sourceTableId:'MISSING'}]}),e=>e.code==='STRUCTURE_TARGET_NOT_FOUND');});
test('missing binding target fails without publish',()=>{assert.throws(()=>run('missing_binding',{datasets,bindingOperations:[binding('MISSING')]}),e=>e.code==='BINDING_TARGET_NOT_FOUND');});
test('removed target plus binding conflict fails',()=>{assert.throws(()=>run('conflict',{structureOperations:[{operation:'removeObject',target:{objectId:'IMPLB0002'},sourceTableId:tableId}],datasets,bindingOperations:[binding()]}),e=>e.code==='TARGET_REMOVED_BEFORE_BINDING');});
test('deterministic semantic repeat and parse-back equality',()=>{const signatures=[0,1,2].map(i=>run(`det${i}`,{sourcePatches:[source()],structureOperations:[structure()],datasets,bindingOperations:[binding()]}).signature);assert.equal(new Set(signatures).size,1);for(const project of made.filter(x=>x.includes('_det')))assert.equal(semanticSignature(readForm(path.join(config.projectsRoot,project,baseForm,'form.ubjf'))),signatures[0]);});
test('atomic publish failure leaves no candidate and preserves original',()=>{const destinationProject=name('atomic');made.push(destinationProject);assert.throws(()=>materializeUnifiedCandidate({baseProject,baseForm,destinationProject,sourcePatches:[source()],structureOperations:[structure()],datasets,bindingOperations:[binding()],injectFailureAt:'after-write'}),e=>e.code==='ATOMIC_PUBLISH_FAILED');assert.equal(fs.existsSync(path.join(config.projectsRoot,destinationProject)),false);assert.equal(sha256File(baseFormPath),original.form);assert.equal(sha256File(baseInfoPath),original.info);});
