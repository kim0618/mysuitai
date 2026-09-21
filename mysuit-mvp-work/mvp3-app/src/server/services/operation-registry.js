const SUPPORT = {
  FULL: { viewer: true, source: true, pdf: true },
  VIEWER_ONLY: { viewer: true, source: false, pdf: false },
  NONE: { viewer: false, source: false, pdf: false },
};

const entries = [
  ['updateText','OBJECT','STABLE','FULL',['value']],
  ['setFontSize','OBJECT','STABLE','FULL',['value']],
  ['setFontWeight','OBJECT','STABLE','FULL',['value']],
  ['setTextAlign','OBJECT','STABLE','FULL',['value']],
  ['resizeObject','OBJECT','STABLE','FULL',['property','value']],
  ['moveObject','OBJECT','STABLE','FULL',['property','value']],
  ['setImageFit','OBJECT','STABLE','FULL',['value']],
  ['replaceImage','OBJECT','STABLE','FULL',['value']],
  ['hideObject','OBJECT','STABLE','FULL',[]],
  ['restoreObject','OBJECT','STABLE','FULL',[]],
  ['moveRenderObject','OBJECT','LIMITED','VIEWER_ONLY',['after']],
  ['resizeColumn','LOGICAL_COLUMN','STABLE','FULL',['width']],
  ['moveColumn','LOGICAL_COLUMN','STABLE','FULL',['toVisualIndex']],
  ['moveColumns','LOGICAL_COLUMN','STABLE','FULL',['toVisualIndex']],
  ['hideColumn','LOGICAL_COLUMN','STABLE','FULL',[]],
  ['restoreColumn','LOGICAL_COLUMN','STABLE','FULL',[]],
  ['addStaticColumn','LOGICAL_COLUMN','POC_ONLY','FULL',[]],
  ['addBoundColumn','LOGICAL_COLUMN','POC_ONLY','FULL',['dataSet','column']],
  ['removeColumn','LOGICAL_COLUMN','POC_ONLY','FULL',[]],
  ['resizeRow','LOGICAL_ROW','STABLE','FULL',['height']],
  ['hideRow','LOGICAL_ROW','STABLE','FULL',[]],
  ['restoreRow','LOGICAL_ROW','STABLE','FULL',[]],
  ['collapseRow','LOGICAL_ROW','STABLE','FULL',[]],
  ['moveRow','LOGICAL_ROW','STABLE','FULL',['toRowIndex']],
  ['moveRows','LOGICAL_ROW','STABLE','FULL',['toRowIndex']],
  ['removeRow','LOGICAL_ROW','STABLE','FULL',[]],
  ['moveRenderedRow','LOGICAL_ROW','LIMITED','VIEWER_ONLY',['toRowIndex']],
  ['addStaticRow','LOGICAL_ROW','POC_ONLY','FULL',[]],
  ['removeStaticRow','LOGICAL_ROW','POC_ONLY','FULL',[]],
  ['moveTable','COMPOSITE_TABLE','LIMITED','VIEWER_ONLY',['after']],
  ['resizeTableWidth','COMPOSITE_TABLE','LIMITED','VIEWER_ONLY',['width']],
  ['hideTable','COMPOSITE_TABLE','STABLE','FULL',[]],
  ['restoreTable','COMPOSITE_TABLE','STABLE','FULL',[]],
  ['collapseTable','COMPOSITE_TABLE','STABLE','FULL',[]],
];

const registry = Object.freeze(Object.fromEntries(entries.map(([operation,targetType,maturity,support,requiredPayload])=>[operation,Object.freeze({operation,targetType,maturity,support:Object.freeze({...SUPPORT[support]}),candidateMaterialization:support==='FULL'?'SUPPORTED':'VIEWER_ONLY',requiredPayload:Object.freeze(requiredPayload)})])));

function get(operation){return registry[operation]||null}
function list(){return Object.values(registry).map(x=>({...x,support:{...x.support},requiredPayload:[...x.requiredPayload]}))}
module.exports={SUPPORT,registry,get,list};
