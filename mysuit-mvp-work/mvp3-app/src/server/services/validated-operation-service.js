const validator=require('./operation-validator'),structure=require('./structure-operation-service'),render=require('./render-patch-service'),changes=require('./changeset-service'),history=require('./history-service');
function structureBody(request,resolved){const p=request.payload||{},base={layoutDraftId:request.draftId||request.layoutDraftId,projectName:request.projectName,formName:request.formName,operation:request.operation,logicalTableKey:resolved.logicalTableKey,columnIndex:resolved.columnIndex,logicalRowKey:resolved.logicalRowKey,compositeTableKey:resolved.compositeTableKey,tableType:resolved.tableType,sourceTableId:resolved.sourceTableId,headerTableId:resolved.headerTableId,detailTableId:resolved.detailTableId,headerCellId:resolved.headerCellId,detailCellId:resolved.detailCellId};if(request.operation==='resizeColumn')base.afterWidth=Number(p.width);if(request.operation==='moveColumn'){base.originalVisualIndex=resolved.columnIndex;base.toVisualIndex=Number(p.toVisualIndex);base.groupKey=p.groupKey||resolved.groupKey}if(request.operation==='resizeRow'){base.beforeHeight=p.beforeHeight;base.afterHeight=Number(p.height)}if(request.operation==='moveTable'){base.before=p.before;base.after=p.after}if(request.operation==='resizeTableWidth'){base.beforeWidth=p.beforeWidth;base.afterWidth=Number(p.width)}return base}
function descriptor(scope,operation,target,payload){return{scope,operation,target,before:payload.before||{},after:payload.after||('value'in payload?{value:payload.value}:{...payload})}}
function targetMatches(op,target){return target.logicalColumnKey?op.logicalColumnKey===target.logicalColumnKey:target.logicalRowKey?op.logicalRowKey===target.logicalRowKey:target.compositeTableKey?op.compositeTableKey===target.compositeTableKey:false}
function restoreStructure(scope,request,target,payload){const active={restoreColumn:'hideColumn',restoreRow:'hideRow',restoreTable:'hideTable'}[request.operation],current=structure.list(scope).find(x=>x.operation===active&&targetMatches(x,target));if(!current)throw Object.assign(new Error('복원할 활성 Operation이 없습니다.'),{code:'TARGET_NOT_FOUND',status:404});return history.transact(scope,descriptor('STRUCTURE',request.operation,target,payload),()=>structure.remove(current.operationId,scope))}
function executeValidatedOperation(request){
  const valid=validator.assertValid(request),scope={layoutDraftId:request.draftId||request.layoutDraftId,projectName:request.projectName,formName:request.formName},target=valid.target,payload=request.payload||{};
  if(['LOGICAL_COLUMN','LOGICAL_ROW','COMPOSITE_TABLE'].includes(target.targetType)){
    const tx=request.operation.startsWith('restore')?restoreStructure(scope,request,target,payload):history.transact(scope,descriptor('STRUCTURE',request.operation,target,payload),()=>structure.upsert(structureBody(request,target)));
    return{operation:tx.result,historyEvent:tx.event,history:tx.history,validation:valid};
  }
  if(request.operation==='moveRenderObject'){
    const body={...scope,...request.renderPatch,viewerObjectId:target.viewerObjectId,sourceObjectId:target.sourceObjectId,renderInstanceKey:target.renderInstanceKey,before:payload.before,after:payload.after},tx=history.transact(scope,descriptor('RENDER_POSITION',request.operation,target,payload),()=>render.upsert(body));
    return{patch:tx.result,historyEvent:tx.event,history:tx.history,validation:valid};
  }
  const cs=changes.get(request.changeSetId);if(cs.layoutDraftId!==scope.layoutDraftId)throw Object.assign(new Error('Change Set과 Draft가 일치하지 않습니다.'),{code:'INVALID_OPERATION_SCOPE',status:409});
  const property=request.operation==='resizeObject'?payload.property:{updateText:'text',setFontSize:'fontSize',setFontWeight:'fontWeight',setTextAlign:'textAlign',hideObject:'visible',restoreObject:'visible'}[request.operation];
  const after=request.operation==='hideObject'?false:request.operation==='restoreObject'?true:payload.value;
  const patch={...request.sourcePatch,viewerObjectId:target.viewerObjectId,sourceObjectId:target.sourceObjectId,scope:'SOURCE_OBJECT_ALL_INSTANCES',operation:'updateProperty',viewerProperty:property,sourceProperty:property,before:payload.before,after};
  const tx=history.transact(scope,descriptor('SOURCE_PATCH',request.operation,target,payload),()=>changes.addPatch(request.changeSetId,patch));
  return{changeSet:tx.result,historyEvent:tx.event,history:tx.history,validation:valid};
}
module.exports={executeValidatedOperation};
