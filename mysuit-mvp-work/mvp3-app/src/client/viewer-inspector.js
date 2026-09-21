(function(){
  const ID = /^([A-Za-z][A-Za-z0-9]*)_([A-Za-z][A-Za-z0-9_]{0,119})_ROW(0|[1-9][0-9]*)$/;
  function parseViewerObjectId(id){const m=typeof id==='string'&&ID.exec(id);if(m)return{viewerObjectId:id,sourceObjectId:m[1],bandId:m[2],rowIndex:Number(m[3]),mappingConfidence:m[2].includes('_')?'render-instance-only':'verified-for-sample'};return /^(?:IMPLB|IMPCL|IMPIMG)\d{4}$/.test(id||'')?{viewerObjectId:id,sourceObjectId:id,bandId:'FREEFORM',rowIndex:0,mappingConfidence:'verified-import-source-id'}:null}
  function attach(iframe,onSelect,isReviewEnabled=()=>true,directCallbacks={}){
    const win=iframe.contentWindow;if(!win)throw new Error('Viewer window unavailable');
    if(!Object.keys(directCallbacks).length)directCallbacks=iframe.ownerDocument.defaultView.mvpDirectBridge||{};
    const canvas=win.canvasModule?.getCanvas?.(0)||win.canvasModule?.getCanvas?.();
    if(!canvas||typeof canvas.getObjects!=='function')throw new Error('Viewer Canvas unavailable');
    if(canvas.getObjects().length===0)throw new Error('Viewer objects are not ready');
    const originals=new Set(canvas.getObjects());
    const snapshots=new Map(canvas.getObjects().map(object=>[object,{
      text:object.text,fontSize:object.fontSize,fontWeight:object.fontWeight,
      textAlign:object.textAlign,visible:object.visible,left:object.left,top:object.top,
      width:object.width,height:object.height,
      ...(object.className==='UBImage'?{scaleType:object.scaleType}:{})
    }]));
    const imageElements=new Map(canvas.getObjects().filter(object=>object.className==='UBImage').map(object=>[object,object._element||object.getElement?.()]));
    // Image replacement preview: swap the drawn element; the source patch carries the url-encoded base64 payload.
    const setImage=(object,element)=>{const size={width:object.width,height:object.height};object.setElement?.(element);object.set(size);object.setCoords?.()};
    const previewImage=(object,ref)=>{const hash=/^asset:([a-f0-9]{64})$/.exec(ref||'')?.[1];if(!hash){const original=imageElements.get(object);if(original)setImage(object,original);return}const image=new win.Image();image.onload=()=>{setImage(object,image);render()};image.src=`/api/image-assets/${hash}`};
    let selected=null;
    let changedIds=new Set(),showChanged=false;
    let moveMode=false,moveCallbacks={},dragStart=null,pointerStart=null,sizeStart=null,direct=null;
    const interaction=new Map(canvas.getObjects().map(object=>[object,{selectable:object.selectable,evented:object.evented,hasControls:object.hasControls,lockScalingX:object.lockScalingX,lockScalingY:object.lockScalingY,lockRotation:object.lockRotation,lockMovementX:object.lockMovementX,lockMovementY:object.lockMovementY}]));
    const selectable=o=>originals.has(o)&&((o?.className==='UBLabel'&&((typeof o.text==='string'&&o.text.trim().length>0)||/^IMPCL\d{4}$/.test(o.id||'')))||o?.className==='UBImage')&&!String(o.id||'').startsWith('editLblItem')&&parseViewerObjectId(o.id);
    const instanceIdentity=object=>{const parsed=parseViewerObjectId(object.id),renderIndex=canvas.getObjects().indexOf(object),snapshot=snapshots.get(object);return{...parsed,canvasIndex:0,renderIndex,renderInstanceKey:`p0|c0|src:${parsed.sourceObjectId}|band:${parsed.bandId}|row:${parsed.rowIndex}|idx:${renderIndex}`,originalFingerprint:{left:Number(snapshot.left),top:Number(snapshot.top),width:Number(snapshot.width),height:Number(snapshot.height)}}};
    const selectionData=object=>({pageIndex:0,...instanceIdentity(object),className:object.className,currentText:object.text,fontSize:object.fontSize??null,fontWeight:object.fontWeight??'normal',textAlign:object.textAlign??'left',visible:object.visible!==false,left:Number(object.left),top:Number(object.top),width:Number(object.width)*Number(object.scaleX||1),height:Number(object.height)*Number(object.scaleY||1)});
    const clearHighlight=()=>{if(canvas.contextTop&&typeof canvas.clearContext==='function')canvas.clearContext(canvas.contextTop)};
    const drawHighlight=()=>{
      if(!canvas.contextTop)return;
      clearHighlight();
      const ctx=canvas.contextTop;
      if(showChanged)canvas.getObjects().filter(o=>changedIds.has(String(o.id||'').split('_')[0])).forEach((o,index)=>{const r=o.getBoundingRect();ctx.save();ctx.strokeStyle='#00a6d6';ctx.lineWidth=4;ctx.setLineDash?.([7,5]);ctx.strokeRect(r.left-3,r.top-3,r.width+6,r.height+6);ctx.fillStyle='#00a6d6';ctx.font='bold 22px sans-serif';ctx.fillText(String(index+1),r.left+5,r.top+24);ctx.restore()});
      if(selected){const rect=selected.getBoundingRect();ctx.save();ctx.strokeStyle='#ff4d00';ctx.lineWidth=5;ctx.setLineDash?.([12,7]);ctx.shadowColor='rgba(255,77,0,.35)';ctx.shadowBlur=8;ctx.strokeRect(rect.left-4,rect.top-4,rect.width+8,rect.height+8);ctx.restore()}
    };
    const handler=event=>{
      if(!isReviewEnabled()||Number(win.__mvpStructureInteractionUntil||0)>Date.now())return;
      const object=event.target;if(!selectable(object))return;
      const structuralHeader=win.parent.__mvp51?.columns?.some?.(column=>column.some(member=>member.object===object&&member.role==='HEADER'));if(structuralHeader)return;
      selected=object;drawHighlight();
      if(moveMode){dragStart={left:Number(object.left),top:Number(object.top)};sizeStart={width:Number(object.width),height:Number(object.height),scaleX:Number(object.scaleX||1),scaleY:Number(object.scaleY||1)};pointerStart=canvas.getPointer?.(event.e)||{x:event.e?.offsetX||0,y:event.e?.offsetY||0};moveCallbacks.start?.({object,...dragStart})}
      onSelect(selectionData(object));direct?.select(object,instanceIdentity(object).renderInstanceKey);
    };
    canvas.on('mouse:down',handler);
    canvas.on('after:render',drawHighlight);
    const moving=event=>{const object=event.target;if(!moveMode||!selectable(object))return;if(event.e?.shiftKey){object.set({left:Math.round(object.left/10)*10,top:Math.round(object.top/10)*10});object.setCoords?.()}moveCallbacks.moving?.({object,left:Number(object.left),top:Number(object.top),before:dragStart})};
    const customMoving=event=>{if(canvas._currentTransform?.action?.includes('scale'))return;if(!moveMode||!dragStart||!pointerStart||!selected)return;const pointer=canvas.getPointer?.(event.e)||{x:event.e?.offsetX||0,y:event.e?.offsetY||0};let left=dragStart.left+(pointer.x-pointerStart.x),top=dragStart.top+(pointer.y-pointerStart.y);if(event.e?.shiftKey){left=Math.round(left/10)*10;top=Math.round(top/10)*10}selected.set({left,top});selected.setCoords?.();render();moveCallbacks.moving?.({object:selected,left,top,before:dragStart})};
    const modified=event=>{const object=event.target||selected;if(!moveMode||!selectable(object)||!dragStart)return;const scaledWidth=Number(object.width)*Number(object.scaleX||1),scaledHeight=Number(object.height)*Number(object.scaleY||1),resized=sizeStart&&(Math.abs(Number(object.scaleX||1)-sizeStart.scaleX)>.001||Math.abs(Number(object.scaleY||1)-sizeStart.scaleY)>.001);if(resized&&scaledWidth>=5&&scaledWidth<=2000&&scaledHeight>=5&&scaledHeight<=3000){const before={width:sizeStart.width*sizeStart.scaleX,height:sizeStart.height*sizeStart.scaleY},after={width:scaledWidth,height:scaledHeight};object.set({width:scaledWidth,height:scaledHeight,scaleX:1,scaleY:1});dragStart=null;pointerStart=null;sizeStart=null;canvas._currentTransform=null;object.setCoords?.();render();directCallbacks.resize?.({object,before,after});direct?.sync();return}const before=dragStart,after={left:Number(object.left),top:Number(object.top)};dragStart=null;pointerStart=null;sizeStart=null;canvas._currentTransform=null;canvas.discardActiveObject?.();object.setCoords?.();render();moveCallbacks.end?.({object,before,after});direct?.sync()};
    const mouseup=event=>{if(dragStart)modified({target:event.target||selected})};
    const windowMouseup=()=>{if(dragStart)modified({target:selected})};
    canvas.on('object:moving',moving);canvas.on('mouse:move',customMoving);canvas.on('object:modified',modified);canvas.on('mouse:up',mouseup);win.addEventListener('mouseup',windowMouseup);
    const setPreviews=patches=>{
      for(const [object,values]of snapshots)object.set(values);
      const replaced=new Set();
      for(const patch of patches||[]){
        const targets=canvas.getObjects().filter(object=>String(object.id||'').split('_')[0]===patch.sourceObjectId);
        for(const object of targets){if(patch.viewerProperty==='data'){replaced.add(object);previewImage(object,patch.after);continue}object.set(patch.viewerProperty,patch.after);object.setCoords?.()}
      }
      for(const [object,element]of imageElements)if(!replaced.has(object)&&element&&(object._element||object.getElement?.())!==element)setImage(object,element);
      iframe.ownerDocument.defaultView.dispatchEvent(new iframe.ownerDocument.defaultView.CustomEvent('mysuit-previews-applied'));
      if(typeof canvas.requestRenderAll==='function')canvas.requestRenderAll();
      else canvas.renderAll?.();
    };
    const render=()=>{if(typeof canvas.requestRenderAll==='function')canvas.requestRenderAll();else canvas.renderAll?.()};
    const setMoveMode=(enabled,callbacks={})=>{const positions=new Map(canvas.getObjects().map(object=>[object,{left:Number(object.left),top:Number(object.top)}]));moveMode=enabled;moveCallbacks=callbacks;dragStart=null;pointerStart=null;sizeStart=null;canvas._currentTransform=null;for(const object of originals){if(!selectable(object))continue;const prior=interaction.get(object);object.set(enabled?{evented:true,hasControls:true,lockScalingX:false,lockScalingY:false,lockRotation:true,lockMovementX:false,lockMovementY:false}:prior)}for(const [object,position]of positions){object.set({left:position.left,top:position.top});object.setCoords?.()}canvas.selection=false;canvas.discardActiveObject?.();render();for(const object of originals){if(!selectable(object))continue;const prior=interaction.get(object);object.selectable=enabled?true:prior.selectable;object.evented=enabled?true:prior.evented;object.hasControls=enabled?true:prior.hasControls;object.lockScalingX=enabled?false:prior.lockScalingX;object.lockScalingY=enabled?false:prior.lockScalingY;object.lockMovementX=enabled?false:prior.lockMovementX;object.lockMovementY=enabled?false:prior.lockMovementY;object.setCoords?.()}direct?.setEnabled(enabled)};
    const setRenderPositions=patches=>RenderPositionEditor.apply(canvas,patches,0);
    const setPosition=(id,position,updateSnapshot=false,patch=null)=>{const object=patch?RenderPositionEditor.resolve(canvas,patch,[patch.after,patch.before]):canvas.getObjects().find(value=>value.id===id);if(!object||object.className!=='UBLabel')return false;object.set({left:position.left,top:position.top});if(updateSnapshot){const snapshot=snapshots.get(object);if(snapshot){snapshot.left=position.left;snapshot.top=position.top}}object.setCoords?.();render();return true};
    const nudge=(dx,dy)=>{if(!moveMode||!selected)return null;const before={left:Number(selected.left),top:Number(selected.top)};selected.set({left:before.left+dx,top:before.top+dy});selected.setCoords?.();render();return{object:selected,...instanceIdentity(selected),before,after:{left:Number(selected.left),top:Number(selected.top)}}};
    direct=iframe.ownerDocument.defaultView.DirectEditor?.attach?.({win,canvas,onProperty:directCallbacks.property,onAction:directCallbacks.action,onSelect:object=>{selected=object;const data=selectionData(object);onSelect(data);return data.renderInstanceKey}});
    return {objectCount:canvas.getObjects().length,clearSelection:()=>{selected=null;dragStart=null;pointerStart=null;sizeStart=null;canvas.discardActiveObject?.();direct?.clear?.();clearHighlight();render()},detach:()=>{direct?.detach();setMoveMode(false);canvas.off('mouse:down',handler);canvas.off('after:render',drawHighlight);canvas.off('object:moving',moving);canvas.off('mouse:move',customMoving);canvas.off('object:modified',modified);canvas.off('mouse:up',mouseup);win.removeEventListener('mouseup',windowMouseup);selected=null;clearHighlight()},find:id=>canvas.getObjects().find(o=>o.id===id)||null,setChangedHighlights:(ids,enabled)=>{changedIds=new Set(ids);showChanged=enabled;drawHighlight()},setPreviews,setMoveMode,setRenderPositions,setPosition,nudge};
  }
  window.MvpViewerInspector={parseViewerObjectId,attach};
})();
