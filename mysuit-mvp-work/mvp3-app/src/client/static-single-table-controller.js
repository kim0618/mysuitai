(function(){
  if(window.__formContext?.origin!=='IMPORTED')return;
  const context=window.__formContext,params=new URLSearchParams(location.search),layoutDraftId=params.get('layoutDraftId')||`import_${context.projectName}_${context.formName}_default`.slice(0,80),scope={layoutDraftId,projectName:context.projectName,formName:context.formName};
  // Every imported UBTable is an independent logical table. Geometry after structure operations comes from the
  // server (/api/form-model layouts), which runs the same transform that save uses.
  let tables=[],layouts={},canvas,frame,selection=null,active=null,overlays=[],operations=[],mode='cell',lastCell=null,dragging=null;
  const api=async(url,options={})=>{const response=await fetch(url,{headers:{'content-type':'application/json'},...options}),body=await response.json();if(!response.ok||body.success===false)throw Object.assign(new Error(body.message),body);return body};
  // The Viewer ships a Fabric build without requestRenderAll; fall back to renderAll so moved cells repaint at once.
  const render=()=>{if(typeof canvas?.requestRenderAll==='function')canvas.requestRenderAll();else canvas?.renderAll?.()};
  const byId=id=>canvas.getObjects().find(o=>o.id===id);
  const objects=ids=>ids.map(byId).filter(Boolean);
  const tableOf=key=>tables.find(t=>t.tableKey===key||t.compositeTableKey===key||String(key||'').startsWith(`${t.tableKey}|`))||null;
  const tableOfCell=id=>tables.find(t=>t.cells.some(c=>c.viewerObjectId===id))||null;
  const sum=(list,count)=>list.slice(0,count).reduce((n,v)=>n+v,0);
  // While a drag runs, its handle (holding pointer capture) and insertion indicator survive redraws.
  function clear(){const keep=dragging?overlays.filter(node=>node.dataset.drag):[];for(const node of overlays)if(!keep.includes(node))node.remove();overlays=keep;if(canvas?.contextTop)canvas.clearContext(canvas.contextTop)}

  // ---- Track model: positions, logical keys and merge groups of the current layout -----------------------------------
  const ROW={name:'row',order:'rowOrder',sizes:'rowHeights',groups:'rowGroups',tracks:'rows',index:'rowIndex',key:'logicalRowKey'};
  const COLUMN={name:'column',order:'columnOrder',sizes:'columnWidths',groups:'columnGroups',tracks:'columns',index:'columnIndex',key:'logicalColumnKey'};
  const axisOf=type=>type==='ROW'?ROW:COLUMN;
  const layoutOf=table=>layouts[table.sourceTableId];
  const trackAt=(axis,table,position)=>table[axis.tracks][layoutOf(table)[axis.order][position]];
  const positionOf=(axis,table,key)=>{const track=table[axis.tracks].find(t=>t[axis.key]===key);return track?layoutOf(table)[axis.order].indexOf(track[axis.index]):-1};
  // A group is the smallest run closed under merges spanning this axis; selection and moves always cover whole groups.
  const groupAt=(axis,table,position)=>(layoutOf(table)[axis.groups]||[]).find(([a,z])=>position>=a&&position<=z)||[position,position];
  function expand(axis,table,positions){const out=new Set();for(const p of positions){const [a,z]=groupAt(axis,table,p);for(let i=a;i<=z;i++)out.add(i)}return [...out].sort((a,b)=>a-b)}
  function runs(positions){const out=[];for(const p of positions){const last=out.at(-1);if(last&&p===last[1]+1)last[1]=p;else out.push([p,p])}return out}
  const positionsOf=sel=>sel.keys.map(k=>positionOf(axisOf(sel.type),sel.table,k)).filter(p=>p>=0).sort((a,b)=>a-b);
  const membersOf=(type,table,keys)=>{const axis=axisOf(type),ids=new Set();for(const k of keys)for(const id of table[axis.tracks].find(t=>t[axis.key]===k)?.viewerObjectIds||[])ids.add(id);return objects([...ids])};

  // ---- Selection set -------------------------------------------------------------------------------------------------
  function announce(){
    if(!selection){window.dispatchEvent(new CustomEvent('mysuit-static-selection',{detail:null}));return}
    const positions=positionsOf(selection);
    window.dispatchEvent(new CustomEvent('mysuit-static-selection',{detail:{type:selection.type,key:selection.keys[0],keys:[...selection.keys],count:selection.members.length,ids:selection.members.map(x=>x.id),tableKey:selection.table?.tableKey,positions,contiguous:runs(positions).length===1}}));
  }
  function setSelection(type,table,positions,anchor){
    if(!positions.length){selection=null;draw();render();announce();return}
    const axis=axisOf(type),keys=positions.map(p=>trackAt(axis,table,p)[axis.key]);
    selection={type,table,keys,key:keys[0],anchor:anchor||keys[0],members:membersOf(type,table,keys)};active=table;draw();render();announce();
  }
  // click: the clicked group; Shift+click: the range from the anchor, extended to whole groups; Ctrl/Cmd+click: toggle.
  function select(type,table,key,{shift=false,toggle=false}={}){
    const axis=axisOf(type),p=positionOf(axis,table,key);if(p<0)return;
    const same=selection&&selection.type===type&&selection.table===table;
    if(shift&&same){const a=positionOf(axis,table,selection.anchor);const lo=Math.min(a,p),hi=Math.max(a,p);return setSelection(type,table,expand(axis,table,Array.from({length:hi-lo+1},(_,i)=>lo+i)),selection.anchor)}
    if(toggle&&same){const current=new Set(positionsOf(selection)),[a,z]=groupAt(axis,table,p),group=Array.from({length:z-a+1},(_,i)=>a+i);if(group.every(x=>current.has(x)))group.forEach(x=>current.delete(x));else group.forEach(x=>current.add(x));return setSelection(type,table,[...current].sort((x,y)=>x-y),key)}
    setSelection(type,table,expand(axis,table,[p]),key);
  }
  function highlight(type,key,members){if(type==='TABLE'){selection={type,key,keys:[key],members,table:tableOf(key)};active=selection.table;draw();render();window.dispatchEvent(new CustomEvent('mysuit-static-selection',{detail:{type,key,count:members.length,ids:members.map(x=>x.id),tableKey:selection.table?.tableKey}}));return}select(type,tableOf(key),key)}

  // ---- Drawing: one band per contiguous run, a small marker, and a drag handle for a single run -----------------------
  function bands(){
    if(!selection||!['ROW','COLUMN'].includes(selection.type))return [];
    const axis=axisOf(selection.type),table=selection.table,layout=table&&layoutOf(table);if(!layout)return [];
    return runs(positionsOf(selection)).map(([a,z])=>{const start=sum(layout[axis.sizes],a),size=sum(layout[axis.sizes],z+1)-start;if(!(size>0))return null;return selection.type==='ROW'?{a,z,left:layout.x,top:layout.y+start,width:layout.width,height:size}:{a,z,left:layout.x+start,top:layout.y,width:size,height:layout.height}}).filter(Boolean);
  }
  // Outlines are redrawn after every Viewer render (the inspector clears the top context).
  function drawSelection(){if(!canvas?.contextTop||window.MvpWorkspaceMode?.directEdit?.()===false)return;const list=bands();if(!list.length)return;const vt=canvas.viewportTransform||[1,0,0,1,0,0],ctx=canvas.contextTop,row=selection.type==='ROW';ctx.save();ctx.strokeStyle=row?'#059669':'#2563eb';ctx.fillStyle=row?'rgba(5,150,105,.08)':'rgba(37,99,235,.08)';ctx.lineWidth=2;for(const b of list){const x=vt[0]*b.left+vt[4],y=vt[3]*b.top+vt[5],w=vt[0]*b.width,h=vt[3]*b.height;ctx.fillRect(x,y,w,h);ctx.strokeRect(x-1,y-1,w+2,h+2)}ctx.restore()}
  function overlay(tag,className,rect,style={}){const node=frame.document.createElement(tag);node.className=className;Object.assign(node.style,{position:'fixed',zIndex:2147483000,left:`${rect.left}px`,top:`${rect.top}px`,width:`${rect.width}px`,height:`${rect.height}px`,boxSizing:'border-box'},style);frame.document.body.appendChild(node);overlays.push(node);return node}
  // Informational marker beside each selected run; it never intercepts pointer input.
  function marker(rect,label,type){const node=overlay('span',`mvp12-static-marker mvp12-${type.toLowerCase()}`,rect,{minWidth:`${rect.width}px`,width:'auto',padding:'0 4px',font:'600 10px/16px sans-serif',textAlign:'center',borderRadius:'8px',pointerEvents:'none',background:type==='ROW'?'#059669':'#2563eb',color:'#fff',whiteSpace:'nowrap'});node.textContent=label;return node}
  const screenRect=r=>MvpCoordinateAdapter.canvasRectToScreen(frame,canvas,r);
  function draw(){
    clear();if(!(window.MvpWorkspaceMode?.directEdit?.()!==false))return;
    const list=bands();
    try{for(const b of list){const r=screenRect(b),label=b.a===b.z?String(b.a+1):`${b.a+1}–${b.z+1}`;if(selection.type==='ROW')marker({left:r.left-(label.length>2?46:30),top:r.top+Math.max(0,(r.height-16)/2),width:26,height:16},label,'ROW');else marker({left:r.left+Math.max(0,(r.width-26)/2),top:r.top-19,width:26,height:16},label,'COLUMN')}
      if(list.length===1&&!dragging)handle(list[0])}catch(_){}
    drawSelection();
  }
  // Drag handle (⋮⋮) beside a single selected run. Only the handle starts a drag; cells never do.
  function handle(b){
    const r=screenRect(b),row=selection.type==='ROW',rect=row?{left:r.left-(b.a===b.z?52:68),top:r.top+Math.max(0,(r.height-20)/2),width:18,height:20}:{left:r.left+Math.max(0,(r.width-20)/2),top:r.top-40,width:20,height:18};
    const node=overlay('button',`mvp12-drag-handle mvp12-${row?'row':'column'}`,rect,{padding:'0',border:'1px solid #cbd5d0',borderRadius:'4px',background:'#fff',color:'#475569',font:'700 11px/1 sans-serif',letterSpacing:'-1px',cursor:'grab',touchAction:'none',boxShadow:'0 1px 3px #0002'});
    node.type='button';node.textContent=row?'⋮⋮':'⋯';node.title=row?'끌어서 행 이동':'끌어서 열 이동';node.setAttribute('aria-label',node.title);
    node.addEventListener('pointerdown',event=>{event.preventDefault();event.stopPropagation();startDrag(event,node)});
    node.addEventListener('mousedown',event=>event.stopPropagation());
  }

  // ---- Drag and drop with structural snap --------------------------------------------------------------------------
  // Allowed drop boundaries: group boundaries outside the dragged run (boundaries inside a merge group are excluded).
  function boundaries(axis,table,[a,z]){
    const layout=layoutOf(table),sizes=layout[axis.sizes],n=sizes.length,starts=new Set((layout[axis.groups]||sizes.map((_,i)=>[i,i])).map(([s])=>s)),origin=axis===ROW?layout.y:layout.x;
    return Array.from({length:n+1},(_,k)=>({k,at:origin+sum(sizes,k),allowed:(k===n||starts.has(k))&&(k<a||k>z+1)}));
  }
  // Pointer → canvas coordinate on the drag axis, whichever window delivered the event.
  function pointerOnAxis(event,source,axis){
    let x=event.clientX,y=event.clientY;if(source!==frame){const f=document.getElementById('viewer').getBoundingClientRect();x-=f.left;y-=f.top}
    const r=canvas.upperCanvasEl.getBoundingClientRect(),vt=canvas.viewportTransform||[1,0,0,1,0,0],scale=r.width/(canvas.getWidth?.()||canvas.width);
    return axis===ROW?((y-r.top)/scale-vt[5])/vt[3]:((x-r.left)/scale-vt[4])/vt[0];
  }
  // A pointer outside the Viewer frame has no drop target: the indicator hides and a release there cancels the drag.
  function outsideFrame(event,source){let x=event.clientX,y=event.clientY;if(source!==frame){const f=document.getElementById('viewer').getBoundingClientRect();x-=f.left;y-=f.top}return x<0||y<0||x>frame.innerWidth||y>frame.innerHeight}
  function startDrag(event,node){
    if(!selection||!window.MvpDragSession)return;
    const axis=axisOf(selection.type),table=selection.table,positions=positionsOf(selection),span=runs(positions);if(span.length!==1)return;
    const [a,z]=span[0],layout=layoutOf(table),list=boundaries(axis,table,[a,z]),keys=positions.map(p=>trackAt(axis,table,p)[axis.key]);
    dragging={axis,table,a,z,keys,target:null};node.dataset.drag='1';
    const indicator=overlay('div','mvp12-insert-indicator',{left:0,top:0,width:0,height:0},{display:'none',background:axis===ROW?'#059669':'#2563eb',boxShadow:'0 0 0 1px #fff',pointerEvents:'none'});indicator.dataset.drag='1';
    const place=boundary=>{if(!boundary){indicator.style.display='none';return}const rect=axis===ROW?screenRect({left:layout.x,top:boundary.at,width:layout.width,height:1}):screenRect({left:boundary.at,top:layout.y,width:1,height:layout.height});Object.assign(indicator.style,axis===ROW?{display:'block',left:`${rect.left-6}px`,top:`${rect.top-2}px`,width:`${rect.width+12}px`,height:'4px'}:{display:'block',left:`${rect.left-2}px`,top:`${rect.top-6}px`,width:'4px',height:`${rect.height+12}px`})};
    window.MvpDragSession.start({windows:[frame],captureTarget:node,pointerId:event.pointerId,cursor:'grabbing',
      onUpdate:(e,source)=>{const target=outsideFrame(e,source)?null:window.MvpObjectSnap?.nearestBoundary?.(pointerOnAxis(e,source,axis),list)||null;dragging.target=target;place(target)},
      cleanup:()=>{indicator.remove();delete node.dataset.drag;overlays=overlays.filter(x=>x!==indicator)},
      onFinish:(e)=>{const target=e&&outsideFrame(e,e.view===frame?frame:window)?null:dragging.target;dragging=null;draw();if(!target)return;const to=target.k>z?target.k-(z-a+1):target.k;if(to===a)return;
        const payload=axis===ROW?{logicalRowKeys:keys,fromRowIndex:a,toRowIndex:to,logicalRowKey:keys[0]}:{columnIndexes:keys.map(k=>table.columns.find(c=>c.logicalColumnKey===k).columnIndex),fromVisualIndex:a,toVisualIndex:to,logicalColumnKey:keys[0]};
        window.dispatchEvent(new CustomEvent('mysuit-static-drag-drop',{detail:{operation:axis===ROW?'moveRows':'moveColumns',payload,tableKey:table.tableKey}}))},
      onCancel:()=>{dragging=null;draw()}});
  }

  // ---- Modes, focus-out and interception -------------------------------------------------------------------------------
  // Drops the row/column selection (bands, markers, handle). forget=true also forgets the last cell used to seed a mode switch.
  function clearSelection(forget=false){if(dragging)window.MvpDragSession?.cancel();selection=null;if(forget)lastCell=null;draw();if(canvas)render()}
  const remember=(table,cell)=>{lastCell={tableKey:table.tableKey,rowIndex:cell.rowIndex,columnIndex:cell.columnIndex}};
  // Selection mode for imported tables: 'cell' keeps the regular object selection; 'row'/'column' turn a cell click
  // into a row/column selection so the two kinds of selection never coexist.
  function setMode(next){if(!['cell','row','column'].includes(next))return mode;const previous=mode;mode=next;if(previous===next)return mode;if(dragging)window.MvpDragSession?.cancel();selection=null;draw();render();return mode}
  function claims(object){return mode!=='cell'&&Boolean(object?.id&&tableOfCell(object.id))}
  function isTableCell(object){return Boolean(object?.id&&tableOfCell(object.id))}
  function intercept(object,event){if(!claims(object))return false;const table=tableOfCell(object.id),cell=table.cells.find(c=>c.viewerObjectId===object.id),options={shift:Boolean(event?.shiftKey),toggle:Boolean(event?.ctrlKey||event?.metaKey)};remember(table,cell);if(mode==='row')select('ROW',table,table.rows[cell.rowIndex].logicalRowKey,options);else select('COLUMN',table,table.columns[cell.columnIndex].logicalColumnKey,options);return true}
  function apply(){for(const table of tables){const layout=layouts[table.sourceTableId];if(!layout)continue;const placed=new Map(layout.cells.map(c=>[c.id,c]));for(const cell of table.cells){const object=byId(cell.viewerObjectId);if(!object)continue;const at=placed.get(cell.viewerObjectId);if(!at){object.set({visible:false});continue}object.set({left:layout.x+at.x,top:layout.y+at.y,width:at.width,height:at.height,scaleX:1,scaleY:1,visible:at.visible});object.setCoords?.()}}render();if(selection&&selection.type!=='TABLE'){selection.table=tables.find(t=>t.sourceTableId===selection.table?.sourceTableId)||selection.table;selection.members=membersOf(selection.type,selection.table,selection.keys)}draw()}
  async function loadOps(){const [ops,model]=await Promise.all([api(`/api/structure-operations?${new URLSearchParams(scope)}`),api(`/api/form-model?${new URLSearchParams(scope)}`)]);operations=ops.operations;tables=model.tables;layouts=model.layouts||{};apply();return operations}
  // Position of a logical row/column in the current visual order (after moves and deletes).
  function rowPosition(key){const table=tableOf(key);return table?positionOf(ROW,table,key):-1}
  function columnPosition(key){const table=tableOf(key);return table?positionOf(COLUMN,table,key):-1}
  async function save(operation,payload={}){const key=payload.logicalRowKey||payload.logicalColumnKey||selection?.key,table=tableOf(payload.logicalTableKey||key)||active;if(!table)throw Object.assign(new Error('편집할 표를 먼저 선택하세요.'),{code:'STATIC_TABLE_AMBIGUOUS'});const row=table.rows.find(r=>r.logicalRowKey===key),column=table.columns.find(c=>c.logicalColumnKey===key),body={...scope,operation,logicalTableKey:table.tableKey,compositeTableKey:table.compositeTableKey,logicalRowKey:row?.logicalRowKey,columnIndex:column?.columnIndex,...payload};delete body.logicalColumnKey;const result=await api('/api/structure-operations',{method:'PUT',body:JSON.stringify(body)});await loadOps();window.dispatchEvent(new CustomEvent('mysuit-static-structure-changed',{detail:{operation,key}}));return result}
  // Several operations from one user action (e.g. resizing every selected row) are recorded as ONE history event.
  async function saveBatch(items,label){const table=selection?.table||active;if(!table)throw Object.assign(new Error('편집할 표를 먼저 선택하세요.'),{code:'STATIC_TABLE_AMBIGUOUS'});const operations=items.map(item=>{const row=table.rows.find(r=>r.logicalRowKey===item.logicalRowKey),column=table.columns.find(c=>c.logicalColumnKey===item.logicalColumnKey);const body={logicalTableKey:table.tableKey,compositeTableKey:table.compositeTableKey,logicalRowKey:row?.logicalRowKey,columnIndex:column?.columnIndex,...item};delete body.logicalColumnKey;return body});const result=await api('/api/structure-operations/batch',{method:'PUT',body:JSON.stringify({...scope,operations,label})});await loadOps();window.dispatchEvent(new CustomEvent('mysuit-static-structure-changed',{detail:{operation:operations[0].operation}}));return result}
  function selectCell(id){const table=tableOfCell(id);if(!table)return null;active=table;selection=null;draw();const cell=table.cells.find(c=>c.viewerObjectId===id);remember(table,cell);const row=table.rows[cell.rowIndex],column=table.columns[cell.columnIndex];return{table,row,column,cell,rowPosition:rowPosition(row.logicalRowKey),columnPosition:columnPosition(column.logicalColumnKey),rowCount:layouts[table.sourceTableId].rowOrder.length,columnCount:table.columnCount}}
  // Neighbouring group positions for button moves of the current selection (null when there is none).
  function neighbour(direction){if(!selection||!['ROW','COLUMN'].includes(selection.type))return null;const axis=axisOf(selection.type),table=selection.table,span=runs(positionsOf(selection));if(span.length!==1)return null;const [a,z]=span[0],groups=layoutOf(table)[axis.groups]||[];if(direction<0){const g=groups.find(([,e])=>e===a-1);return g?{a,z,to:g[0]}:null}const g=groups.find(([s])=>s===z+1);return g?{a,z,to:a+(g[1]-g[0]+1)}:null}
  async function attach(){frame=document.getElementById('viewer')?.contentWindow;canvas=frame?.canvasModule?.getCanvas?.(0);const renderedCells=canvas?.getObjects?.().filter(o=>/^IMPCL/.test(o.id||''))||[];if(!renderedCells.length)return setTimeout(attach,100);
    const model=await api(`/api/form-model?${new URLSearchParams(scope)}`);if(renderedCells.length<model.tables.reduce((n,t)=>n+t.cells.length,0))return setTimeout(attach,100);
    await loadOps();frame.addEventListener('resize',draw);frame.addEventListener('scroll',draw,true);canvas.on?.('after:render',drawSelection);
    if(window.__mvp12)return;
    // Source-property previews reset objects to their original snapshot; re-apply the table layout afterwards.
    window.addEventListener('mysuit-previews-applied',apply);
    window.addEventListener('mvp:workspace-mode',event=>{if(event.detail.leavingDirectEdit){if(dragging)window.MvpDragSession?.cancel();selection=null;active=null;lastCell=null}draw()});
    window.__mvp12={context,scope,get tables(){return tables},get layouts(){return layouts},get model(){return selection?.table||active||(tables.length===1?tables[0]:null)},get operations(){return operations},get selection(){return selection},get dragging(){return Boolean(dragging)},get dragTarget(){return dragging?.target?{k:dragging.target.k,allowed:dragging.target.allowed}:null},rowPosition,columnPosition,selectCell,get mode(){return mode},get lastCell(){return lastCell},setMode,claims,intercept,clearSelection,select:(type,key,options)=>select(type,tableOf(key),key,options),neighbour,
      selectColumn:(i,tableKey)=>{const t=tableOf(tableKey)||active||tables[0];select('COLUMN',t,t.columns[i].logicalColumnKey)},
      selectRow:(i,tableKey)=>{const t=tableOf(tableKey)||active||tables[0];select('ROW',t,t.rows[i].logicalRowKey)},
      selectTable:tableKey=>{const t=tableOf(tableKey)||active||tables[0];highlight('TABLE',t.compositeTableKey,objects(t.cells.map(x=>x.viewerObjectId)))},
      save,saveBatch,loadOps,draw,apply};
    window.MvpTableSelection={claims,intercept,isTableCell};
    window.dispatchEvent(new CustomEvent('mysuit-static-tables-ready',{detail:{count:tables.length}}))}
  window.addEventListener('mysuit-editor-attached',()=>{selection=null;attach()});
})();
