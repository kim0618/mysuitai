(function(){
  const SOURCES=new Set(['UB5115957','UB5103966','UB5077625']),KEY='tbl:approval:UBA6577';let frame,canvas,members=[],overlay,selected=false,lastKey='';
  const parse=o=>String(o.id||'').split('_');
  function approvalObjects(){return canvas.getObjects().filter(o=>{const p=parse(o);return SOURCES.has(p[0])&&p[1]==='UPHB2584'&&Number(o.top)>=180&&Number(o.top)<300})}
  // MvpCoordinateAdapter applies the canvas viewport transform. Fabric's
  // getBoundingRect() already returns viewport-transformed coordinates, so
  // feeding it to the adapter scaled the approval table twice and made its
  // transparent hit area cover the data table below it.
  function rect(){const list=members.map(o=>({left:Number(o.left),top:Number(o.top),width:Number(o.width)*Number(o.scaleX||1),height:Number(o.height)*Number(o.scaleY||1)})),left=Math.min(...list.map(x=>x.left)),top=Math.min(...list.map(x=>x.top)),right=Math.max(...list.map(x=>x.left+x.width)),bottom=Math.max(...list.map(x=>x.top+x.height));return{left,top,width:right-left,height:bottom-top}}
  function screen(r){return MvpCoordinateAdapter.canvasRectToScreen(frame,canvas,r)}
  function clear(){overlay?.remove();overlay=null}
  function select(){selected=true;window.dispatchEvent(new CustomEvent('mvp:clear-object-selection'));window.dispatchEvent(new CustomEvent('mvp:static-table-selected',{detail:{targetType:'STATIC_TABLE',targetKey:KEY,label:'결재 표'}}));draw(true)}
  function draw(force=false){if(!frame||!canvas||document.getElementById('review-toggle')?.getAttribute('aria-pressed')!=='true'||!(window.MvpWorkspaceMode?.directEdit?.()!==false)){clear();return}members=approvalObjects();if(members.length!==7){clear();return}
    // Until the Viewer lays out its canvas (size 0 during load) there is nothing to anchor the overlay to; retry on the next tick.
    let r;try{r=screen(rect())}catch(_){clear();lastKey='';return}const key=JSON.stringify([r,selected,frame.scrollX,frame.scrollY]);if(!force&&key===lastKey)return;lastKey=key;clear();const d=frame.document.createElement('div');overlay=d;d.className='mvp-static-approval-table';d.title='결재 표 전체 선택';Object.assign(d.style,{position:'fixed',zIndex:2147482980,left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',boxSizing:'border-box',cursor:'pointer',border:selected?'2px solid #2563eb':'1px solid transparent',background:selected?'#2563eb08':'transparent',borderRadius:'3px',transition:'border .15s,background .15s,box-shadow .15s'});d.onmouseenter=()=>{if(!selected){d.style.borderColor='#94a3b8';d.style.boxShadow='0 0 0 2px #fff'}};d.onmouseleave=()=>{if(!selected){d.style.borderColor='transparent';d.style.boxShadow='none'}};d.onpointerdown=e=>{e.preventDefault();e.stopPropagation();select()};frame.document.body.appendChild(d)}
  function attach(){const iframe=document.getElementById('viewer'),w=iframe?.contentWindow,c=w?.canvasModule?.getCanvas?.(0);if(!w||!c?.getObjects||c.getObjects().length!==180)return;if(frame!==w){clear();frame=w;selected=false;lastKey='';frame.addEventListener('scroll',()=>draw(true),true);frame.addEventListener('resize',()=>draw(true))}if(canvas!==c){canvas=c;lastKey=''}members=approvalObjects();draw()}
  window.addEventListener('mvp:target-selected',()=>{if(selected){selected=false;draw(true)}});
  window.addEventListener('mvp:workspace-mode',event=>{if(event.detail.leavingDirectEdit)selected=false;draw(true)});
  setInterval(attach,120);window.__mvpApproval={get members(){return members},get selected(){return selected},select};
})();
