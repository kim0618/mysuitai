const fs=require('fs'),path=require('path'),crypto=require('crypto');
const config=require('../config');
const {readForm,writeForm}=require('../services/form-patch-service');
const {sha256File,assertHash}=require('../services/integrity-service');
const {validateSemanticModel}=require('./semantic-validator');
const {createImportedDataset,decodeImportedRows}=require('./dataset-generator');
const {writeDatasetBinding,writeSystemFunction,aggregateExpression,pageExpression}=require('./binding-writer');
const GROUND='/home/tjd618/mysuit-ai-viewer/test-input/edu_01.ubjf',FORM='DynamicReport';
const NAME=/^dynamic_mvp31_\d{8}_\d{6}_[a-f0-9]{6}$/;
const clone=x=>JSON.parse(JSON.stringify(x));
function makeName(date=new Date()){const p=n=>String(n).padStart(2,'0'),s=`${date.getFullYear()}${p(date.getMonth()+1)}${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;return`dynamic_mvp31_${s}_${crypto.randomBytes(3).toString('hex')}`}
function safePath(name){if(!NAME.test(name))throw Object.assign(new Error('Dynamic project name이 올바르지 않습니다.'),{code:'DYNAMIC_PROJECT_INVALID'});return path.join(config.projectsRoot,name)}
function prototypes(){const parsed=readForm(GROUND),items=parsed.pages[0].items;return{dataset:parsed.root.datasets[0],byId:new Map(items.map(x=>[x.id,x]))}}
function remapTable(table,id,band,nextCell){table.id=id;table.band=band;for(const wrapper of table.table.flat())if(wrapper.cell)wrapper.cell.id=nextCell();return table}
function setStatic(cell,text){cell.text=encodeURIComponent(text);delete cell.dataType;delete cell.dataSet;delete cell.column;delete cell.systemFunction;return cell}
function assemble(model,projectName){
 const source=prototypes(),dsModel=model.datasets[0],group=model.groups[0],bandIds={PAGE_HEADER:'DPHB0001',DATA_HEADER:'DDHB0001',GROUP_HEADER:'DGHB0001',DATA:'DDB0001',GROUP_FOOTER:'DGFB0001',DATA_FOOTER:'DDFB0001',PAGE_FOOTER:'DPFB0001'};
 const spec=[['UPHB0981','PAGE_HEADER'],['UDHB3351','DATA_HEADER'],['UGHB0811','GROUP_HEADER'],['UDB6169','DATA'],['UGFB4830','GROUP_FOOTER'],['UDFB9389','DATA_FOOTER'],['UPFB4921','PAGE_FOOTER']];
 const bands=spec.map(([pid,type],index)=>{const b=clone(source.byId.get(pid));b.id=bandIds[type];b.y=[0,195,308,384,503,626,1073][index];b.bandItems=[];return b});
 const band=new Map(spec.map(([,type],i)=>[type,bands[i]]));
 band.get('GROUP_HEADER').dataSet=dsModel.id;band.get('GROUP_HEADER').column=group.key;band.get('GROUP_HEADER').columns=[{orderBy:false,numeric:false,column:group.key}];band.get('GROUP_HEADER').height=0;
 band.get('GROUP_FOOTER').groupHeader=bandIds.GROUP_HEADER;band.get('GROUP_FOOTER').columns=[group.key];
 let ci=1;const nextCell=()=>`DPCL${String(ci++).padStart(4,'0')}`;let ti=1;const table=(pid,type)=>{const t=remapTable(clone(source.byId.get(pid)),`DPTB${String(ti++).padStart(4,'0')}`,bandIds[type],nextCell);band.get(type).bandItems.push(t.id);return t};
 const title=table('TB9069','PAGE_HEADER');setStatic(title.table[0][0].cell,model.title);
 const meta=table('TB8383','PAGE_HEADER');setStatic(meta.table[0][0].cell,'Source');setStatic(meta.table[0][1].cell,'Manual Semantic v0.1');
 const date=table('TB2902157','PAGE_HEADER');setStatic(date.table[0][0].cell,'Generated');writeSystemFunction(date.table[0][1].cell,'FN.Today() + FN.Now()');
 const header=table('TB5066','DATA_HEADER');header.table[0].forEach((w,i)=>setStatic(w.cell,model.headers[i]));
 const detail=table('TB1414542','DATA');if(detail.rowCount!==1||detail.table.length!==1||detail.table[0].length!==6)throw Object.assign(new Error('Detail prototype이 1x6이 아닙니다.'),{code:'DYNAMIC_FLATTENING_DETECTED'});detail.table[0].forEach((w,i)=>writeDatasetBinding(w.cell,dsModel.id,model.detailColumns[i]));
 const gf=table('TB2630981','GROUP_FOOTER'),gLabel=`FN.getDataSetValue('${dsModel.id}','${model.groupFooter.labelColumn}') + "${model.groupFooter.suffix}"`;writeSystemFunction(gf.table[0][0].cell,gLabel);writeSystemFunction(gf.table[0][5].cell,aggregateExpression(model.groupFooter.aggregate));
 const df=table('TB1418363','DATA_FOOTER');setStatic(df.table[0][0].cell,model.dataFooter.label);writeSystemFunction(df.table[0][5].cell,aggregateExpression(model.dataFooter.aggregate));
 const pf=table('TB4312','PAGE_FOOTER');writeSystemFunction(pf.table[0][0].cell,pageExpression(model.pageFooter));
 const tables=[title,meta,date,header,detail,gf,df,pf],dataset=createImportedDataset(source.dataset,dsModel);
 const root={useMasterDetail:false,clientEditMode:'Off',datasets:[dataset],desc:'Dynamic MVP 3.1',pw:'',projectType:3,eventScript:'',projectName, pageHeight:model.page.height,pageWidth:model.page.width,params:[],formId:FORM,pages:[]};
 const page={reportType:'3',width:model.page.width,height:model.page.height,id:'page1',docType:'0',items:[...bands,...tables]};return{root,pages:[page]};
}
function signature(parsed){const p=parsed.pages[0],bands=p.items.filter(x=>/Band$/.test(x.className)),tables=p.items.filter(x=>x.className==='UBTable'),dataBand=bands.find(x=>x.className==='UBDataBand'),detail=tables.find(x=>x.band===dataBand.id),dataset=parsed.root.datasets[0];return{datasets:parsed.root.datasets.length,columns:dataset.columns.length,rows:decodeImportedRows(dataset).length,bands:bands.length,tables:tables.length,dataBandRows:detail.rowCount,dataBandCells:detail.table.flat().filter(x=>x.cell).length,groupHeaders:bands.filter(x=>x.className==='UBGroupHeaderBand').length,groupFooters:bands.filter(x=>x.className==='UBGroupFooterBand').length,dataFooters:bands.filter(x=>x.className==='UBDataFooterBand').length,pageFooters:bands.filter(x=>x.className==='UBPageFooterBand').length,detailTableId:detail.id,detailCellIds:detail.table[0].map(x=>x.cell.id)}}
function assertDynamic(parsed){const s=signature(parsed);if(s.datasets!==1||s.columns!==6||s.bands!==7||s.dataBandRows!==1||s.dataBandCells!==6||s.groupHeaders!==1||s.groupFooters!==1||s.dataFooters!==1||s.pageFooters!==1)throw Object.assign(new Error('Dynamic source signature가 올바르지 않습니다.'),{code:'DYNAMIC_SERIALIZATION_FAILED',signature:s});if(s.dataBandRows===s.rows)throw Object.assign(new Error('Dataset rows가 Source Detail로 flatten되었습니다.'),{code:'DYNAMIC_FLATTENING_DETECTED'});return s}
function createDynamicProject(input,options={}){const model=validateSemanticModel(input),projectName=options.projectName||makeName(),target=safePath(projectName),temp=`${target}.creating`,groundHash=sha256File(GROUND);if(fs.existsSync(target)||fs.existsSync(temp))throw Object.assign(new Error('Project가 이미 존재합니다.'),{code:'DYNAMIC_PROJECT_INVALID'});try{fs.mkdirSync(path.join(temp,FORM),{recursive:true});const parsed=assemble(model,projectName);assertDynamic(parsed);const formPath=path.join(temp,FORM,'form.ubjf');writeForm(formPath,parsed);const reparsed=readForm(formPath),sourceSignature=assertDynamic(reparsed);fs.copyFileSync(path.join(config.projectsRoot,'sample','SampleReport_FreeForm','info.xml'),path.join(temp,FORM,'info.xml'));fs.writeFileSync(path.join(temp,'dynamic-import-meta.json'),JSON.stringify({origin:'DYNAMIC_IMPORTED',version:'MVP-3.1',projectName,formName:FORM,semanticVersion:model.version,sourceSignature,createdAt:new Date().toISOString()},null,2)+'\n');fs.renameSync(temp,target);assertHash(GROUND,groundHash);return{projectName,formName:FORM,root:target,formPath:path.join(target,FORM,'form.ubjf'),sourceSignature,formSha256:sha256File(path.join(target,FORM,'form.ubjf')),previewUrl:`/mysuit/UView5/index.jsp?projectName=${projectName}&formName=${FORM}`,groundTruthIntegrity:true};}catch(e){if(fs.existsSync(temp))fs.rmSync(temp,{recursive:true,force:false});assertHash(GROUND,groundHash);throw e}}
module.exports={GROUND,FORM,NAME,makeName,safePath,assemble,signature,assertDynamic,createDynamicProject};
