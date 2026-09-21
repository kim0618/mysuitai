function writeDatasetBinding(cell,dataset,column){cell.dataType='1';cell.dataSet=dataset;cell.column=column;cell.systemFunction='';cell.text=encodeURIComponent(`{${dataset}.${column}}`);return cell}
function writeParameterBinding(cell,parameter){cell.dataType='3';cell.dataSet='';delete cell.column;cell.systemFunction='';cell.parameter=parameter;cell.text=encodeURIComponent(`{param:${parameter}}`);return cell}
function clearBinding(cell){delete cell.dataType;delete cell.dataSet;delete cell.column;delete cell.systemFunction;delete cell.parameter;return cell}
function writeSystemFunction(cell,expression){cell.dataType='2';cell.dataSet='';delete cell.column;cell.systemFunction=expression;cell.text=encodeURIComponent(expression);return cell}
function aggregateExpression(aggregate){if(aggregate.function!=='SUM')throw Object.assign(new Error('SUM만 지원합니다.'),{code:'DYNAMIC_AGGREGATE_INVALID'});return `FN.Sum('${aggregate.dataset}','${aggregate.column}')`}
function pageExpression(page){if(page.type!=='PAGE_NUMBER'||page.format!=='TOTAL_CURRENT')throw Object.assign(new Error('Page Function이 올바르지 않습니다.'),{code:'DYNAMIC_PAGE_FUNCTION_INVALID'});return 'FN.TotalPage() + " / " + FN.CurrentPage()'}
module.exports={writeDatasetBinding,writeParameterBinding,clearBinding,writeSystemFunction,aggregateExpression,pageExpression};
