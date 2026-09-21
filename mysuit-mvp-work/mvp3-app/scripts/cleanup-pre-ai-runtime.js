const fs=require('fs'),path=require('path');
const app=path.resolve(__dirname,'..'),exact=new Set(['mvp57_direct_e2e','mvp58_compound_e2e','mvp58_branch_e2e','mvp58_source_smoke','mvp59_e2e','mvp59_api_unit','mvp59_capability_unit','mvp59_validation_unit','mvp59_snapshot','pre_ai_demo']);
function atomic(file,value){const temp=`${file}.${process.pid}.tmp`;fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,file)}
const changesFile=path.join(app,'data/changesets.json');if(fs.existsSync(changesFile)){const all=JSON.parse(fs.readFileSync(changesFile,'utf8')),kept=all.filter(x=>!exact.has(x.layoutDraftId));atomic(changesFile,kept)}
for(const [name,key] of [['structure-operations.json','operations'],['render-patches.json','patches']]){const file=path.join(app,'data',name);if(!fs.existsSync(file))continue;const root=JSON.parse(fs.readFileSync(file,'utf8')),values=Array.isArray(root)?root:root[key]||[],kept=values.filter(x=>!exact.has(x.layoutDraftId));atomic(file,Array.isArray(root)?kept:{...root,[key]:kept})}
const historyFile=path.join(app,'data/history.json');if(fs.existsSync(historyFile)){const root=JSON.parse(fs.readFileSync(historyFile,'utf8'));for(const key of Object.keys(root.drafts||{}))if(exact.has(key.split('|')[0]))delete root.drafts[key];atomic(historyFile,root)}
console.log(JSON.stringify({success:true,removedDraftIds:[...exact]}));
