(function () {
  if (location.pathname !== '/ai-builder') return;
  const $ = id => document.getElementById(id), params = new URLSearchParams(location.search), context = window.__formContext;
  const draftId = params.get('layoutDraftId') || (context.origin === 'IMPORTED' ? `import_${context.projectName}_${context.formName}_default`.slice(0,80) : 'layout_sample_default');
  const scope = {layoutDraftId:draftId,projectName:context.projectName,formName:context.formName};
  const debug = params.get('debug') === '1';
  // One Builder state: the chat provider, the direct editor and the data tab all read this object.
  const state = {document:null,selection:null,source:null,staticSelection:null,importContext:null,bindingProposal:null,selectedProposalTarget:null,currentBinding:null,datasets:[],savedPreview:null,lastError:null};
  document.body.classList.add('ai-builder');
  document.title = 'MySuit AI Builder';

  async function api(url, options={}) {
    const response=await fetch(url,{headers:{'content-type':'application/json'},...options}), data=await response.json();
    if (!response.ok || data.success === false) throw Object.assign(new Error(data.message||'요청을 처리하지 못했습니다.'),{code:data.code,details:data.details});
    return data;
  }
  function element(tag, attrs={}, text='') {
    const node=document.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) key === 'class' ? node.className=value : node.setAttribute(key,value);
    if (text) node.textContent=text;
    return node;
  }
  const button = (label, onclick, attrs={}) => { const node=element('button',{type:'button',...attrs},label); node.onclick=onclick; return node; };

  // ---- Shell: shared Sidebar + TopBar -------------------------------------------------------------
  AiBuilderSidebar.mount({active:'edit'});
  const header=document.querySelector('body > header'), brand=header.querySelector('.brand');
  header.classList.add('ai-topbar');
  brand.innerHTML='<span class="ai-breadcrumb">AI Builder<span class="ai-breadcrumb-divider">/</span><b>편집하기</b></span><strong id="builder-document-name">문서 불러오는 중</strong>';
  const headerActions=header.querySelector('.header-actions'), legacyActions=[...headerActions.children], historyToolbar=header.querySelector('.history-toolbar');
  headerActions.innerHTML='<span class="builder-save-state" id="builder-save-state">저장됨</span><button id="builder-save" class="review-primary">저장</button>';
  headerActions.prepend(historyToolbar);
  $('history-undo').innerHTML='<span aria-hidden="true">↶</span>'; $('history-redo').innerHTML='<span aria-hidden="true">↷</span>';
  $('history-undo').setAttribute('aria-label','실행 취소'); $('history-redo').setAttribute('aria-label','다시 실행');

  // ---- Right panel: 채팅 | 직접 편집 | 데이터 연결 --------------------------------------------------
  const aside=document.querySelector('main > aside'), legacySections=[...aside.children];
  const tabs=element('div',{class:'builder-tabs',role:'tablist'}), direct=element('div',{class:'builder-panel builder-direct',role:'tabpanel'}), bindingPanel=element('div',{class:'builder-panel builder-data',role:'tabpanel'}), ai=element('div',{class:'builder-panel builder-chat',role:'tabpanel'});
  const panels={ai,direct,binding:bindingPanel};
  for (const [key,label] of [['ai','채팅'],['direct','직접 편집'],['binding','데이터 연결']]) { const tab=button(label,()=>selectTab(key),{class:'builder-tab',role:'tab','data-tab':key,'aria-selected':String(key==='ai')}); tabs.append(tab); }
  // The legacy editor stays mounted (hidden): its inputs, change set and history bridge remain the single write path.
  const legacy=element('div',{class:'builder-legacy',hidden:''}); legacy.append(...legacySections,...legacyActions);
  const inspector=element('div',{id:'builder-inspector'}); direct.append(inspector);
  bindingPanel.innerHTML='<div id="builder-binding-body"></div>';
  aside.replaceChildren(tabs,ai,direct,bindingPanel,legacy);
  const errorBox=element('div',{id:'builder-error',class:'builder-error',role:'alert',hidden:''}); document.body.append(errorBox);

  function selectTab(key) {
    for (const [name,panel] of Object.entries(panels)) panel.hidden=name!==key;
    tabs.querySelectorAll('[role=tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.tab===key)));
    // The tab decides the workspace mode; only 직접 편집 enables Viewer editing interaction.
    MvpWorkspaceMode.set({ai:'chat',direct:'direct-edit',binding:'data-binding'}[key]);
    if (key==='binding') renderData().catch(showError);
  }
  function setSaveState(text,bad=false) { const node=$('builder-save-state'); node.textContent=text; node.classList.toggle('bad',bad); }
  const FRIENDLY={IMPORT_TEMPLATE_INVALID:'서식을 불러오는 중 문제가 발생했습니다.',FORM_PARSE_FAILED:'서식을 불러오는 중 문제가 발생했습니다.',SOURCE_PROJECT_NOT_FOUND:'서식을 불러오는 중 문제가 발생했습니다.',INVALID_JSON:'JSON 형식이 올바르지 않습니다.'};
  // Users see a plain message; raw codes and contract text are only revealed behind 자세히 보기 in debug mode.
  function showError(error) {
    state.lastError=error;
    const message=FRIENDLY[error?.code]||error?.message||'요청을 처리하지 못했습니다.';
    errorBox.replaceChildren(element('span',{},message));
    if (debug && error?.code) { const more=element('details'); more.append(element('summary',{},'자세히 보기'),element('code',{},`${error.code}${error.details?` ${JSON.stringify(error.details)}`:''}`)); errorBox.append(more); }
    errorBox.append(button('×',()=>{errorBox.hidden=true},{class:'builder-error-close','aria-label':'닫기'}));
    errorBox.hidden=false; clearTimeout(showError.timer); showError.timer=setTimeout(()=>{errorBox.hidden=true},6000);
    setSaveState('확인 필요',true);
  }
  window.addEventListener('unhandledrejection',event=>{if(event.reason?.code)showError(event.reason)});

  // ---- 채팅 ----------------------------------------------------------------------------------------
  ai.innerHTML='<div class="chat-workspace"><div id="chat-conversation" class="chat-conversation" role="log" aria-live="polite"></div><form class="ai-composer"><button class="attach" type="button" aria-label="데이터 연결 열기" title="데이터 연결">＋</button><input aria-label="서식 수정 요청" placeholder="서식 수정 요청을 입력하세요"><button class="chat-send" type="submit" disabled aria-label="전송">전송</button></form></div>';
  const chatInput=ai.querySelector('.ai-composer input'), chatSend=ai.querySelector('.chat-send'), conversation=$('chat-conversation');
  const SUGGESTIONS={'제목 수정':'문서 제목을 수정해줘','표 열 너비 조정':'두 번째 표의 열 너비를 조정해줘','행 이동':'선택한 행을 아래로 이동해줘','데이터 연결':'JSON 데이터를 연결해줘'};
  // ChatProvider adapter: a provider receives the message plus the shared Builder state and returns {reply}.
  let chatProvider=null;
  const time=()=>new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  function bubble(kind,...content){ const row=element('div',{class:`chat-row ${kind}`}); if(kind==='assistant')row.append(element('span',{class:'chat-avatar','aria-hidden':'true'},'AI')); const node=element('div',{class:`chat-message ${kind}`}); for(const part of content)node.append(typeof part==='string'?element('p',{},part):part); node.append(element('time',{},time())); row.append(node); conversation.append(row); conversation.scrollTop=conversation.scrollHeight; return node; }
  // First AI message: greeting with the current document and compact suggestion chips (they only fill the composer).
  function greet(){ conversation.replaceChildren(); const chips=element('div',{class:'chat-suggestions'}); for (const [label,prompt] of Object.entries(SUGGESTIONS)) chips.append(button(label,()=>{chatInput.value=prompt;chatInput.dispatchEvent(new Event('input'));chatInput.focus()})); const name=element('b',{id:'chat-document-name'},state.document?.title||'현재 문서'); const intro=element('p'); intro.append('현재 "',name,'" 문서를 보고 있습니다.'); bubble('assistant','안녕하세요.',intro,'문구 수정, 표 편집, 데이터 연결 등을 요청할 수 있습니다.',element('small',{class:'chat-suggestions-title'},'추천 작업'),chips); }
  chatInput.oninput=()=>{chatSend.disabled=!chatInput.value.trim()};
  ai.querySelector('.attach').onclick=()=>{selectTab('binding')};
  ai.querySelector('.ai-composer').onsubmit=async event=>{
    event.preventDefault(); const message=chatInput.value.trim(); if(!message)return;
    bubble('user',message); chatInput.value=''; chatSend.disabled=true;
    // No backend yet: say so honestly instead of claiming a change was made.
    if (!chatProvider) { bubble('assistant','AI 연결이 아직 설정되지 않았습니다.'); return; }
    try { const result=await chatProvider.send({message,scope,state:builderState()}); if(result?.reply)bubble('assistant',result.reply); }
    catch (error) { bubble('assistant',error.message||'응답을 받지 못했습니다.'); }
  };
  const builderState=()=>({document:state.document,selection:state.selection,staticSelection:state.staticSelection,importContext:state.importContext,bindingProposal:state.bindingProposal});

  // ---- 직접 편집 -----------------------------------------------------------------------------------
  // Existing legacy review mode is the interaction bridge for Viewer selection; the Builder turns it on at boot.
  if ($('review-toggle')?.getAttribute('aria-pressed') !== 'true') $('review-toggle')?.click();
  const TYPE={UBLabel:['T','텍스트'],Cell:['▦','표 셀'],UBImage:['▧','이미지']};
  const prop=key=>$(`prop-${key}`);
  const current=key=>{const el=prop(key);return !el?undefined:el.type==='checkbox'?el.checked:['fontSize','width','height','left','top','scaleType'].includes(key)?Number(el.value):el.value};
  const supports=key=>Boolean(state.source?.properties?.includes(key));
  async function setProperty(key,value){ try { await mvpDirectBridge.property(key,value); setSaveState('저장 안 됨'); renderInspector(); } catch (error) { showError(error); renderInspector(); } }
  const section=(title,...children)=>{const node=element('section',{class:'inspector-section'});if(title)node.append(element('h3',{},title));node.append(...children);return node};
  function numberField(label,key,{min=1,max=3000,step=1,onChange}={}){
    const wrap=element('div',{class:'inspector-field'}),input=element('input',{type:'number',min:String(min),max:String(max),'data-key':key}),minus=button('-',()=>commit(Number(input.value)-step),{class:'stepper','aria-label':`${label} 줄이기`}),plus=button('+',()=>commit(Number(input.value)+step),{class:'stepper','aria-label':`${label} 늘리기`});
    input.value=String(Math.round(current(key)??0));
    const commit=value=>{value=Math.max(min,Math.min(max,Math.round(value)));input.value=String(value);(onChange||(v=>setProperty(key,v)))(value)};
    input.onkeydown=event=>{if(event.key==='Enter')input.blur()};
    input.onchange=()=>commit(Number(input.value));
    const row=element('div',{class:'stepper-row'});row.append(minus,input,plus);
    wrap.append(element('label',{},label),row);return wrap;
  }
  function toggle(label,checked,onChange,attrs={}){const wrap=element('label',{class:'inspector-toggle',...attrs}),input=element('input',{type:'checkbox',role:'switch'});input.checked=checked;input.onchange=()=>onChange(input.checked);wrap.append(element('span',{},label),input,element('i',{'aria-hidden':'true'}));return wrap}
  function segmented(options,value,onChange,attrs={}){const wrap=element('div',{class:'segmented',role:'group',...attrs});for(const [key,label] of options){const b=button(label,()=>onChange(key),{'aria-pressed':String(String(key)===String(value)),'data-value':String(key)});wrap.append(b)}return wrap}
  function selectedCard(icon,type,name){const card=element('div',{class:'selected-element'});card.append(element('span',{},icon));const text=element('div');text.append(element('small',{},type),element('strong',{},name||'-'));card.append(text);return card}

  function renderInspector(){
    inspector.replaceChildren();
    const selection=state.selection, source=state.source;
    if (state.staticSelection && !selection) return renderStructureOnly();
    if (!selection || !source) { inspector.append(element('div',{class:'inspector-empty'},'문서에서 편집할 항목을 선택하세요.')); return; }
    const kind=source.sourceClassName, [icon,type]=TYPE[kind]||['◻','요소'], isImage=kind==='UBImage';
    const cellInfo=kind==='Cell'||/^IMPCL/.test(selection.sourceObjectId||'')?window.__mvp12?.selectCell?.(selection.sourceObjectId):null;
    const name=isImage?selection.sourceObjectId:(current('text')||selection.currentText||'').trim()||selection.sourceObjectId;
    inspector.append(selectedCard(icon,cellInfo?'표 셀':type,name));
    if (cellInfo) inspector.append(rowSection(cellInfo),columnSection(cellInfo));
    if (isImage) inspector.append(...imageSections());
    else inspector.append(...textSections());
    if (supports('visible')) inspector.append(section('표시',toggle(isImage?'이미지 표시':'표시',current('visible')!==false,value=>setProperty('visible',value),{'data-control':'visible'})));
    const reset=button('이 요소의 변경 되돌리기',()=>mvpDirectBridge.action('resetAll').then(renderInspector),{class:'link-button'});
    const advanced=element('details',{class:'inspector-advanced'});advanced.append(element('summary',{},'고급 설정'),element('p',{},`원본 ID ${selection.sourceObjectId} · ${source.positionConfidence||''}`),reset);
    inspector.append(advanced);
  }
  function textSections(){
    const nodes=[];
    if (supports('text')) {
      const area=element('textarea',{rows:'2','aria-label':'문구','data-key':'text'});area.value=current('text')??'';
      area.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();area.blur()}};
      area.onchange=()=>setProperty('text',area.value);
      nodes.push(section('빠른 편집',area));
    }
    const style=[];
    if (supports('fontSize')) style.push(numberField('글꼴 크기','fontSize',{min:6,max:96}));
    const toolbar=element('div',{class:'text-tools'});
    if (supports('fontWeight')) toolbar.append(button('B',()=>setProperty('fontWeight',current('fontWeight')==='bold'?'normal':'bold'),{class:'bold-toggle','aria-pressed':String(current('fontWeight')==='bold'),'aria-label':'굵게'}));
    if (supports('textAlign')) toolbar.append(segmented([['left','왼쪽'],['center','가운데'],['right','오른쪽']],current('textAlign'),value=>setProperty('textAlign',value),{'aria-label':'가로 정렬'}));
    if (toolbar.children.length) style.push(toolbar);
    if (style.length) { const last=nodes.at(-1); if(last) last.append(...style); else nodes.push(section('빠른 편집',...style)); }
    const size=[]; if (supports('width')) size.push(numberField('너비','width')); if (supports('height')) size.push(numberField('높이','height'));
    if (size.length) { const pair=element('div',{class:'field-pair'}); pair.append(...size); nodes.push(section('크기',pair)); }
    if (supports('left')||supports('top')) { const pair=element('div',{class:'field-pair'}); if(supports('left'))pair.append(numberField('X','left',{min:0,max:2000})); if(supports('top'))pair.append(numberField('Y','top',{min:0,max:3000})); nodes.push(section('위치',pair)); }
    return nodes;
  }
  // Content bounds used for 왼쪽/가운데/오른쪽 image alignment: the union of the page's tables, else the page width.
  function contentBounds(){const tables=window.__mvp12?.tables||[];if(!tables.length)return{left:0,right:794};return{left:Math.min(...tables.map(t=>t.x)),right:Math.max(...tables.map(t=>t.x+t.width))}}
  let ratioLocked=true;
  function imageSections(){
    const nodes=[], width=current('width'), height=current('height'), ratio=width&&height?width/height:1;
    const pair=element('div',{class:'field-pair'});
    const resize=async(key,value)=>{ if(ratioLocked){ const other=key==='width'?Math.max(1,Math.round(value/ratio)):Math.max(1,Math.round(value*ratio)); await setProperty(key,value); await setProperty(key==='width'?'height':'width',other); } else await setProperty(key,value); };
    if (supports('width')) pair.append(numberField('너비','width',{onChange:v=>resize('width',v)}));
    if (supports('height')) pair.append(numberField('높이','height',{onChange:v=>resize('height',v)}));
    const lock=element('label',{class:'inspector-check'}),box=element('input',{type:'checkbox','data-control':'ratio-lock'});box.checked=ratioLocked;box.onchange=()=>{ratioLocked=box.checked};lock.append(box,document.createTextNode(' 비율 유지'));
    nodes.push(section('크기',pair,lock));
    if (supports('left')) {
      const bounds=contentBounds(),w=current('width');
      const align=segmented([['left','왼쪽'],['center','가운데'],['right','오른쪽']],null,key=>setProperty('left',Math.max(0,Math.round(key==='left'?bounds.left:key==='right'?bounds.right-w:(bounds.left+bounds.right-w)/2))),{'aria-label':'이미지 위치','data-control':'image-align'});
      const exact=element('details',{class:'inspector-advanced'}),xy=element('div',{class:'field-pair'});xy.append(numberField('X','left',{min:0,max:2000}),numberField('Y','top',{min:0,max:3000}));exact.append(element('summary',{},'고급 위치'),xy);
      nodes.push(section('위치',align,exact));
    }
    const image=[];
    if (supports('scaleType')) image.push(segmented([[1,'맞춤'],[0,'채우기'],[3,'원본']],current('scaleType'),value=>setProperty('scaleType',Number(value)),{'aria-label':'이미지 맞춤','data-control':'image-fit'}));
    if (supports('data')) {
      const pick=element('label',{class:'file-button'}),file=element('input',{type:'file',accept:'image/png,image/jpeg,image/gif','data-control':'image-replace'}),status=element('small',{class:'inspector-status'});
      pick.append(document.createTextNode('이미지 교체'),file);
      file.onchange=async()=>{const chosen=file.files[0];if(!chosen)return;try{status.textContent='이미지를 확인하고 있습니다.';const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(chosen)});const asset=await api('/api/image-assets',{method:'POST',body:JSON.stringify({fileName:chosen.name,base64})});await setProperty('data',asset.ref)}catch(error){status.textContent=error.message}};
      image.push(pick,status);
    }
    if (image.length) nodes.push(section('이미지',...image));
    return nodes;
  }

  // Table row/column editing for the selected cell's logical row and column (imported static tables).
  const saveStructure=async(operation,payload)=>{try{setSaveState('저장 중');await window.__mvp12.save(operation,payload);setSaveState('저장 안 됨');await window.__mvp58?.load?.()}catch(error){showError(error)}finally{renderInspector()}};
  function operationFor(operation,key){return (window.__mvp12?.operations||[]).filter(x=>x.operation===operation&&(x.logicalRowKey===key||x.logicalColumnKey===key)).at(-1)||null}
  async function removeOperation(op){try{await api(`/api/structure-operations/${op.operationId}?${new URLSearchParams(scope)}`,{method:'DELETE'});await window.__mvp12.loadOps();await window.__mvp58?.load?.();setSaveState('저장 안 됨')}catch(error){showError(error)}finally{renderInspector()}}
  function autoRowHeight(info){const objects=info.row.viewerObjectIds.map(id=>canvasObject(id)).filter(Boolean),ctx=document.createElement('canvas').getContext('2d');let need=12;for(const o of objects){const size=Number(o.fontSize||12);ctx.font=`${o.fontWeight||'normal'} ${size}px sans-serif`;const lines=String(o.text||'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(ctx.measureText(line).width/Math.max(1,Number(o.width)-6))),0);need=Math.max(need,Math.ceil(lines*size*1.35+6))}return Math.min(200,need)}
  function autoColumnWidth(info){const objects=info.column.viewerObjectIds.map(id=>canvasObject(id)).filter(o=>o&&(info.table.cells.find(c=>c.viewerObjectId===o.id)?.colSpan||1)===1),ctx=document.createElement('canvas').getContext('2d');let need=20;for(const o of objects){const size=Number(o.fontSize||12);ctx.font=`${o.fontWeight||'normal'} ${size}px sans-serif`;for(const line of String(o.text||'').split('\n'))need=Math.max(need,Math.ceil(ctx.measureText(line).width+12))}return Math.min(600,need)}
  const canvasObject=id=>$('viewer').contentWindow?.canvasModule?.getCanvas?.(0)?.getObjects?.().find(o=>o.id===id);
  function rowSection(info){
    const key=info.row.logicalRowKey,position=info.rowPosition,hidden=operationFor('hideRow',key),node=section(`행 편집`);
    node.classList.add('structure-section');node.dataset.structure='row';
    node.append(element('p',{class:'structure-meta'},`${info.table.sourceTableId} · 행 ${position+1} / ${info.rowCount}`));
    const move=element('div',{class:'structure-actions'});
    move.append(button('↑ 위로 이동',()=>saveStructure('moveRow',{logicalRowKey:key,toRowIndex:position-1}),{'data-action':'row-up',...(position<=0?{disabled:''}:{})}),button('↓ 아래로 이동',()=>saveStructure('moveRow',{logicalRowKey:key,toRowIndex:position+1}),{'data-action':'row-down',...(position>=info.rowCount-1?{disabled:''}:{})}));
    const remove=button('행 삭제',()=>{if(confirm('이 행을 삭제할까요? 실행 취소로 되돌릴 수 있습니다.'))saveStructure('removeRow',{logicalRowKey:key})},{class:'danger','data-action':'row-delete'});
    const height=numberField('행 높이','row-height',{min:12,max:200,onChange:value=>saveStructure('resizeRow',{logicalRowKey:key,afterHeight:value})});
    height.querySelector('input').value=String(window.__mvp12.layouts?.[info.table.sourceTableId]?.rowHeights?.[position]??info.row.height);
    const fit=button('자동 맞춤',()=>saveStructure('resizeRow',{logicalRowKey:key,afterHeight:autoRowHeight(info)}),{'data-action':'row-fit'});
    node.append(move,remove,height,fit,toggle('행 숨김',Boolean(hidden),value=>value?saveStructure('hideRow',{logicalRowKey:key}):removeOperation(hidden),{'data-control':'row-hide'}));
    return node;
  }
  function columnSection(info){
    const key=info.column.logicalColumnKey,position=info.columnPosition,hidden=operationFor('hideColumn',key),node=section('열 편집');
    node.classList.add('structure-section');node.dataset.structure='column';
    node.append(element('p',{class:'structure-meta'},`${info.table.sourceTableId} · 열 ${position+1} / ${info.columnCount}`));
    const move=element('div',{class:'structure-actions'});
    move.append(button('← 왼쪽 이동',()=>saveStructure('moveColumn',{logicalColumnKey:key,toVisualIndex:position-1}),{'data-action':'column-left',...(position<=0?{disabled:''}:{})}),button('오른쪽 이동 →',()=>saveStructure('moveColumn',{logicalColumnKey:key,toVisualIndex:position+1}),{'data-action':'column-right',...(position>=info.columnCount-1?{disabled:''}:{})}));
    const width=numberField('열 너비','column-width',{min:20,max:600,onChange:value=>saveStructure('resizeColumn',{logicalColumnKey:key,afterWidth:value})});
    width.querySelector('input').value=String(window.__mvp12.layouts?.[info.table.sourceTableId]?.columnWidths?.[position]??info.column.width);
    const fit=button('자동 맞춤',()=>saveStructure('resizeColumn',{logicalColumnKey:key,afterWidth:autoColumnWidth(info)}),{'data-action':'column-fit'});
    node.append(move,width,fit,toggle('열 숨김',Boolean(hidden),value=>value?saveStructure('hideColumn',{logicalColumnKey:key}):removeOperation(hidden),{'data-control':'column-hide'}));
    return node;
  }
  // Row/column picked from the table grips (no cell selected) - imported tables use the same sections;
  // the sample composite form keeps its verified legacy controls.
  function renderStructureOnly(){
    const detail=state.staticSelection, mvp12=window.__mvp12;
    if (mvp12?.tables && detail.tableKey) {
      const table=mvp12.tables.find(t=>t.tableKey===detail.tableKey), layout=mvp12.layouts[table.sourceTableId];
      const row=table.rows.find(r=>r.logicalRowKey===detail.key), column=table.columns.find(c=>c.logicalColumnKey===detail.key);
      const info={table,row:row||table.rows[layout.rowOrder[0]],column:column||table.columns[layout.columnOrder[0]],rowCount:layout.rowOrder.length,columnCount:table.columnCount};
      info.rowPosition=layout.rowOrder.indexOf(info.row.rowIndex);info.columnPosition=layout.columnOrder.indexOf(info.column.columnIndex);
      inspector.append(selectedCard(detail.type==='COLUMN'?'↕':detail.type==='ROW'?'▦':'▤',detail.type==='COLUMN'?'표 열':detail.type==='ROW'?'표 행':'표',table.sourceTableId));
      if (detail.type==='ROW') inspector.append(rowSection(info)); else if (detail.type==='COLUMN') inspector.append(columnSection(info)); else inspector.append(element('p',{class:'structure-meta'},'행이나 셀을 선택하면 행·열을 편집할 수 있습니다.'));
      return;
    }
    inspector.append(selectedCard(detail.type==='COLUMN'?'↕':'▦',detail.type==='COLUMN'?'표 열':'표 행',detail.key));
    if (detail.type==='COLUMN' && $('mvp51-width')) {
      const move=element('div',{class:'structure-actions'});move.append(button('← 왼쪽 이동',()=>$('mvp52-left').click(),$('mvp52-left').disabled?{disabled:''}:{}),button('오른쪽 이동 →',()=>$('mvp52-right').click(),$('mvp52-right').disabled?{disabled:''}:{}));
      const width=numberField('열 너비','column-width',{min:20,max:600,onChange:value=>{$('mvp51-width').value=String(value);$('mvp51-save-width').click();setSaveState('저장 안 됨')}});width.querySelector('input').value=$('mvp51-width').value;
      inspector.append(section('열 편집',move,width));
    }
    if (detail.type==='ROW' && $('mvp52-row-height')) {
      const height=numberField('행 높이','row-height',{min:12,max:200,onChange:value=>{$('mvp52-row-height').value=String(value);$('mvp52-row-resize').click();setSaveState('저장 안 됨')}});height.querySelector('input').value=$('mvp52-row-height').value;
      inspector.append(section('행 편집',height,toggle('행 숨김',false,()=>{$('mvp52-row-hide').click();setSaveState('저장 안 됨')})));
    }
  }

  window.addEventListener('mysuit-object-selection-resolved',event=>{
    const {render,source}=event.detail;
    state.selection=render; state.source=source; state.staticSelection=null; state.bindingTarget=render.sourceObjectId;
    renderInspector(); renderDataIfVisible();
    window.dispatchEvent(new CustomEvent('ai-builder:selection-changed',{detail:{type:'selectionChanged',targetType:source.targetType||source.sourceClassName,sourceId:source.templateSourceId||source.sourceObjectId,runtimeId:render.viewerObjectId,runtimeInstanceKey:render.renderInstanceKey,rowIndex:render.rowIndex,bandId:render.bandId,page:render.pageIndex||0}}));
  });
  window.addEventListener('mysuit-static-selection',event=>{
    state.selection=null; state.source=null; state.staticSelection=event.detail; renderInspector();
    window.dispatchEvent(new CustomEvent('ai-builder:selection-changed',{detail:{type:'selectionChanged',targetType:event.detail.type,sourceId:event.detail.key,page:0}}));
  });
  window.addEventListener('mvp:target-selected',event=>{const type=event.detail.targetType==='LOGICAL_ROW'?'ROW':event.detail.targetType==='LOGICAL_COLUMN'?'COLUMN':null;if(type)window.dispatchEvent(new CustomEvent('mysuit-static-selection',{detail:{type,key:event.detail.targetKey,count:1,ids:[]}}))});
  window.addEventListener('mvp:clear-object-selection',()=>setTimeout(()=>{if(/^[-\u2014]?$/.test($('source-id')?.textContent.trim()||'')){state.selection=null;state.source=null;renderInspector()}}));
  // Leaving 직접 편집 drops the editing selection (Viewer overlays are cleared by their controllers).
  window.addEventListener('mvp:workspace-mode',event=>{if(!event.detail.leavingDirectEdit)return;state.selection=null;state.source=null;state.staticSelection=null;renderInspector()});
  window.addEventListener('mysuit-static-structure-changed',()=>setSaveState('저장 안 됨'));
  new MutationObserver(()=>{setSaveState('저장 안 됨');if(state.source)renderInspector()}).observe($('patch-count'),{childList:true,subtree:true,characterData:true});

  // ---- 데이터 연결 ---------------------------------------------------------------------------------
  const statusLabel={AUTO:'자동 연결',NEEDS_REVIEW:'확인 필요',UNBOUND:'미연결',UNRESOLVED_TARGET:'대상 확인 필요',DEFERRED_ARRAY:'반복 데이터'};
  const dataBody=()=>$('builder-binding-body');
  function renderDataIfVisible(){ if(!bindingPanel.hidden) renderData().catch(showError); }
  async function renderData(){
    if (state.importContext?.json) { if(!state.bindingProposal) state.bindingProposal=(await api(`/api/ai-builder/binding-proposals?${new URLSearchParams(scope)}`)).proposal; return renderProposalReview(); }
    // Forms without an Import Context (sample, legacy imports) keep the per-object Dataset/Column binding editor.
    if (!state.importContext) return renderObjectBinding();
    renderDataEmpty();
  }
  async function renderObjectBinding(){
    const body=dataBody(); body.className=''; body.replaceChildren(element('h2',{class:'data-title'},'데이터 연결'));
    const objectId=state.bindingTarget;
    if (!objectId) { body.append(element('div',{class:'inspector-empty'},'문서에서 연결할 요소를 선택하세요.')); return; }
    const data=await api(`/api/ai-builder/context?${new URLSearchParams({...scope,objectId})}`);
    state.datasets=data.datasets||[]; state.currentBinding=data.binding||null;
    const binding=state.currentBinding, summary=element('dl',{class:'binding-summary'});
    for (const [label,value] of [['현재 선택',objectId],['연결 상태',binding?(binding.dataType==='1'?`${binding.dataSet}.${binding.column}`:`parameter.${binding.parameter}`):'데이터 연결 없음'],['상태',binding?'연결됨':'연결 안 됨']]) summary.append(element('dt',{},label),element('dd',{},value));
    body.append(summary);
    const usable=state.datasets.filter(item=>item.id&&item.columns.length), actions=element('div',{class:'builder-actions'});
    if (usable.length) {
      const dataset=element('select',{id:'builder-dataset'}), column=element('select',{id:'builder-column'}), f1=element('div',{class:'builder-field'}), f2=element('div',{class:'builder-field'});
      for (const item of usable) dataset.append(element('option',{value:item.id},item.id));
      if (binding?.dataSet && usable.some(item=>item.id===binding.dataSet)) dataset.value=binding.dataSet;
      const columns=()=>{column.replaceChildren();for(const name of usable.find(x=>x.id===dataset.value)?.columns||[])column.append(element('option',{value:name},name));if(binding?.dataSet===dataset.value)column.value=binding.column};
      dataset.onchange=columns; columns();
      f1.append(element('label',{for:'builder-dataset'},'Dataset'),dataset); f2.append(element('label',{for:'builder-column'},'Column'),column); body.append(f1,f2);
      actions.append(button('연결',()=>writeBinding('bindField',{dataType:'1',dataSet:dataset.value,column:column.value,text:`{${dataset.value}.${column.value}}`}),{class:'ai-primary'}));
    }
    if (binding) actions.append(button('연결 해제',()=>writeBinding('unbindField',null),{class:'ai-secondary'}));
    if (actions.children.length) body.append(actions);
  }
  async function writeBinding(operation,after){
    try { setSaveState('저장 중'); await api('/api/binding-operations',{method:'PUT',body:JSON.stringify({...scope,operation,target:{objectId:state.bindingTarget},before:state.currentBinding,after})}); setSaveState('저장 안 됨'); await window.__mvp58?.load?.(); }
    catch (error) { showError(error); }
    finally { await renderObjectBinding().catch(()=>{}); }
  }
  function jsonInputs(onRegistered){
    const box=element('div',{class:'json-inputs'}),actions=element('div',{class:'data-actions'}),status=element('small',{id:'workspace-json-status',class:'inspector-status'});
    const pick=element('label',{class:'json-file-button'}),file=element('input',{id:'workspace-json-file',type:'file',accept:'application/json,.json'});pick.append(document.createTextNode('JSON 파일 선택'),file);
    const editor=element('div',{id:'workspace-json-editor',hidden:''}),area=element('textarea',{'aria-label':'JSON 직접 입력',spellcheck:'false',placeholder:'{\n  "name": "홍길동"\n}'}),use=button('데이터 사용',()=>registerJson(area.value,null,status).then(onRegistered,()=>{}),{class:'ai-primary primary','data-action':'json-use'});
    editor.append(area,use);
    actions.append(pick,button('JSON 직접 입력',()=>{editor.hidden=!editor.hidden;if(!editor.hidden)area.focus()},{id:'workspace-json-direct'}));
    file.onchange=async()=>{const chosen=file.files[0];if(!chosen)return;await registerJson(await chosen.text(),chosen.name,status).then(onRegistered,()=>{});file.value=''};
    box.append(actions,element('p',{class:'data-or'},''),editor,status);return box;
  }
  function renderDataEmpty(){
    const body=dataBody(); body.className=''; body.replaceChildren();
    const empty=element('section',{class:'data-empty'});
    empty.append(element('h2',{},'데이터 연결'),element('strong',{},'연결된 데이터가 없습니다.'),element('p',{},'JSON 데이터를 추가하면 문서 항목과 자동으로 연결할 수 있습니다.'),jsonInputs(()=>{}));
    body.append(empty);
  }
  // Registration reuses the Import Context contract: validator → Schema Analyzer → Scalar/Array Proposal.
  async function registerJson(raw,fileName,status){
    try { status.className='inspector-status'; status.textContent='데이터를 분석하고 있습니다.';
      const data=await api('/api/ai-builder/context/json',{method:'PUT',body:JSON.stringify({...scope,json:{raw,fileName}})});
      state.importContext=data.context; state.bindingProposal=data.proposal; state.selectedProposalTarget=null; status.textContent='';
      renderProposalReview(); setSaveState('데이터 등록됨');
    } catch (error) {
      status.className='inspector-status error';
      status.textContent=error.code==='DATA_BINDING_CONFLICT'?`기존 연결 ${error.details?.missing?.length||0}건이 새 데이터에 없습니다: ${(error.details?.missing||[]).join(', ')}. 해당 연결을 먼저 해제해 주세요.`:(FRIENDLY[error.code]||error.message||'JSON을 확인해 주세요.');
      throw error;
    }
  }
  async function removeJson(){
    if(!confirm('등록한 데이터를 제거할까요?'))return;
    try { const data=await api('/api/ai-builder/context/json',{method:'DELETE',body:JSON.stringify(scope)}); state.importContext=data.context; state.bindingProposal=null; renderDataEmpty(); setSaveState('데이터 제거됨'); }
    catch (error) { showError(error); }
  }
  function dataHeader(){
    const json=state.importContext.json, fields=(state.importContext.jsonSchema||[]).filter(x=>x.isLeaf&&!x.isArrayItem).length+(state.importContext.jsonArrays||[]).length;
    const card=element('section',{class:'data-source'}),meta=element('div');
    meta.append(element('small',{},'데이터'),element('strong',{},json.fileName||'직접 입력 JSON'),element('span',{},`${fields} fields${state.bindingProposal?.appliedAt?' · 연결 적용됨':''}`));
    const change=element('div',{class:'data-source-actions'}),status=element('small',{class:'inspector-status'});
    const replace=element('label',{class:'json-file-button'}),file=element('input',{type:'file',accept:'application/json,.json','data-action':'json-change'});replace.append(document.createTextNode('변경'),file);
    file.onchange=async()=>{const chosen=file.files[0];if(!chosen)return;try{await registerJson(await chosen.text(),chosen.name,status)}catch(_){card.append(status)}};
    change.append(replace,button('제거',removeJson,{'data-action':'json-remove'}));
    card.append(element('span',{class:'data-source-icon'},'{ }'),meta,change);
    return card;
  }
  function renderProposalReview(){
    const body=dataBody(); body.className=''; body.replaceChildren(dataHeader());
    const summary=state.bindingProposal?.summary||{}, stats=element('div',{class:'proposal-summary'});
    for (const [key,label] of [['auto','자동 연결'],['review','확인 필요'],['unbound','미연결']]) { const item=element('span',{'data-kind':key}); item.append(element('b',{},String(summary[key]||0)),document.createTextNode(` ${label}`)); stats.append(item); }
    body.append(stats,element('h3',{class:'binding-kind'},'단일 항목'));
    const list=element('div',{class:'proposal-list'}), rows=(state.bindingProposal?.proposals||[]).filter(x=>x.targetId);
    for (const row of rows) { const item=button('',()=>{state.selectedProposalTarget=row.targetId;renderProposalReview()},{class:`proposal-row status-${row.status.toLowerCase()}${row.targetId===state.selectedProposalTarget?' selected':''}`,'data-target-id':row.targetId}); item.append(element('span',{class:'proposal-label'},row.label||row.targetId),element('code',{},row.selectedPath?row.selectedPath.replace(/^\$\./,''):'-'),element('span',{class:'proposal-status'},row.selectedPath&&row.status!=='AUTO'?'✓ 연결':row.status==='AUTO'?'✓ 연결':statusLabel[row.status]||row.status)); list.append(item); }
    body.append(list);
    const selected=rows.find(x=>x.targetId===(state.selectedProposalTarget||rows[0]?.targetId));
    if (selected) {
      state.selectedProposalTarget=selected.targetId;
      const detail=element('section',{class:'proposal-detail'}), field=element('div',{class:'builder-field'}), select=element('select',{'data-action':'proposal-field'});
      detail.append(element('h3',{},selected.label||selected.targetId),element('div',{class:'proposal-confidence'},`${statusLabel[selected.status]||selected.status} · Confidence ${Math.round((selected.confidence||0)*100)}%`));
      select.append(element('option',{value:''},'연결 안 함'));
      for (const map of state.bindingProposal.dataset?.mapping||[]) { const node=(state.importContext.jsonSchema||[]).find(x=>x.path===map.jsonPath); const option=element('option',{value:map.jsonPath},map.jsonPath.replace(/^\$\./,'')); option.disabled=Boolean(node?.isArray); select.append(option); }
      select.value=selected.selectedPath||'';
      select.onchange=async()=>{try{const data=await api('/api/ai-builder/binding-proposals/select',{method:'PUT',body:JSON.stringify({...scope,targetId:selected.targetId,selectedPath:select.value||null})});state.bindingProposal=data.proposal;renderProposalReview()}catch(error){showError(error)}};
      field.append(element('label',{},'연결 필드'),select);
      const sample=selected.candidates?.find(x=>x.path===select.value)?.sampleValue??state.importContext?.jsonSchema?.find(x=>x.path===select.value)?.sampleValue??'-';
      detail.append(field,element('div',{class:'proposal-sample'},`샘플 값  ${sample}`));
      body.append(detail);
    }
    const actions=element('div',{class:'builder-actions'}), apply=button(state.bindingProposal?.appliedAt?'연결 다시 적용':'연결 적용',applyProposals,{class:'ai-primary primary','data-action':'binding-apply'});
    apply.disabled=!rows.some(x=>x.selectedPath); actions.append(apply); body.append(actions);
    renderArrayReview(body);
  }
  function renderArrayReview(body){
    const rows=state.bindingProposal?.arrayProposals||[], section=element('section',{class:'array-review'});
    section.append(element('h3',{},'반복 데이터'));
    if (!rows.length) { section.append(element('p',{class:'array-review-count'},'반복 데이터와 연결할 표를 찾지 못했습니다.')); body.append(section); return; }
    for (const row of rows) {
      const card=element('article',{class:'array-proposal','data-table-id':row.tableId}), head=element('div',{class:'array-head'});
      head.append(element('strong',{},row.arrayPath.replace(/^\$\./,'')),element('code',{},`표 ${row.tableId}`),element('span',{class:'proposal-status'},statusLabel[row.status]||row.status));
      card.append(head,element('small',{},`샘플 데이터 ${row.sampleCount}건`));
      for (const column of row.columns) {
        const line=element('div',{class:'array-column'}), select=element('select',{});
        for (const map of row.dataset?.mapping||[]) select.append(element('option',{value:map.jsonPath},map.jsonPath.split('.').pop()));
        select.value=column.jsonPath||'';
        select.onchange=async()=>{try{const data=await api('/api/ai-builder/array-proposals/select',{method:'PUT',body:JSON.stringify({...scope,tableId:row.tableId,arrayPath:row.arrayPath,columnIndex:column.columnIndex,jsonPath:select.value})});state.bindingProposal=data.proposal;renderProposalReview()}catch(error){showError(error)}};
        line.append(element('span',{},column.label),select,element('em',{},statusLabel[column.status]||column.status)); card.append(line);
      }
      const apply=button(row.appliedAt?'반복 데이터 연결 다시 적용':'반복 데이터 연결 적용',()=>applyArrayProposal(row),{class:'ai-primary primary array-apply','data-action':'array-apply'});
      apply.disabled=row.columns.some(x=>!x.jsonPath||x.status==='UNBOUND'); card.append(apply); section.append(card);
    }
    body.append(section);
  }
  async function applyProposals(){try{setSaveState('연결 적용 중');const data=await api('/api/ai-builder/binding-proposals/apply',{method:'POST',body:JSON.stringify(scope)});state.bindingProposal.appliedAt=new Date().toISOString();state.savedPreview=data.previewUrl;$('viewer').src=state.savedPreview;setSaveState(`연결 ${data.appliedCount}건 적용됨`);await window.__mvp58?.load?.();renderProposalReview()}catch(error){showError(error)}}
  async function applyArrayProposal(row){try{setSaveState('반복 데이터 연결 중');const data=await api('/api/ai-builder/array-proposals/apply',{method:'POST',body:JSON.stringify({...scope,tableId:row.tableId})});row.appliedAt=new Date().toISOString();state.savedPreview=data.previewUrl;$('viewer').src=state.savedPreview;setSaveState(`반복 데이터 ${data.runtimeDetailRows}건 연결됨`);await window.__mvp58?.load?.();renderProposalReview()}catch(error){showError(error)}}

  // ---- 저장 / 부팅 ---------------------------------------------------------------------------------
  $('builder-save').onclick=async()=>{ try { setSaveState('저장 중'); const data=await api('/api/ai-builder/save',{method:'POST',body:JSON.stringify(scope)}); state.savedPreview=data.previewUrl; $('viewer').src=state.savedPreview; setSaveState('저장 완료'); } catch (error) { showError(error); } };
  async function boot() {
    const data=await api(`/api/ai-builder/context?${new URLSearchParams(scope)}`);
    state.document=data.document; state.importContext=data.importContext; state.bindingProposal=state.importContext?.bindingProposal||null;
    $('builder-document-name').textContent=data.document.title; if($('chat-document-name'))$('chat-document-name').textContent=data.document.title;
    renderInspector();
  }
  greet();
  selectTab('ai');
  boot().catch(showError);

  window.aiBuilder={selectTab,scope,state,builderState,get selectedObjectId(){return state.selection?.sourceObjectId||null},get savedPreview(){return state.savedPreview},get importContext(){return state.importContext},loadBinding:renderData,
    chat:{setProvider(provider){chatProvider=provider||null},get provider(){return chatProvider}},renderInspector,showError};
})();
