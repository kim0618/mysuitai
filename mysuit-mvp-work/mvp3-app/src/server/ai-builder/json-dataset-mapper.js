const VERSION='1.0';
function columnBase(path){return path.replace(/^\$\.?/,'').replace(/\[\]/g,'__item').replace(/[^A-Za-z0-9가-힣_]+/g,'__').replace(/^_+|_+$/g,'')||'value';}
function build(schema,existingIds=[]){const used=new Set(existingIds),base='ai_input';let id=base,index=2;while(used.has(id))id=`${base}_${index++}`;const columns=[],row={},mapping=[];const names=new Set();for(const node of schema.scalarLeaves){let name=columnBase(node.path),suffix=2;while(names.has(name))name=`${columnBase(node.path)}_${suffix++}`;names.add(name);columns.push({name});row[name]=node.value;mapping.push({jsonPath:node.path,datasetId:id,column:name});}return{mapperVersion:VERSION,dataset:{id,columns,rows:[row]},mapping};}
module.exports={VERSION,columnBase,build};
