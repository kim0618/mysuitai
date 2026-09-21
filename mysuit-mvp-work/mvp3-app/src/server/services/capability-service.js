const path = require('path');
const config = require('../config');
const registry = require('./operation-registry');
const resolver = require('./target-resolver');
const structure = require('./structure-operation-service');
const reflow = require('./vertical-reflow-service');
const { readForm } = require('./form-patch-service');
const formContext = require('./form-context-service');

const reasons = {
  DATA_REPEAT_ROW: '데이터 반복 행은 구조 편집할 수 없습니다.',
  ROWSPAN_DEPENDENCY: '병합 셀 의존성이 있어 이 행을 변경할 수 없습니다.',
  SUMMARY_DEPENDENCY: 'Summary 의존성이 있어 공간을 제거할 수 없습니다.',
  RUNTIME_UI_NOT_CONNECTED: '검증 엔진 POC만 있으며 Runtime UI/Store에 연결되지 않았습니다.',
  HIDDEN_COLUMN_OPERATION_NOT_ALLOWED: '숨긴 열은 이동하거나 크기를 바꿀 수 없습니다.',
  COLSPAN_DEPENDENCY: '병합 셀 의존성이 있어 이 열을 숨길 수 없습니다.',
  STATIC_TABLE_ONLY: '가져온 정적 표에서만 지원합니다.',
};

function reflowCapabilities(scope) {
  if (formContext.resolve(scope).kind === 'STATIC_SINGLE') return { rowHeader:{canHide:true,canCollapse:false,reflowScope:'TABLE_LOCAL',reason:'static-single-row'},rowGroupHeader:{canHide:true,canCollapse:false,reflowScope:'TABLE_LOCAL',reason:'static-single-row'},rowSummary:{canHide:true,canCollapse:false,reflowScope:'TABLE_LOCAL',reason:'static-single-row'},rowData:{canHide:true,canCollapse:false,reflowScope:'TABLE_LOCAL',reason:'static-single-row'},compositeTable:{canHide:true,canCollapse:false,reflowScope:'PAGE_ABSOLUTE',reason:'static-single-table',pageFooterProtected:true} };
  const form = path.join(config.projectsRoot, scope.projectName, scope.formName, 'form.ubjf');
  return reflow.capabilities(readForm(form));
}

function getCapabilities(scope, targetType, target) {
  const resolved = resolver.resolve(targetType, target, scope);
  const ops = structure.list(scope);
  const flow = reflowCapabilities(scope);
  const capabilities = {};
  for (const entry of registry.list().filter((x) => x.targetType === resolved.targetType)) {
    let allowed = entry.maturity !== 'POC_ONLY';
    let reason = null;
    const constraints = {
      support: entry.support,
      maturity: entry.maturity,
      candidateMaterialization: entry.candidateMaterialization,
    };
    if (entry.maturity === 'POC_ONLY') {
      reason = 'RUNTIME_UI_NOT_CONNECTED';
      constraints.engineValidated = true;
      constraints.runtimeUiConnected = false;
    }
    if (resolved.targetType === 'OBJECT') {
      const property = { updateText:'text', setFontSize:'fontSize', setFontWeight:'fontWeight', setTextAlign:'textAlign', resizeObject:'width', moveObject:'left', setImageFit:'scaleType', replaceImage:'data', hideObject:'visible', restoreObject:'visible' }[entry.operation];
      if (property && !resolved.properties.includes(property)) { allowed = false; reason = 'SOURCE_MAPPING_UNVERIFIED'; }
    }
    if (resolved.targetType === 'LOGICAL_COLUMN') {
      constraints.sameGroupOnly = entry.operation === 'moveColumn';
      constraints.groupKey = resolved.groupKey;
      constraints.maxTableWidth = 792;
      const hidden = ops.some((x) => x.operation === 'hideColumn' && x.columnIndex === resolved.columnIndex && (!resolved.tableType || x.logicalTableKey === resolved.logicalTableKey));
      if (hidden && ['resizeColumn','moveColumn'].includes(entry.operation)) { allowed = false; reason = 'HIDDEN_COLUMN_OPERATION_NOT_ALLOWED'; }
      if (resolved.colSpanDependent && ['hideColumn'].includes(entry.operation)) { allowed = false; reason = 'COLSPAN_DEPENDENCY'; }
      if (entry.operation === 'addBoundColumn') {
        allowed = false; reason = 'RUNTIME_UI_NOT_CONNECTED'; constraints.bindingWhitelist = ['dataset_2.col_8'];
      }
    }
    if (resolved.targetType === 'LOGICAL_ROW') {
      const flowCap = resolved.rowRole === 'STATIC_ROW' ? flow.rowHeader : resolved.rowRole === 'HEADER' ? flow.rowHeader : resolved.rowRole === 'SUMMARY' ? flow.rowSummary : resolved.rowRole === 'GROUP_HEADER' ? flow.rowGroupHeader : flow.rowData;
      constraints.reflowScope = flowCap.reflowScope;
      constraints.reflowEvidence = flowCap.reason;
      if (resolved.rowRole === 'RENDERED_DETAIL' && entry.operation !== 'moveRenderedRow') { allowed = false; reason = 'DATA_REPEAT_ROW'; }
      else if (entry.operation === 'moveRenderedRow' && resolved.rowRole !== 'RENDERED_DETAIL') { allowed = false; reason = 'DATA_REPEAT_ROW'; }
      else if (resolved.rowRole === 'SUMMARY' && ['collapseRow','removeStaticRow'].includes(entry.operation)) { allowed = false; reason = 'SUMMARY_DEPENDENCY'; }
      else if (['moveRow','removeRow'].includes(entry.operation) && resolved.tableType !== 'STATIC_SINGLE') { allowed = false; reason = 'STATIC_TABLE_ONLY'; }
      else if (resolved.rowSpanDependent && ['collapseRow','removeStaticRow','hideRow','moveRow','removeRow'].includes(entry.operation)) { allowed = false; reason = 'ROWSPAN_DEPENDENCY'; }
      else if (entry.operation === 'collapseRow' && !flowCap.canCollapse) { allowed = false; reason = 'CROSS_BAND_REFLOW_UNVERIFIED'; }
    }
    if (resolved.targetType === 'COMPOSITE_TABLE') {
      constraints.reflowScope = flow.compositeTable.reflowScope;
      constraints.pageFooterProtected = flow.compositeTable.pageFooterProtected;
      if (entry.operation === 'collapseTable' && !flow.compositeTable.canCollapse) { allowed = false; reason = 'CROSS_BAND_REFLOW_UNVERIFIED'; }
    }
    capabilities[entry.operation] = { allowed, ...(reason ? { reason, message: reasons[reason] || reason } : {}), constraints };
  }
  return { targetType: resolved.targetType, targetKey: resolved.targetKey, target: resolved, capabilities, constraints: { canonicalSerializer: 'PARTIAL' }, warnings: ['Source Patch + Structure/Reflow 혼합 후보는 canonical serializer가 필요합니다.'] };
}

module.exports = { getCapabilities, reasons };
