const crypto=require('crypto');
const config=require('../config');
const {parseViewerObjectId}=require('../utils/viewer-id-parser');
const {error}=require('./patch-schema');
const formContext=require('../services/form-context-service');
const DRAFT=/^[A-Za-z0-9_-]{1,80}$/;
function coordinate(value,name){if(typeof value!=='number'||!Number.isFinite(value)||value < -5000||value > 5000)throw error('INVALID_RENDER_POSITION',`${name}은 -5000~5000 범위의 유한 숫자여야 합니다.`);return value}
function dimension(value,name){if(typeof value!=='number'||!Number.isFinite(value)||value<=0||value>5000)throw error('INVALID_RENDER_FINGERPRINT',`${name}이 올바르지 않습니다.`);return value}
function instanceKey(body){return`p${body.pageIndex}|c${body.canvasIndex}|src:${body.sourceObjectId}|band:${body.bandId}|row:${body.rowIndex}|idx:${body.renderIndex}`}
function identity(body){
  if(!body||typeof body!=='object')throw error('INVALID_REQUEST','Render Position Patch 객체가 필요합니다.');
  if(!DRAFT.test(body.layoutDraftId||''))throw error('INVALID_LAYOUT_DRAFT_ID','layoutDraftId 형식이 올바르지 않습니다.');
  const context=formContext.resolve(body);
  if(!Number.isInteger(body.pageIndex)||body.pageIndex<0||body.pageIndex>50)throw error('INVALID_PAGE_INDEX','pageIndex가 올바르지 않습니다.');
  if(!Number.isInteger(body.canvasIndex)||body.canvasIndex<0||body.canvasIndex>50)throw error('INVALID_CANVAS_INDEX','canvasIndex가 올바르지 않습니다.');
  if(!Number.isInteger(body.renderIndex)||body.renderIndex<0||body.renderIndex>100000)throw error('INVALID_RENDER_INDEX','renderIndex가 올바르지 않습니다.');
  const parsed=parseViewerObjectId(body.viewerObjectId)||((context.origin==='IMPORTED'&&/^(?:IMPLB|IMPCL)\d{4}$/.test(body.viewerObjectId||''))?{sourceObjectId:body.viewerObjectId,bandId:'FREEFORM',rowIndex:0}:null);if(!parsed)throw error('UNSUPPORTED_VIEWER_ID','지원하지 않는 Viewer ID입니다.');
  if(parsed.sourceObjectId!==body.sourceObjectId||parsed.bandId!==body.bandId||parsed.rowIndex!==body.rowIndex)throw error('SOURCE_ID_MISMATCH','Viewer ID 매핑이 일치하지 않습니다.');
  if(body.className!=='UBLabel')throw error('UNSUPPORTED_RENDER_OBJECT','UBLabel만 위치 이동을 지원합니다.');
  if(body.renderInstanceKey!==instanceKey(body))throw error('RENDER_INSTANCE_KEY_MISMATCH','Render Instance Key가 객체 정보와 일치하지 않습니다.');
  return parsed;
}
function validateRenderPatch(body){identity(body);if(!body.before||!body.after)throw error('INVALID_RENDER_POSITION','before/after 좌표가 필요합니다.');if(!body.originalFingerprint)throw error('INVALID_RENDER_FINGERPRINT','원본 렌더 fingerprint가 필요합니다.');const before={left:coordinate(body.before.left,'before.left'),top:coordinate(body.before.top,'before.top')},after={left:coordinate(body.after.left,'after.left'),top:coordinate(body.after.top,'after.top')},originalFingerprint={left:coordinate(body.originalFingerprint.left,'originalFingerprint.left'),top:coordinate(body.originalFingerprint.top,'originalFingerprint.top'),width:dimension(body.originalFingerprint.width,'originalFingerprint.width'),height:dimension(body.originalFingerprint.height,'originalFingerprint.height')};if(before.left===after.left&&before.top===after.top)throw error('RENDER_PATCH_CONFLICT','변경 전후 위치가 같습니다.');const now=new Date().toISOString();return{patchId:body.patchId||`rp_${now.slice(0,10).replace(/-/g,'')}_${crypto.randomBytes(3).toString('hex')}`,layoutDraftId:body.layoutDraftId,projectName:body.projectName,formName:body.formName,renderInstanceKey:body.renderInstanceKey,pageIndex:body.pageIndex,canvasIndex:body.canvasIndex,renderIndex:body.renderIndex,viewerObjectId:body.viewerObjectId,sourceObjectId:body.sourceObjectId,bandId:body.bandId,rowIndex:body.rowIndex,className:'UBLabel',originalFingerprint,scope:'RENDER_INSTANCE',operation:'updateRenderedPosition',before,after,createdAt:body.createdAt||now,updatedAt:now}}
function validateQuery(query){if(!DRAFT.test(query.layoutDraftId||''))throw error('INVALID_LAYOUT_DRAFT_ID','layoutDraftId 형식이 올바르지 않습니다.');const context=formContext.resolve(query);return{layoutDraftId:query.layoutDraftId,projectName:context.projectName,formName:context.formName}}
module.exports={validateRenderPatch,validateQuery,coordinate,instanceKey};
