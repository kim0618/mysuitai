(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.RenderPositionEditor=api})(typeof window!=='undefined'?window:globalThis,function(){
  function render(canvas){if(typeof canvas.requestRenderAll==='function')canvas.requestRenderAll();else canvas.renderAll?.()}
  const near=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&Math.abs(Number(a)-Number(b))<.01;
  const at=(object,position)=>position&&near(object.left,position.left)&&near(object.top,position.top);
  function resolve(canvas,patch,positions=[patch?.before,patch?.after]){
    if(!Number.isInteger(patch?.renderIndex))return null;
    const object=canvas.getObjects()[patch.renderIndex],fingerprint=patch.originalFingerprint;
    if(!object||object.id!==patch.viewerObjectId||object.className!==patch.className||!fingerprint)return null;
    if(!near(object.width,fingerprint.width)||!near(object.height,fingerprint.height))return null;
    if(!positions.some(position=>at(object,position))&&!at(object,fingerprint))return null;
    return object;
  }
  function apply(canvas,patches,pageIndex=0){const results=[];for(const patch of patches||[]){if(patch.pageIndex!==pageIndex){results.push({patch,status:'SKIPPED',reason:'PAGE_INDEX_UNAVAILABLE'});continue}const object=resolve(canvas,patch);if(!object){results.push({patch,status:'SKIPPED',reason:'RENDER_INSTANCE_NOT_FOUND_OR_MISMATCH'});continue}object.set({left:patch.after.left,top:patch.after.top});object.setCoords?.();results.push({patch,status:'APPLIED'})}render(canvas);return results}
  return{apply,resolve,at};
});
