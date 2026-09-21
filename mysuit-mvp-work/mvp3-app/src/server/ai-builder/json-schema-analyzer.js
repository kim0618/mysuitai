const MAX_BYTES=1024*1024,VERSION='1.0';
function fail(code,message){throw Object.assign(new Error(message),{code,status:400});}
function typeOf(value){if(value===null)return'null';if(Array.isArray(value))return'array';return typeof value;}
function normalizedPath(parts){return '$'+parts.map(part=>part==='[]'?'[]':`.${String(part).normalize('NFKC')}`).join('');}
function analyze(input){let value=input;if(typeof input==='string'){if(Buffer.byteLength(input)>MAX_BYTES)fail('JSON_SCHEMA_ANALYSIS_FAILED','JSON 크기는 1MB 이하여야 합니다.');try{value=JSON.parse(input)}catch(_){fail('JSON_SCHEMA_ANALYSIS_FAILED','JSON 형식이 올바르지 않습니다.')}}
  const nodes=[];
  function visit(current,parts,parentPath,arrayItem=false){const type=typeOf(current),path=normalizedPath(parts),key=parts.at(-1)==='[]'?String(parts.at(-2)||''):String(parts.at(-1)||'$'),isArray=parts.includes('[]')||type==='array',isLeaf=['string','number','boolean','null'].includes(type);nodes.push({path,normalizedPath:path.toLowerCase(),key,type,value:isLeaf?current:undefined,parentPath,depth:parts.filter(x=>x!=='[]').length,isLeaf,isArray,isArrayItem:arrayItem,sampleValue:isLeaf?current:undefined,status:isArray&&isLeaf?'DEFERRED_ARRAY':undefined});
    if(type==='object')for(const child of Object.keys(current).sort((a,b)=>a.localeCompare(b,'en')))visit(current[child],[...parts,child],path,arrayItem);
    if(type==='array'&&current.length){const representative=current[0];visit(representative,[...parts,'[]'],path,true);}
  }
  visit(value,[],null,false);const arrays=[];
  function collect(current,parts=[]){if(typeOf(current)==='object'){for(const key of Object.keys(current).sort((a,b)=>a.localeCompare(b,'en')))collect(current[key],[...parts,key]);return}if(typeOf(current)!=='array')return;const arrayPath=normalizedPath(parts),base={arrayPath,normalizedPath:arrayPath.toLowerCase(),key:String(parts.at(-1)||''),depth:parts.length,itemCount:current.length,sampleItems:current.slice(0,3),parentPath:normalizedPath(parts.slice(0,-1))};let status='SUPPORTED',itemType='unknown',itemFields=[];
    if(!current.length)status='EMPTY_ARRAY_SCHEMA_UNKNOWN';else{const types=new Set(current.map(typeOf));if(types.size!==1||!types.has('object'))status='UNSUPPORTED_ARRAY_SHAPE';else{itemType='object';const keys=[...new Set(current.flatMap(Object.keys))].sort((a,b)=>a.localeCompare(b,'en'));for(const key of keys){const values=current.map(row=>row[key]).filter(value=>value!==undefined),typesForKey=new Set(values.map(typeOf));if(typesForKey.has('array')||typesForKey.has('object')||typesForKey.size>2||(typesForKey.size===2&&!typesForKey.has('null')))status='UNSUPPORTED_ARRAY_SHAPE';itemFields.push({path:`${arrayPath}[].${key}`,key,type:[...typesForKey].find(type=>type!=='null')||'null',sampleValues:values.slice(0,3),normalizedTokens:String(key).normalize('NFKC').replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().split(/[\s_.-]+/).filter(Boolean)});}}}
    arrays.push({...base,itemType,itemFields,status});
  }
  collect(value);return{schemaVersion:VERSION,nodes,scalarLeaves:nodes.filter(n=>n.isLeaf&&!n.isArray&&n.type!=='null'),deferredArrays:nodes.filter(n=>n.isLeaf&&n.isArray),arrays};
}
module.exports={VERSION,MAX_BYTES,analyze,typeOf,normalizedPath};
