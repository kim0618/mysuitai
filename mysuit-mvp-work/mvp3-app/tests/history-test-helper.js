const fs=require('fs'),path=require('path'),config=require('../src/server/config'),history=require('../src/server/services/history-service'),changes=require('../src/server/services/changeset-service'),structure=require('../src/server/services/structure-operation-service'),render=require('../src/server/services/render-patch-service'),binding=require('../src/server/services/binding-operation-service');
const files=['history.json','changesets.json','structure-operations.json','render-patches.json','binding-operations.json','structural-history.json'].map(x=>path.join(config.appRoot,'data',x));
function backup(){return new Map(files.map(file=>[file,fs.existsSync(file)?fs.readFileSync(file):null]))}
function restore(saved){for(const[file,value]of saved)value===null?fs.rmSync(file,{force:true}):fs.writeFileSync(file,value)}
function scope(suffix){return{layoutDraftId:`mvp58_${suffix}_${process.pid}`,projectName:'sample',formName:'sample'}}
function setup(s){changes.create(s);history.clear(s);structure.clear(s);render.clear(s);binding.clear(s)}
function cleanup(s){try{history.clear(s)}catch(_){}try{structure.clear(s)}catch(_){}try{render.clear(s)}catch(_){}try{binding.clear(s)}catch(_){}const all=changes.load().filter(x=>x.layoutDraftId!==s.layoutDraftId);fs.writeFileSync(path.join(config.appRoot,'data/changesets.json'),JSON.stringify(all,null,2)+'\n')}
module.exports={backup,restore,scope,setup,cleanup,history,changes,structure,render,binding};
