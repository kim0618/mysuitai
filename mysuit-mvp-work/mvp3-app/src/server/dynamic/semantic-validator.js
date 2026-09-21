const TYPES=new Set(['PAGE_HEADER','DATA_HEADER','GROUP_HEADER','DATA','GROUP_FOOTER','DATA_FOOTER','PAGE_FOOTER']);
function fail(code,message,details={}){throw Object.assign(new Error(message),{code,details})}
function validateSemanticModel(input){
 if(!input||input.version!=='0.1'||!input.page||input.page.width!==794||input.page.height!==1123)fail('DYNAMIC_SEMANTIC_INVALID','Semantic Model v0.1과 794x1123 page가 필요합니다.');
 if(!Array.isArray(input.datasets)||input.datasets.length!==1)fail('DYNAMIC_DATASET_INVALID','MVP 3.1은 Dataset 1개가 필요합니다.');
 const ds=input.datasets[0];if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(ds.id||'')||ds.type!=='embedded'||!Array.isArray(ds.columns)||!Array.isArray(ds.rows))fail('DYNAMIC_DATASET_INVALID','Embedded Dataset이 올바르지 않습니다.');
 const names=new Set();for(const c of ds.columns){if(!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(c.name||'')||names.has(c.name)||!['string','number'].includes(c.type))fail('DYNAMIC_DATASET_COLUMN_INVALID','Dataset column이 올바르지 않습니다.');names.add(c.name)}
 for(const [index,row] of ds.rows.entries()){if(!row||typeof row!=='object'||[...names].some(n=>!(n in row)))fail('DYNAMIC_DATASET_ROW_INVALID','Dataset row column이 누락되었습니다.',{index});for(const c of ds.columns)if(c.type==='number'&&(typeof row[c.name]!=='number'||!Number.isFinite(row[c.name])))fail('DYNAMIC_DATASET_ROW_INVALID','Numeric column 값이 올바르지 않습니다.',{index,column:c.name})}
 if(!Array.isArray(input.groups)||input.groups.length!==1)fail('DYNAMIC_GROUP_INVALID','Group 1개가 필요합니다.');const group=input.groups[0];if(group.dataset!==ds.id||!names.has(group.key))fail('DYNAMIC_GROUP_KEY_MISSING','Group dataset/key가 올바르지 않습니다.');
 if(!Array.isArray(input.bands)||input.bands.length!==7||new Set(input.bands.map(b=>b.id)).size!==7||input.bands.some(b=>!TYPES.has(b.type)))fail('DYNAMIC_BAND_INVALID','7개 Semantic Band가 필요합니다.');
 for(const b of input.bands){if(b.dataset&&b.dataset!==ds.id)fail('DYNAMIC_DATASET_MISSING','Band dataset이 없습니다.');if(b.group&&b.group!==group.id)fail('DYNAMIC_GROUP_MISSING','Band group이 없습니다.');}
 if(!Array.isArray(input.detailColumns)||input.detailColumns.length!==6||input.detailColumns.some(n=>!names.has(n)))fail('DYNAMIC_BINDING_INVALID','Detail binding 6개가 필요합니다.');
 for(const [footer,scope] of [[input.groupFooter,'GROUP'],[input.dataFooter,'REPORT']]){const a=footer?.aggregate;if(!a||a.function!=='SUM'||a.dataset!==ds.id||!names.has(a.column))fail('DYNAMIC_AGGREGATE_INVALID','SUM aggregate가 올바르지 않습니다.');if(a.scope!==scope)fail('DYNAMIC_AGGREGATE_SCOPE_INVALID','Aggregate scope와 Footer가 일치하지 않습니다.');if(ds.columns.find(c=>c.name===a.column).type!=='number')fail('DYNAMIC_AGGREGATE_COLUMN_INVALID','SUM column은 number여야 합니다.');if(footer.mergeColumns!==5)fail('DYNAMIC_MERGE_INVALID','MVP 3.1 footer merge는 5 columns여야 합니다.');}
 if(input.pageFooter?.type!=='PAGE_NUMBER'||input.pageFooter.format!=='TOTAL_CURRENT')fail('DYNAMIC_PAGE_FUNCTION_INVALID','지원하지 않는 Page Function입니다.');return JSON.parse(JSON.stringify(input));
}
module.exports={TYPES,validateSemanticModel};
