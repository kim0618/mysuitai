const service=require('../src/server/services/render-patch-service');
const removed=service.clear({layoutDraftId:'layout_sample_default',projectName:'sample',formName:'sample'});
console.log(`Render Position Patch ${removed.length}건을 초기화했습니다.`);
