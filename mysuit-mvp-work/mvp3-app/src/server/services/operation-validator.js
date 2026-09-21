const registry=require('./operation-registry'),capability=require('./capability-service'),structure=require('./structure-operation-service'),history=require('./history-service');
function invalid(code,message,details={}){return{valid:false,code,message,details}}
function scopeOf(request={}){return{layoutDraftId:request.layoutDraftId||request.draftId,projectName:request.projectName,formName:request.formName}}
function schema(entry,payload={}){
  for(const key of entry.requiredPayload)if(payload[key]===undefined)return invalid('INVALID_PAYLOAD',`payload.${key} 값이 필요합니다.`,{field:key});
  const op=entry.operation;
  if(['resizeColumn','resizeTableWidth','resizeRow','setFontSize'].includes(op)){
    const key={resizeColumn:'width',resizeTableWidth:'width',resizeRow:'height',setFontSize:'value'}[op],value=Number(payload[key]),range=op==='resizeColumn'?[20,600]:op==='resizeTableWidth'?[140,1400]:op==='resizeRow'?[12,200]:[6,96];
    if(!Number.isFinite(value)||value<range[0]||value>range[1])return invalid('INVALID_PAYLOAD',`${key} 값의 허용 범위는 ${range[0]}~${range[1]}입니다.`,{field:key,min:range[0],max:range[1],actual:payload[key]});
  }
  if(op==='resizeObject'&&(!['width','height'].includes(payload.property)||!Number.isFinite(Number(payload.value))||Number(payload.value)<1||Number(payload.value)>3000))return invalid('INVALID_PAYLOAD','resizeObject는 width/height와 1~3000 숫자 value가 필요합니다.',{field:'property/value'});
  if(['moveColumn','moveColumns'].includes(op)&&(!Number.isInteger(Number(payload.toVisualIndex))||Number(payload.toVisualIndex)<0||Number(payload.toVisualIndex)>(payload.staticColumnCount?payload.staticColumnCount-1:6)))return invalid('INVALID_PAYLOAD','toVisualIndex는 0~6 정수여야 합니다.',{field:'toVisualIndex'});
  if(['moveRenderedRow','moveRow','moveRows'].includes(op)&&(!Number.isInteger(Number(payload.toRowIndex))||Number(payload.toRowIndex)<0||Number(payload.toRowIndex)>99))return invalid('INVALID_PAYLOAD','toRowIndex는 0~99 정수여야 합니다.',{field:'toRowIndex'});
  if(op==='moveObject'&&(!['left','top'].includes(payload.property)||!Number.isFinite(Number(payload.value))||Number(payload.value)<0||Number(payload.value)>3000))return invalid('INVALID_PAYLOAD','moveObject는 left/top과 0~3000 숫자 value가 필요합니다.',{field:'property/value'});
  if(op==='setImageFit'&&![0,1,3].includes(payload.value))return invalid('INVALID_PAYLOAD','지원하지 않는 이미지 맞춤입니다.',{field:'value'});
  if(op==='replaceImage')try{require('./image-asset-service').assertUsable(payload.value)}catch(e){return invalid(e.code||'INVALID_PAYLOAD',e.message,{field:'value'})}
  if(op==='updateText'&&typeof payload.value!=='string')return invalid('INVALID_PAYLOAD','문구는 문자열이어야 합니다.',{field:'value'});
  if(op==='setFontWeight'&&!['normal','bold'].includes(payload.value))return invalid('INVALID_PAYLOAD','지원하지 않는 굵기입니다.',{field:'value'});
  if(op==='setTextAlign'&&!['left','center','right'].includes(payload.value))return invalid('INVALID_PAYLOAD','지원하지 않는 정렬입니다.',{field:'value'});
  if(['moveRenderObject','moveTable'].includes(op)){const p=payload.after;if(!p||!Number.isFinite(Number(p.left))||!Number.isFinite(Number(p.top)))return invalid('INVALID_PAYLOAD','after.left/top 숫자가 필요합니다.',{field:'after'});}
  return{valid:true};
}
function validate(request={}){
  const entry=registry.get(request.operation);if(!entry)return invalid('UNSUPPORTED_OPERATION','등록되지 않은 Operation입니다.',{operation:request.operation});
  const scope=scopeOf(request);let caps;
  try{caps=capability.getCapabilities(scope,request.targetType||entry.targetType,request.target||{})}catch(e){return invalid(e.code||'TARGET_NOT_FOUND',e.message,e.details||{})}
  if(caps.targetType!==entry.targetType)return invalid('UNSUPPORTED_TARGET_TYPE','Operation과 Target Type이 일치하지 않습니다.',{expected:entry.targetType,actual:caps.targetType});
  const payload=request.payload||{},shape=schema(entry,payload);if(!shape.valid)return shape;
  if(request.operation==='addBoundColumn'&&!(payload.dataSet==='dataset_2'&&payload.column==='col_8'))return invalid('BINDING_DEPENDENCY','검증되지 않은 Dataset binding입니다.',{allowed:'dataset_2.col_8'});
  const cap=caps.capabilities[request.operation];if(!cap?.allowed)return invalid(cap?.reason||'UNSUPPORTED_OPERATION',cap?.message||'이 대상에서는 Operation을 실행할 수 없습니다.',cap?.constraints||{});
  if(request.operation==='moveRenderObject'&&!caps.target.renderInstanceKey)return invalid('RENDER_INSTANCE_ONLY','위치 이동에는 정확한 Render Instance Key가 필요합니다.');
  if(request.operation==='moveColumn'&&payload.groupKey&&payload.groupKey!==caps.target.groupKey)return invalid('GROUP_BOUNDARY_MOVE_NOT_ALLOWED','다른 Column Group으로 이동할 수 없습니다.',{expectedGroup:caps.target.groupKey,requestedGroup:payload.groupKey});
  if(['resizeColumn','resizeTableWidth'].includes(request.operation))try{const op=request.operation==='resizeColumn'?{...scope,...caps.target,operation:'resizeColumn',columnIndex:caps.target.columnIndex,afterWidth:Number(payload.width)}:{...scope,...caps.target,operation:'resizeTableWidth',compositeTableKey:caps.target.compositeTableKey,afterWidth:Number(payload.width)};structure.guardWidth(structure.list(scope),op)}catch(e){return invalid(e.code||'TABLE_WIDTH_OVERFLOW',e.message,{currentWidth:e.currentWidth,requestedWidth:e.requestedWidth,maximumWidth:e.maxWidth})}
  try{const h=history.get(scope);if(h.events.length>=history.LIMIT)return invalid('HISTORY_LIMIT_REACHED',`History는 최대 ${history.LIMIT}개까지 저장할 수 있습니다.`,{limit:history.LIMIT})}catch(e){return invalid(e.code||'INVALID_HISTORY_SCOPE',e.message)}
  return{valid:true,operation:request.operation,target:caps.target,maturity:entry.maturity,support:entry.support,constraints:cap.constraints};
}
function assertValid(request){const result=validate(request);if(!result.valid)throw Object.assign(new Error(result.message),{code:result.code,status:result.code==='TARGET_NOT_FOUND'?404:['INVALID_PAYLOAD','UNSUPPORTED_OPERATION','UNSUPPORTED_TARGET_TYPE'].includes(result.code)?400:409,details:result.details});return result}
function fromStructure(body){let targetType='LOGICAL_COLUMN',target={logicalColumnKey:body.logicalColumnKey,logicalTableKey:body.logicalTableKey,columnIndex:body.columnIndex??body.columnIndexes?.[0]},payload={};if(['resizeRow','hideRow','collapseRow','restoreRow','moveRenderedRow','moveRow','moveRows','removeRow'].includes(body.operation)){targetType='LOGICAL_ROW';target={logicalRowKey:body.logicalRowKey||body.logicalRowKeys?.[0]}}else if(['moveTable','resizeTableWidth','hideTable','collapseTable','restoreTable'].includes(body.operation)){targetType='COMPOSITE_TABLE';target={compositeTableKey:body.compositeTableKey}}if(body.operation==='resizeColumn')payload.width=body.afterWidth;if(['moveColumn','moveColumns'].includes(body.operation))payload={toVisualIndex:body.toVisualIndex,groupKey:body.groupKey,...(String(body.logicalTableKey||'').startsWith('tbl:static:')?{staticColumnCount:100}:{})};if(body.operation==='resizeRow')payload.height=body.afterHeight;if(['moveRenderedRow','moveRow','moveRows'].includes(body.operation))payload.toRowIndex=body.toRowIndex;if(body.operation==='moveTable')payload.after=body.after;if(body.operation==='resizeTableWidth')payload.width=body.afterWidth;return{...body,draftId:body.layoutDraftId,targetType,target,payload}}
function fromRender(body){return{...body,draftId:body.layoutDraftId,targetType:'OBJECT',operation:'moveRenderObject',target:{viewerObjectId:body.viewerObjectId,renderInstanceKey:body.renderInstanceKey,runtimeText:body.runtimeText},payload:{after:body.after}}}
function fromSource(body,scope){const property=body.viewerProperty||body.property,operation={text:'updateText',fontSize:'setFontSize',fontWeight:'setFontWeight',textAlign:'setTextAlign',width:'resizeObject',height:'resizeObject',left:'moveObject',top:'moveObject',scaleType:'setImageFit',data:'replaceImage',visible:body.after===false?'hideObject':'restoreObject'}[property];return{...scope,draftId:scope.layoutDraftId,targetType:'OBJECT',operation,target:{viewerObjectId:body.viewerObjectId,runtimeText:body.runtimeText},payload:{property,value:body.after}}}
module.exports={validate,assertValid,fromStructure,fromRender,fromSource,scopeOf};
