(function () {
  // One editor page, two screens. 편집하기 (developer / template designer) and 사용자 편집 (end user) share the Viewer,
  // the operation engine, history and save; the profile only decides which UI layer is shown.
  const SURFACE={'/ai-builder':'developer','/ai-builder/user':'user'}[location.pathname];
  if (!SURFACE) return;
  const PROFILE={
    // Developer / template designer: 속성 and 데이터 are the main panels; the AI assistant is a drawer beside them.
    developer:{route:'edit',title:'편집하기',tabs:[['direct','속성'],['binding','데이터']],defaultTab:'direct',designer:true,assistant:true,tableModes:true,advanced:true,dataAttach:true,cellLabel:'표 셀',cellSection:'셀 편집',
      intro:'서식 구조, 데이터 연결, 문구 수정을 요청할 수 있습니다.',placeholder:'서식 작업을 요청하세요',
      suggestions:{'표 데이터 연결':['이 표를 items 데이터에 연결해줘','link'],'반복 데이터':['이 영역을 반복 데이터로 바꿔줘','repeat'],'제목 수정':['문서 제목을 수정해줘','pencil'],'열 너비 조정':['두 번째 표의 열 너비를 조정해줘','columns']},hint:'예) 이 표를 items 데이터에 연결해줘',
      empty:'캔버스에서 요소를 선택하면 속성이 표시됩니다.',emptyHelp:'문서에서 텍스트, 표 또는 이미지를 클릭하면 속성을 수정할 수 있습니다.'},
    // The user screen hides data binding, table-structure modes and internal identifiers.
    user:{route:'user',title:'사용자 편집',tabs:[['ai','채팅'],['direct','직접 편집']],defaultTab:'ai',designer:false,assistant:false,tableModes:false,advanced:false,dataAttach:false,cellLabel:'문구',cellSection:'문구 편집',
      intro:'문서를 더 멋지게 수정해드릴 수 있어요. 원하는 수정 내용을 말씀해 주세요.',placeholder:'원하는 내용을 자연어로 입력해 주세요.',
      suggestions:{'제목을 수정해줘':['문서 제목을 수정해줘','pencil'],'로고 이미지를 바꿔줘':['로고 이미지를 교체해줘','image'],'표를 보기 좋게 정리해줘':['표를 보기 좋게 정리해줘','list']},hint:'예) 표의 스타일을 더 깔끔하게 해줘',quickEdit:true,
      empty:'문서에서 수정할 문구나 이미지를 선택하세요.',emptyHelp:'문구나 이미지를 클릭하면 바로 수정할 수 있어요.'},
  }[SURFACE];
  const $ = id => document.getElementById(id), params = new URLSearchParams(location.search), context = window.__formContext;
  const draftId = params.get('layoutDraftId') || (context.origin === 'IMPORTED' ? `import_${context.projectName}_${context.formName}_default`.slice(0,80) : 'layout_sample_default');
  const scope = {layoutDraftId:draftId,projectName:context.projectName,formName:context.formName};
  const debug = params.get('debug') === '1';
  // One Builder state: the chat provider, the direct editor and the data tab all read this object.
  const state = {document:null,selection:null,source:null,staticSelection:null,importContext:null,bindingProposal:null,selectedProposalTarget:null,currentBinding:null,datasets:[],savedPreview:null,lastError:null};
  document.body.classList.add('ai-builder');
  document.body.dataset.surface = SURFACE;
  document.title = `${PROFILE.title} · MySuit AI Studio`;

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
  AiBuilderSidebar.mount({active:PROFILE.route});
  const header=document.querySelector('body > header'), brand=header.querySelector('.brand');
  header.classList.add('ai-topbar');
  const ICON={undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',cloud:'<path d="M7 18a5 5 0 0 1-.9-9.9A6 6 0 0 1 17.7 9 4.5 4.5 0 0 1 17.5 18z" fill="currentColor" stroke="none"/><path d="M9.5 13l2 2 3.5-3.5" stroke="#fff"/>',save:'<path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a1 1 0 0 1 1-2z"/><path d="M8 3v5h7V3M8 21v-6h8v6"/>',cursor:'<path d="M5 3l5.5 15 2.2-6.3L19 9.5z"/>',layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',plus:'<path d="M12 5v14M5 12h14"/>'};
  const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
  brand.innerHTML=`<div class="studio-doc-heading"><strong id="builder-document-name">문서 불러오는 중</strong><div class="ai-breadcrumb">AI Studio<i aria-hidden="true">›</i><b>${PROFILE.title}</b></div></div>`;
  const headerActions=header.querySelector('.header-actions'), legacyActions=[...headerActions.children], historyToolbar=header.querySelector('.history-toolbar');
  headerActions.innerHTML=`<span class="studio-save-status" id="studio-save-status" data-tone="ok"><span class="studio-save-icon">${icon('cloud')}</span><span class="builder-save-state" id="builder-save-state">저장됨</span></span>`+(PROFILE.designer?'<button id="studio-assistant-toggle" class="studio-secondary-button" type="button" data-action="ai-assistant" aria-pressed="false"><span class="studio-spark" aria-hidden="true">✦</span> AI 도우미</button><button id="studio-preview" class="studio-secondary-button" type="button" data-action="preview" aria-pressed="false">미리보기</button>':'')+`<button id="builder-save" class="studio-primary-button">${icon('save')}저장</button>`;
  headerActions.prepend(historyToolbar);
  $('history-undo').innerHTML=icon('undo'); $('history-redo').innerHTML=icon('redo');
  $('history-undo').setAttribute('aria-label','실행 취소'); $('history-redo').setAttribute('aria-label','다시 실행');

  // ---- Right panel: 채팅 | 직접 편집 | 데이터 연결 --------------------------------------------------
  const aside=document.querySelector('main > aside'), legacySections=[...aside.children];
  const tabs=element('div',{class:'builder-tabs',role:'tablist'}), direct=element('div',{class:'builder-panel builder-direct',role:'tabpanel'}), bindingPanel=element('div',{class:'builder-panel builder-data',role:'tabpanel'}), ai=element('div',{class:'builder-panel builder-chat',role:'tabpanel'});
  const panels=PROFILE.assistant?{direct,binding:bindingPanel}:{ai,direct,binding:bindingPanel};
  for (const [key,label] of PROFILE.tabs) { const tab=button(label,()=>selectTab(key),{class:'builder-tab',role:'tab','data-tab':key,'aria-selected':String(key==='ai')}); tabs.append(tab); }
  // The legacy editor stays mounted (hidden): its inputs, change set and history bridge remain the single write path.
  const legacy=element('div',{class:'builder-legacy',hidden:''}); legacy.append(...legacySections,...legacyActions);
  const inspector=element('div',{id:'builder-inspector'}); direct.append(inspector);
  bindingPanel.innerHTML='<div id="builder-binding-body"></div>';
  aside.replaceChildren(tabs,...(PROFILE.assistant?[]:[ai]),direct,bindingPanel,legacy);
  // AI 도우미 drawer (developer): opens beside the 속성/데이터 panel and never replaces it or changes the edit mode.
  const assistant=element('section',{class:'studio-assistant',role:'complementary','aria-label':'AI 도우미',hidden:''});
  if (PROFILE.assistant) {
    const head=element('div',{class:'studio-assistant-head'}),title=element('div');title.append(element('strong',{},'AI 도우미'),element('small',{},'AI 연결 전에는 요청 내용만 기록됩니다.'));
    head.append(title,button('×',()=>toggleAssistant(false),{class:'studio-assistant-close','aria-label':'AI 도우미 닫기'}));
    ai.hidden=false; assistant.append(head,ai); document.querySelector('main').append(assistant);
  }
  function toggleAssistant(open=assistant.hidden){ assistant.hidden=!open; $('studio-assistant-toggle')?.setAttribute('aria-pressed',String(open)); if(open) setTimeout(()=>ai.querySelector('.ai-composer input')?.focus(),0); }
  $('studio-assistant-toggle')?.addEventListener('click',()=>toggleAssistant());
  // 미리보기: the same Viewer and UBJF without designer overlays or editing; the panel returns with the previous tab.
  let previewing=false,currentTab=PROFILE.defaultTab;
  function setPreview(on){
    previewing=Boolean(on); document.body.classList.toggle('studio-preview',previewing);
    const toggle=$('studio-preview'); if(toggle){toggle.setAttribute('aria-pressed',String(previewing)); toggle.textContent=previewing?'편집으로 돌아가기':'미리보기';}
    if (previewing) { clearViewerSelection({forget:true}); toggleAssistant(false); MvpWorkspaceMode.set('preview'); }
    else selectTab(currentTab);
  }
  $('studio-preview')?.addEventListener('click',()=>setPreview(!previewing));
  // Designer tools beside the canvas: only what the engine supports is active.
  if (PROFILE.designer) {
    const tools=element('div',{class:'studio-tools',role:'toolbar','aria-label':'디자이너 도구'});
    tools.append(button('',()=>{},{class:'studio-tool','aria-label':'선택',title:'선택','aria-pressed':'true','data-tool':'select'}));
    const bandsTool=button('',()=>{const next=!window.MvpDesignerBands?.visible;window.MvpDesignerBands?.setVisible(next);bandsTool.setAttribute('aria-pressed',String(next))},{class:'studio-tool','aria-label':'밴드 보기',title:'밴드 보기','aria-pressed':'true','data-tool':'bands'});
    const add=button('',()=>{},{class:'studio-tool','aria-label':'추가 (준비 중)',title:'텍스트·이미지·표 추가는 준비 중입니다.','data-tool':'add'});add.disabled=true;
    tools.firstChild.innerHTML=icon('cursor');bandsTool.innerHTML=icon('layers');add.innerHTML=icon('plus');
    tools.append(bandsTool,element('span',{class:'studio-tool-divider','aria-hidden':'true'}),add);
    (document.querySelector('main > section')||document.querySelector('main')).append(tools);
    window.addEventListener('studio-bands-loaded',event=>{const has=Boolean(event.detail?.bands?.length);bandsTool.disabled=!has;bandsTool.title=has?'밴드 보기':'이 문서는 밴드 없이 자유 배치된 서식입니다.';if(!state.selection&&!state.staticSelection)renderInspector()});
  }
  const errorBox=element('div',{id:'builder-error',class:'builder-error',role:'alert',hidden:''}); document.body.append(errorBox);

  function selectTab(key) {
    if (!PROFILE.tabs.some(([name])=>name===key)) return;
    if (previewing) { previewing=false; document.body.classList.remove('studio-preview'); const toggle=$('studio-preview'); if(toggle){toggle.setAttribute('aria-pressed','false');toggle.textContent='미리보기';} }
    currentTab=key;
    for (const [name,panel] of Object.entries(panels)) panel.hidden=name!==key;
    tabs.querySelectorAll('[role=tab]').forEach(tab=>tab.setAttribute('aria-selected',String(tab.dataset.tab===key)));
    // The tab decides the workspace mode; only 직접 편집 enables Viewer editing interaction.
    MvpWorkspaceMode.set({ai:'chat',direct:'direct-edit',binding:'data-binding'}[key]);
    if (key==='binding') renderData().catch(showError);
  }
  function setSaveState(text,bad=false) { const node=$('builder-save-state'); node.textContent=text; node.classList.toggle('bad',bad); $('studio-save-status').dataset.tone=bad?'bad':/중$/.test(text)?'busy':/안 됨/.test(text)?'dirty':'ok'; }
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
  ai.innerHTML='<div class="chat-workspace"><div id="chat-conversation" class="chat-conversation" role="log" aria-live="polite"></div><form class="ai-composer"><button class="attach" type="button" aria-label="데이터 연결 열기" title="데이터 연결">＋</button><input aria-label="서식 수정 요청" placeholder="서식 수정 요청을 입력하세요"><button class="chat-send" type="submit" disabled aria-label="전송">전송</button></form><p class="chat-hint"></p></div>';
  const chatInput=ai.querySelector('.ai-composer input'), chatSend=ai.querySelector('.chat-send'), conversation=$('chat-conversation');
  const SUGGESTIONS=PROFILE.suggestions;
  chatInput.placeholder=PROFILE.placeholder; ai.querySelector('.chat-hint').textContent=PROFILE.hint;
  if (PROFILE.quickEdit) {
    const quick=element('section',{class:'quick-edit','aria-label':'직접 편집'}),grid=element('div',{class:'quick-edit-grid'});
    for (const [label,name] of [['텍스트 수정','text'],['이미지 교체','image'],['보이기/숨기기','eye'],['이동 / 크기','move']]) grid.append(button(label,()=>selectTab('direct'),{'data-icon':name}));
    quick.append(element('h3',{},'직접 편집으로 빠르게 수정하기'),element('p',{},'선택한 요소를 직접 수정할 수 있어요.'),grid);
    ai.append(element('div',{class:'chat-or'},'또는'),quick);
  }
  // ChatProvider adapter: a provider receives the message plus the shared Builder state and returns {reply}.
  let chatProvider=null;
  const time=()=>new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'});
  function bubble(kind,...content){ const row=element('div',{class:`chat-row ${kind}`}); if(kind==='assistant')row.append(element('span',{class:'chat-avatar','aria-hidden':'true'},'AI')); const node=element('div',{class:`chat-message ${kind}`}); for(const part of content)node.append(typeof part==='string'?element('p',{},part):part); node.append(element('time',{},time())); row.append(node); conversation.append(row); conversation.scrollTop=conversation.scrollHeight; return node; }
  // First AI message: greeting with the current document and compact suggestion chips (they only fill the composer).
  function greet(){ conversation.replaceChildren(); const chips=element('div',{class:'chat-suggestions'}); for (const [label,[prompt,name]] of Object.entries(SUGGESTIONS)) chips.append(button(label,()=>{chatInput.value=prompt;chatInput.dispatchEvent(new Event('input'));chatInput.focus()},{'data-icon':name})); const doc=element('b',{id:'chat-document-name'},state.document?.title||'현재 문서'); const docLine=element('p'); docLine.append('현재 "',doc,'" 문서를 보고 있습니다.'); const hello=element('p');hello.append('안녕하세요!',element('br'),'무엇을 도와드릴까요?'); bubble('assistant',hello,PROFILE.intro,docLine,element('small',{class:'chat-suggestions-title'},'추천 작업'),chips).parentElement.classList.add('chat-intro'); }
  chatInput.oninput=()=>{chatSend.disabled=!chatInput.value.trim()};
  ai.querySelector('.attach').onclick=()=>{selectTab('binding')};
  if (!PROFILE.dataAttach) ai.querySelector('.attach').remove();
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
  function emptyState(title,help){const node=element('div',{class:'inspector-empty'},title);if(help)node.append(element('small',{},help));return node}
  function quickGuide(){const list=element('ul',{class:'quick-guide','aria-label':'편집할 수 있는 항목'});for(const [label,help,name] of [['텍스트 수정','문구·글자 크기·정렬','text'],['이미지 교체','새 이미지로 바꾸기','image'],['보이기/숨기기','요소 표시 여부','eye'],['이동 / 크기','위치와 크기 조정','move']]){const item=element('li',{'data-icon':name}),text=element('span');text.append(element('b',{},label),element('small',{},help));item.append(text);list.append(item)}return list}
  function selectedCard(icon,type,name){const card=element('div',{class:'selected-element'});card.append(element('span',{},icon));const text=element('div');text.append(element('small',{},type),element('strong',{},name||'-'));card.append(text);return card}

  // Table selection mode (셀/행/열) for imported tables. Only the editor of the current selection type is shown.
  let tableMode='cell';
  const hasTables=()=>PROFILE.tableModes&&Boolean(window.__mvp12?.tables?.length);
  const MODE_EMPTY={cell:'표에서 편집할 셀을 선택하세요.',row:'표에서 편집할 행을 선택하세요.',column:'표에서 편집할 열을 선택하세요.'};
  function modeSwitch(){return segmented([['cell','셀'],['row','행'],['column','열']],tableMode,setTableMode,{class:'segmented table-mode','aria-label':'표 선택 방식','data-control':'table-mode'})}
  // Single active selection: every transition clears all selection layers first - the object/cell selection and its
  // text toolbar and Fabric handles (Viewer inspector), the row/column band (table controller) and the panel state.
  function clearViewerSelection({forget=false,keepBand=false}={}){
    window.dispatchEvent(new CustomEvent('mvp:clear-object-selection'));
    window.__mvp12?.clearSelection?.(forget);
    if(!keepBand){window.MvpDesignerBands?.clear?.();state.bandSelection=null;}
    state.selection=null;state.source=null;state.staticSelection=null;
  }
  // Focus-out keeps the current 셀/행/열 mode and shows that mode's empty state.
  function clearDirectSelection(){clearViewerSelection({forget:true});renderInspector()}
  function setTableMode(next){
    if(next===tableMode)return;
    const seed=window.__mvp12?.lastCell;
    clearViewerSelection();
    tableMode=window.__mvp12?.setMode?.(next)||next;
    // The last selected cell seeds the row/column of the new mode; 셀 mode starts without a selection.
    const t=tableMode!=='cell'&&seed&&window.__mvp12?.tables?.find(x=>x.tableKey===seed.tableKey);
    if(t){if(tableMode==='row')window.__mvp12.selectRow(seed.rowIndex,t.tableKey);else window.__mvp12.selectColumn(seed.columnIndex,t.tableKey);return}
    renderInspector();
  }
  function renderInspector(){
    inspector.replaceChildren();
    const selection=state.selection, source=state.source;
    const kind=source?.sourceClassName, isCell=Boolean(selection&&source&&(kind==='Cell'||/^IMPCL/.test(selection.sourceObjectId||'')));
    if (PROFILE.designer && state.bandSelection && !selection && !state.staticSelection) return renderBand(state.bandSelection);
    if (hasTables()) inspector.append(modeSwitch());
    if (state.staticSelection && !selection) return renderStructureOnly();
    if (!selection || !source) { inspector.append(emptyState(hasTables()?MODE_EMPTY[tableMode]:PROFILE.empty,PROFILE.emptyHelp)); if (PROFILE.designer) inspector.append(documentSections()); else inspector.append(quickGuide()); return; }
    const [icon,type]=TYPE[kind]||['◻','요소'], isImage=kind==='UBImage';
    const cellInfo=isCell?window.__mvp12?.selectCell?.(selection.sourceObjectId):null;
    // Internal identifiers stay in 고급 설정; the card shows what the user sees.
    const name=isImage?(PROFILE.designer?'이미지':'문서 이미지'):(current('text')||selection.currentText||'').trim()||PROFILE.cellLabel;
    inspector.append(selectedCard(cellInfo&&!PROFILE.tableModes?'T':icon,cellInfo?PROFILE.cellLabel:type,name));
    if (isImage) inspector.append(...imageSections());
    else if (cellInfo) inspector.append(...cellSections(),...(PROFILE.designer?[tableSection(cellInfo)]:[]));
    else inspector.append(...(PROFILE.designer?designerTextSections():textSections()));
    if (supports('visible')) inspector.append(section('표시',toggle(isImage?'이미지 표시':'표시',current('visible')!==false,value=>setProperty('visible',value),{'data-control':'visible'})));
    const reset=button('이 요소의 변경 되돌리기',()=>mvpDirectBridge.action('resetAll').then(renderInspector),{class:'link-button'});
    // Source identifiers are developer information; the user screen keeps only the reset action.
    if (!PROFILE.advanced) { inspector.append(reset); return; }
    const advanced=element('details',{class:'inspector-advanced'});advanced.append(element('summary',{},'고급 설정'),element('p',{},`원본 ID ${selection.sourceObjectId} · ${source.positionConfidence||''}`),reset);
    inspector.append(advanced);
  }
  function cellSections(){
    const node=section(PROFILE.cellSection);
    if (supports('text')) {
      const area=element('textarea',{rows:'2','aria-label':'내용','data-key':'text'});area.value=current('text')??'';
      area.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();area.blur()}};
      area.onchange=()=>setProperty('text',area.value);
      node.append(element('label',{class:'inspector-label'},'내용'),area);
    }
    if (supports('fontSize')) node.append(numberField('글자 크기','fontSize',{min:6,max:96}));
    const toolbar=element('div',{class:'text-tools'});
    if (supports('fontWeight')) toolbar.append(button('B',()=>setProperty('fontWeight',current('fontWeight')==='bold'?'normal':'bold'),{class:'bold-toggle','aria-pressed':String(current('fontWeight')==='bold'),'aria-label':'굵게'}));
    if (supports('textAlign')) toolbar.append(segmented([['left','왼쪽'],['center','가운데'],['right','오른쪽']],current('textAlign'),value=>setProperty('textAlign',value),{'aria-label':'가로 정렬'}));
    if (toolbar.children.length) node.append(toolbar);
    return [node];
  }
  // ---- Designer property cards (developer) -------------------------------------------------------------
  // Text: 텍스트 / 글꼴 / 위치 및 크기 (collapsed); visibility and advanced settings follow in renderInspector.
  function designerTextSections(){
    const nodes=[];
    if (supports('text')) { const area=element('textarea',{rows:'2','aria-label':'문구','data-key':'text'});area.value=current('text')??'';area.onkeydown=event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();area.blur()}};area.onchange=()=>setProperty('text',area.value);nodes.push(section('텍스트',area)); }
    const font=[]; if (supports('fontSize')) font.push(numberField('글꼴 크기','fontSize',{min:6,max:96}));
    const toolbar=element('div',{class:'text-tools'});
    if (supports('fontWeight')) toolbar.append(button('B',()=>setProperty('fontWeight',current('fontWeight')==='bold'?'normal':'bold'),{class:'bold-toggle','aria-pressed':String(current('fontWeight')==='bold'),'aria-label':'굵게'}));
    if (supports('textAlign')) toolbar.append(segmented([['left','왼쪽'],['center','가운데'],['right','오른쪽']],current('textAlign'),value=>setProperty('textAlign',value),{'aria-label':'가로 정렬'}));
    if (toolbar.children.length) font.push(toolbar);
    if (font.length) nodes.push(section('글꼴',...font));
    const geometry=element('div',{class:'field-grid'});
    if (supports('width')) geometry.append(numberField('너비','width')); if (supports('height')) geometry.append(numberField('높이','height'));
    if (supports('left')) geometry.append(numberField('X','left',{min:0,max:2000})); if (supports('top')) geometry.append(numberField('Y','top',{min:0,max:3000}));
    if (geometry.children.length) { const more=element('details',{class:'inspector-collapsible','data-section':'geometry'});more.append(element('summary',{},'위치 및 크기'),geometry);nodes.push(more); }
    return nodes;
  }
  // Table: the table the cell belongs to, and the way into its row/column editors (Direct Edit 3.2 structure tools).
  function tableSection(info){
    const node=section('표'),layout=window.__mvp12?.layouts?.[info.table.sourceTableId]||info.table;
    node.classList.add('table-section');
    node.append(element('p',{class:'structure-meta'},`행 ${info.rowCount} · 열 ${info.columnCount}${info.table.merged?' · 병합 셀 포함':''}`));
    const actions=element('div',{class:'structure-actions'});
    actions.append(button('이 행 편집',()=>setTableMode('row'),{'data-action':'cell-to-row'}),button('이 열 편집',()=>setTableMode('column'),{'data-action':'cell-to-column'}));
    const geometry=element('details',{class:'inspector-collapsible','data-section':'table-geometry'});
    geometry.append(element('summary',{},'표 위치 및 크기'),element('p',{class:'structure-meta'},`X ${Math.round(layout.x)} · Y ${Math.round(layout.y)} · ${Math.round(layout.width)} × ${Math.round(layout.height)}`));
    node.append(actions,element('p',{class:'structure-hint'},'행·열 단위로 이동, 크기, 숨김을 편집할 수 있습니다.'),geometry);
    return node;
  }
  // Nothing selected: the document and its structure (bands, or free form for imported documents).
  function documentSections(){
    const info=window.MvpDesignerBands?.info,tables=window.__mvp12?.tables||[],nodes=element('div',{class:'document-properties'});
    const page=info?.page||{width:794,height:1123};
    const summary=section('문서');summary.append(element('p',{class:'structure-meta'},`${state.document?.title||'문서'} · ${page.width} × ${page.height}`),element('p',{class:'structure-meta'},`표 ${tables.length}개${info?.datasets?.length?` · Dataset ${info.datasets.length}개`:''}`));
    const structure=section('구조');structure.dataset.section='bands';
    if (info?.bands?.length) { const list=element('div',{class:'band-list'});for(const band of info.bands){const item=button('',()=>window.MvpDesignerBands.select(band.id),{class:'band-list-item','data-band-id':band.id});item.append(element('b',{},band.label),element('small',{},band.dataSet?`${band.engine} · ${band.dataSet}`:band.engine));list.append(item)}structure.append(list); }
    else structure.append(element('p',{class:'structure-hint'},info?'밴드가 없는 자유 배치 서식입니다. 요소는 페이지 위의 절대 위치로 배치되어 있습니다.':'문서 구조를 불러오는 중입니다.'));
    nodes.append(summary,structure);return nodes;
  }
  // Band: human name first, engine name small; band settings are shown as they are (editing arrives later).
  function renderBand(band){
    inspector.append(selectedCard('▭',band.engine,band.label));
    const data=section('데이터'),rows=element('dl',{class:'property-list'});
    for (const [k,v] of [['Dataset',band.dataSet||'연결 없음'],['포함 항목',`${band.itemCount}개`]]) rows.append(element('dt',{},k),element('dd',{},v));
    data.append(rows,button('데이터 패널에서 연결',()=>selectTab('binding'),{class:'link-button','data-action':'band-to-data'}));
    const size=section('크기'),geometry=element('dl',{class:'property-list'});
    for (const [k,v] of [['높이',`${Math.round(band.height)}`],['위치 Y',`${Math.round(band.y)}`],['너비',`${Math.round(band.width)}`]]) geometry.append(element('dt',{},k),element('dd',{},v));
    size.append(geometry,element('p',{class:'structure-hint'},'밴드 설정 편집은 다음 단계에서 지원됩니다.'));
    const advanced=element('details',{class:'inspector-advanced'});advanced.append(element('summary',{},'고급 설정'),element('p',{},`${band.className} · ${band.id}`));
    inspector.append(data,size,advanced);
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
    if (image.length) { const media=section('이미지',...image); if (PROFILE.designer) nodes.unshift(media); else nodes.push(media); }
    return nodes;
  }

  // Table row/column editing for the selected cell's logical row and column (imported static tables).
  const saveStructure=async(operation,payload)=>{try{setSaveState('저장 중');await window.__mvp12.save(operation,payload);setSaveState('저장 안 됨');await window.__mvp58?.load?.()}catch(error){showError(error)}finally{renderInspector()}};
  function operationFor(operation,key){return (window.__mvp12?.operations||[]).filter(x=>x.operation===operation&&(x.logicalRowKey===key||x.logicalColumnKey===key)).at(-1)||null}
  async function removeOperation(op){try{await api(`/api/structure-operations/${op.operationId}?${new URLSearchParams(scope)}`,{method:'DELETE'});await window.__mvp12.loadOps();await window.__mvp58?.load?.();setSaveState('저장 안 됨')}catch(error){showError(error)}finally{renderInspector()}}
  const saveStructureBatch=async(items,label)=>{try{setSaveState('저장 중');await window.__mvp12.saveBatch(items,label);setSaveState('저장 안 됨');await window.__mvp58?.load?.()}catch(error){showError(error)}finally{renderInspector()}};
  // Auto-fit of one physical row/column, measured from the text of its cells.
  function fitRow(table,key){const objects=(table.rows.find(r=>r.logicalRowKey===key)?.viewerObjectIds||[]).map(id=>canvasObject(id)).filter(Boolean),ctx=document.createElement('canvas').getContext('2d');let need=12;for(const o of objects){const size=Number(o.fontSize||12);ctx.font=`${o.fontWeight||'normal'} ${size}px sans-serif`;const lines=String(o.text||'').split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(ctx.measureText(line).width/Math.max(1,Number(o.width)-6))),0);need=Math.max(need,Math.ceil(lines*size*1.35+6))}return Math.min(200,need)}
  function fitColumn(table,key){const objects=(table.columns.find(c=>c.logicalColumnKey===key)?.viewerObjectIds||[]).map(id=>canvasObject(id)).filter(o=>o&&(table.cells.find(c=>c.viewerObjectId===o.id)?.colSpan||1)===1),ctx=document.createElement('canvas').getContext('2d');let need=20;for(const o of objects){const size=Number(o.fontSize||12);ctx.font=`${o.fontWeight||'normal'} ${size}px sans-serif`;for(const line of String(o.text||'').split('\n'))need=Math.max(need,Math.ceil(ctx.measureText(line).width+12))}return Math.min(600,need)}
  const canvasObject=id=>$('viewer').contentWindow?.canvasModule?.getCanvas?.(0)?.getObjects?.().find(o=>o.id===id);
  const layoutOf=table=>window.__mvp12.layouts?.[table.sourceTableId]||{};
  function group(title,...children){const node=element('div',{class:'structure-group'});node.append(element('h4',{},title),...children);return node}
  function dangerZone(...children){const node=element('div',{class:'danger-zone'});node.append(element('h4',{},'위험 작업'),...children);return node}
  // Row/column editor for the current selection set (one physical track, a merged group, or several tracks).
  // One card with separate 이동 / 크기 / 표시 / 위험 작업 groups.
  function structureSection(detail,table){
    const row=detail.type==='ROW',noun=row?'행':'열',layout=layoutOf(table),keys=detail.keys||[detail.key],axis=row?{order:'rowOrder',sizes:'rowHeights',tracks:'rows',key:'logicalRowKey',index:'rowIndex'}:{order:'columnOrder',sizes:'columnWidths',tracks:'columns',key:'logicalColumnKey',index:'columnIndex'};
    const positions=keys.map(k=>layout[axis.order].indexOf(table[axis.tracks].find(t=>t[axis.key]===k)[axis.index])).sort((a,b)=>a-b),total=layout[axis.order].length,single=keys.length===1,contiguous=positions.every((p,i)=>!i||p===positions[i-1]+1);
    const node=section(`${noun} 편집`);node.classList.add('structure-section');node.dataset.structure=row?'row':'column';
    node.append(element('p',{class:'structure-meta'},single?`현재 ${noun}: ${positions[0]+1} / ${total}`:contiguous?`선택: ${positions[0]+1}–${positions.at(-1)+1}${noun} (${keys.length}개 ${noun}) / ${total}`:`선택: ${keys.length}개 ${noun} / ${total}`));
    // 이동: the selection moves past the neighbouring group; the same operation the drag handle commits.
    const prev=window.__mvp12.neighbour(-1),next=window.__mvp12.neighbour(1),columnIndexes=()=>keys.map(k=>table.columns.find(c=>c.logicalColumnKey===k).columnIndex);
    const moveTo=target=>row?saveStructure('moveRows',{logicalRowKey:keys[0],logicalRowKeys:keys,fromRowIndex:target.a,toRowIndex:target.to}):saveStructure('moveColumns',{logicalColumnKey:keys[0],columnIndexes:columnIndexes(),fromVisualIndex:target.a,toVisualIndex:target.to});
    const move=element('div',{class:'structure-actions'});
    move.append(button(row?'↑ 위로 이동':'← 왼쪽 이동',()=>moveTo(prev),{'data-action':row?'row-up':'column-left',...(prev?{}:{disabled:''})}),button(row?'↓ 아래로 이동':'오른쪽 이동 →',()=>moveTo(next),{'data-action':row?'row-down':'column-right',...(next?{}:{disabled:''})}));
    const moveNote=!contiguous?element('p',{class:'structure-note','data-note':'split'},`떨어져 있는 ${noun}은 함께 옮길 수 없습니다.`):element('p',{class:'structure-hint'},`${row?'⋮⋮':'⋯'} 손잡이를 끌어서 옮길 수도 있습니다.`);
    // 크기: every selected track gets the value, recorded as one history step.
    const sizeKey=row?'afterHeight':'afterWidth',operation=row?'resizeRow':'resizeColumn',apply=(values,label)=>single?saveStructure(operation,{[axis.key]:keys[0],[sizeKey]:values[0]}):saveStructureBatch(keys.map((k,i)=>({operation,[axis.key]:k,[sizeKey]:values[i]})),label);
    const size=numberField(row?'행 높이':'열 너비',row?'row-height':'column-width',{min:row?12:20,max:row?200:600,onChange:value=>apply(keys.map(()=>value),`${noun} ${keys.length}개 ${row?'높이':'너비'} 변경`)});
    size.querySelector('input').value=String(layout[axis.sizes]?.[positions[0]]??0);
    const fit=button('자동 맞춤',()=>apply(keys.map(k=>row?fitRow(table,k):fitColumn(table,k)),`${noun} ${keys.length}개 자동 맞춤`),{'data-action':row?'row-fit':'column-fit'});
    const groups=[group('이동',move,moveNote),group('크기',size,fit)];
    // 표시 / 위험 작업 act on exactly one physical track.
    const hidden=single?operationFor(row?'hideRow':'hideColumn',keys[0]):null;
    if(single)groups.push(group('표시',toggle(`${noun} 숨김`,Boolean(hidden),value=>value?saveStructure(row?'hideRow':'hideColumn',{[axis.key]:keys[0]}):removeOperation(hidden),{'data-control':row?'row-hide':'column-hide'})));
    else groups.push(group('표시',element('p',{class:'structure-hint'},`숨김은 ${noun} 하나를 선택했을 때 설정할 수 있습니다.`)));
    if(row&&single)groups.push(dangerZone(button('행 삭제',()=>{if(confirm('이 행을 삭제할까요? 실행 취소로 되돌릴 수 있습니다.'))saveStructure('removeRow',{logicalRowKey:keys[0]})},{class:'danger','data-action':'row-delete'})));
    node.append(...groups);
    return node;
  }
  // Row/column picked in 행/열 mode (no cell selected) - imported tables use the structure card;
  // the sample composite form keeps its verified legacy controls.
  function renderStructureOnly(){
    const detail=state.staticSelection, mvp12=window.__mvp12;
    if (mvp12?.tables && detail.tableKey) {
      const table=mvp12.tables.find(t=>t.tableKey===detail.tableKey);
      if (!['ROW','COLUMN'].includes(detail.type)) { inspector.append(selectedCard('▤','표','표'),element('p',{class:'structure-meta'},'행이나 셀을 선택하면 행·열을 편집할 수 있습니다.')); return; }
      // Positions come from the current layout (the selection keys are stable across moves).
      const noun=detail.type==='ROW'?'행':'열',positions=(detail.keys||[detail.key]).map(k=>(detail.type==='ROW'?mvp12.rowPosition(k):mvp12.columnPosition(k))+1).sort((a,b)=>a-b),contiguous=positions.every((p,i)=>!i||p===positions[i-1]+1),name=positions.length<=1?`${positions[0]}번째 ${noun}`:contiguous?`${positions[0]}–${positions.at(-1)}번째 ${noun}`:`${positions.length}개 ${noun}`;
      inspector.append(selectedCard(detail.type==='COLUMN'?'↕':'▦',detail.type==='COLUMN'?'표 열':'표 행',name),structureSection(detail,table));
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

  window.addEventListener('studio-band-selected',event=>{
    if (!PROFILE.designer) return;
    clearViewerSelection({keepBand:true}); state.bandSelection=event.detail?.band||null; renderInspector();
  });
  window.addEventListener('mysuit-object-selection-resolved',event=>{
    const {render,source}=event.detail;
    if (state.bandSelection) { window.MvpDesignerBands?.clear?.(); state.bandSelection=null; }
    if (state.staticSelection) window.__mvp12?.clearSelection?.();
    state.selection=render; state.source=source; state.staticSelection=null; state.bindingTarget=render.sourceObjectId;
    renderInspector(); renderDataIfVisible();
    window.dispatchEvent(new CustomEvent('ai-builder:selection-changed',{detail:{type:'selectionChanged',targetType:source.targetType||source.sourceClassName,sourceId:source.templateSourceId||source.sourceObjectId,runtimeId:render.viewerObjectId,runtimeInstanceKey:render.renderInstanceKey,rowIndex:render.rowIndex,bandId:render.bandId,page:render.pageIndex||0}}));
  });
  window.addEventListener('mysuit-static-selection',event=>{
    if (event.detail && state.bandSelection) { window.MvpDesignerBands?.clear?.(); state.bandSelection=null; }
    state.selection=null; state.source=null; state.staticSelection=event.detail; renderInspector();
    if (!event.detail) return;
    window.dispatchEvent(new CustomEvent('ai-builder:selection-changed',{detail:{type:'selectionChanged',targetType:event.detail.type,sourceId:event.detail.key,page:0}}));
  });
  window.addEventListener('mvp:target-selected',event=>{const type=event.detail.targetType==='LOGICAL_ROW'?'ROW':event.detail.targetType==='LOGICAL_COLUMN'?'COLUMN':null;if(type)window.dispatchEvent(new CustomEvent('mysuit-static-selection',{detail:{type,key:event.detail.targetKey,count:1,ids:[]}}))});
  window.addEventListener('mvp:clear-object-selection',()=>setTimeout(()=>{if(/^[-\u2014]?$/.test($('source-id')?.textContent.trim()||'')){state.selection=null;state.source=null;renderInspector()}}));
  // Leaving 직접 편집 drops the editing selection (Viewer overlays are cleared by their controllers).
  window.addEventListener('mvp:workspace-mode',event=>{if(!event.detail.leavingDirectEdit)return;state.selection=null;state.source=null;state.staticSelection=null;renderInspector()});
  window.addEventListener('mysuit-static-structure-changed',()=>setSaveState('저장 안 됨'));
  // A drop from the Viewer drag handle commits through the same structure save as the buttons.
  window.addEventListener('mysuit-static-drag-drop',event=>saveStructure(event.detail.operation,event.detail.payload));
  window.addEventListener('mvp:viewer-blank-click',()=>{if(window.MvpWorkspaceMode?.directEdit?.()!==false)clearDirectSelection()});
  // The imported table model loads after the first render; show the 셀/행/열 switch as soon as it is ready.
  window.addEventListener('mysuit-static-tables-ready',()=>{if(!state.selection&&!state.staticSelection)renderInspector()});
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
    const body=dataBody(); body.className=''; body.replaceChildren(element('h2',{class:'data-title'},PROFILE.designer?'데이터':'데이터 연결'));
    const objectId=state.bindingTarget;
    if (!objectId) { if (PROFILE.designer) body.append(datasetSection()); body.append(element('div',{class:'inspector-empty'},'문서에서 연결할 요소를 선택하세요.')); return; }
    const data=await api(`/api/ai-builder/context?${new URLSearchParams({...scope,objectId})}`);
    state.datasets=data.datasets||[]; state.currentBinding=data.binding||null;
    if (PROFILE.designer) body.append(datasetSection());
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
    const editor=element('div',{id:'workspace-json-editor',hidden:''}),area=element('textarea',{'aria-label':'JSON 직접 입력',spellcheck:'false',placeholder:'{\n  "name": "홍길동"\n}'}),use=button('데이터 사용',()=>registerJson(area.value,null,status).then(onRegistered,()=>{}),{class:'ai-primary','data-action':'json-use'});
    editor.append(area,use);
    actions.append(pick,button('JSON 직접 입력',()=>{editor.hidden=!editor.hidden;if(!editor.hidden)area.focus()},{id:'workspace-json-direct'}));
    file.onchange=async()=>{const chosen=file.files[0];if(!chosen)return;await registerJson(await chosen.text(),chosen.name,status).then(onRegistered,()=>{});file.value=''};
    box.append(actions,element('p',{class:'data-or'},''),editor,status);return box;
  }
  function renderDataEmpty(){
    const body=dataBody(); body.className=''; body.replaceChildren();
    const empty=element('section',{class:'data-empty'});
    empty.append(element('h2',{},PROFILE.designer?'데이터':'데이터 연결'),element('strong',{},'연결된 데이터가 없습니다.'),element('p',{},'JSON 데이터를 추가하면 문서 항목과 자동으로 연결할 수 있습니다.'),jsonInputs(()=>{}));
    body.append(empty);
    if (PROFILE.designer && window.MvpDesignerBands?.info?.datasets?.length) body.append(datasetSection());
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
  // Designer data overview: the datasets as a tree (JSON schema, or the form's own datasets) and the auto-binding entry.
  function datasetSection(){
    const node=element('section',{class:'dataset-tree','data-section':'datasets'});node.append(element('h3',{},'Datasets'));
    const schema=state.importContext?.jsonSchema||[],list=element('ul',{});
    if (schema.length) {
      for (const item of schema.filter(x=>x.path!=='$'&&!(x.isArrayItem&&!x.isLeaf)).slice(0,60)) {
        const depth=item.path.replace(/\[\]/g,'').split('.').length-2,li=element('li',{class:item.isLeaf?'leaf':`group${item.type==='array'?' array':''}`,'data-path':item.path});
        li.style.paddingLeft=`${depth*14}px`;li.append(element('span',{},item.isLeaf?item.key:`${item.key}${item.type==='array'?'[]':''}`));if(item.isLeaf)li.append(element('small',{},item.type));list.append(li);
      }
    } else {
      const datasets=window.MvpDesignerBands?.info?.datasets?.length?window.MvpDesignerBands.info.datasets:(state.datasets||[]).map(d=>({id:d.id,columns:d.columns}));
      for (const d of datasets) { const li=element('li',{class:'group'});li.append(element('span',{},d.name||d.id));list.append(li);for(const c of (d.columns||[]).slice(0,20)){const leaf=element('li',{class:'leaf'});leaf.style.paddingLeft='14px';leaf.append(element('span',{},c));list.append(leaf)} }
    }
    if (list.children.length) node.append(list); else node.append(element('p',{class:'structure-hint'},'연결된 데이터가 없습니다.'));
    return node;
  }
  // 자동 바인딩: applies the analyzer/proposal result as it stands (no LLM); the review below stays editable.
  function autoBindingBar(){
    const bar=element('div',{class:'auto-binding'}),rows=(state.bindingProposal?.proposals||[]).filter(x=>x.targetId);
    const run=button('자동 바인딩',applyProposals,{class:'ai-primary','data-action':'auto-binding'});run.disabled=!rows.some(x=>x.selectedPath);
    bar.append(run,element('small',{},`자동 ${state.bindingProposal?.summary?.auto||0}건 · 확인 필요 ${state.bindingProposal?.summary?.review||0}건`));
    return bar;
  }
  function renderProposalReview(){
    const body=dataBody(); body.className=''; body.replaceChildren(dataHeader(),...(PROFILE.designer?[datasetSection(),autoBindingBar()]:[]));
    const summary=state.bindingProposal?.summary||{}, stats=element('div',{class:'proposal-summary'});
    for (const [key,label] of [['auto','자동 연결'],['review','확인 필요'],['unbound','미연결']]) { const item=element('span',{'data-kind':key}); item.append(element('b',{},String(summary[key]||0)),document.createTextNode(` ${label}`)); stats.append(item); }
    body.append(stats,element('h3',{class:'binding-kind'},'단일 항목'));
    const list=element('div',{class:'proposal-list'}), rows=(state.bindingProposal?.proposals||[]).filter(x=>x.targetId);
    for (const row of rows) { const item=button('',()=>{state.selectedProposalTarget=row.targetId;renderProposalReview()},{class:`proposal-row status-${row.status.toLowerCase()}${row.targetId===state.selectedProposalTarget?' selected':''}`,'data-target-id':row.targetId}); item.append(element('span',{class:'proposal-label'},row.label||row.targetId),element('code',{},row.selectedPath?row.selectedPath.replace(/^\$\./,''):'-'),element('span',{class:'proposal-status'},`${row.selectedPath&&row.status!=='AUTO'?'✓ 연결':row.status==='AUTO'?'✓ 연결':statusLabel[row.status]||row.status}${Number.isFinite(row.confidence)&&row.confidence>0?` · ${Math.round(row.confidence*100)}%`:''}`)); list.append(item); }
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
    const actions=element('div',{class:'builder-actions'}), apply=button(state.bindingProposal?.appliedAt?'연결 다시 적용':'연결 적용',applyProposals,{class:'ai-primary','data-action':'binding-apply'});
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
      const apply=button(row.appliedAt?'반복 데이터 연결 다시 적용':'반복 데이터 연결 적용',()=>applyArrayProposal(row),{class:'ai-primary array-apply','data-action':'array-apply'});
      apply.disabled=row.columns.some(x=>!x.jsonPath||x.status==='UNBOUND'); card.append(apply); section.append(card);
    }
    body.append(section);
  }
  async function applyProposals(){try{setSaveState('연결 적용 중');const data=await api('/api/ai-builder/binding-proposals/apply',{method:'POST',body:JSON.stringify(scope)});state.bindingProposal.appliedAt=new Date().toISOString();state.savedPreview=data.previewUrl;$('viewer').src=state.savedPreview;setSaveState(`연결 ${data.appliedCount}건 적용됨`);await window.__mvp58?.load?.();renderProposalReview()}catch(error){showError(error)}}
  async function applyArrayProposal(row){try{setSaveState('반복 데이터 연결 중');const data=await api('/api/ai-builder/array-proposals/apply',{method:'POST',body:JSON.stringify({...scope,tableId:row.tableId})});row.appliedAt=new Date().toISOString();state.savedPreview=data.previewUrl;$('viewer').src=state.savedPreview;setSaveState(`반복 데이터 ${data.runtimeDetailRows}건 연결됨`);await window.__mvp58?.load?.();renderProposalReview()}catch(error){showError(error)}}

  // ---- Viewer chrome theme ---------------------------------------------------------------------------
  // The UView5 toolbar reads its accent from its own CSS variables (pink). Only that chrome is mapped to the Studio
  // accent; the document rendering (canvas) is untouched.
  function themeViewer(){
    const doc=$('viewer')?.contentDocument; if(!doc?.head||doc.getElementById('studio-viewer-chrome'))return;
    const css=getComputedStyle(document.documentElement),token=name=>css.getPropertyValue(name).trim(),primary=token('--studio-primary'),soft=`color-mix(in srgb, ${primary} 14%, transparent)`;
    const style=doc.createElement('style');style.id='studio-viewer-chrome';
    // Toolbar: white with a hairline; stage: the neutral workspace tone so the white page reads as a page.
    style.textContent=`:root{--viewer-btn-active:${soft};--font-point:${primary};--bg-point:${primary};--viewer-themeB-icon-point:${primary}}`+
      `#wrap{background-color:${token('--studio-canvas')}}`+
      `.edit-tool-wrap.pc-edit-tool-wrap{background-color:${token('--studio-surface')};border-bottom-color:${token('--studio-border')}}`+
      `.viewer .edit-tool-wrap .btn{border-radius:8px}`+
      `.viewer .edit-tool-wrap .btn:hover{background-color:color-mix(in srgb, ${primary} 8%, transparent)}`+
      `.bottom-panel .nav-tabs.tool-tabs>li.active>button::after{background-color:${primary}!important}`+
      `ul.color-select>li>button.active,ul.border-select>li>button.active{border-color:${primary}!important}`+
      `label.checkbox input[type="checkbox"]:focus-visible{outline-color:${primary}!important}`;
    doc.head.append(style);
  }
  $('viewer').addEventListener('load',themeViewer); window.addEventListener('mysuit-editor-attached',themeViewer); themeViewer();

  // ---- 저장 / 부팅 ---------------------------------------------------------------------------------
  $('builder-save').onclick=async()=>{ try { setSaveState('저장 중'); const data=await api('/api/ai-builder/save',{method:'POST',body:JSON.stringify(scope)}); state.savedPreview=data.previewUrl; $('viewer').src=state.savedPreview; setSaveState('저장 완료'); } catch (error) { showError(error); } };
  async function boot() {
    const data=await api(`/api/ai-builder/context?${new URLSearchParams(scope)}`);
    state.document=data.document; state.importContext=data.importContext; state.bindingProposal=state.importContext?.bindingProposal||null;
    $('builder-document-name').textContent=data.document.title; if($('chat-document-name'))$('chat-document-name').textContent=data.document.title;
    renderInspector();
  }
  // 사용자 편집 opens a real document: the one in the URL, else the last one opened in the Studio, else a choice of
  // recent documents. It never falls back to the built-in sample.
  async function chooseDocument(){
    $('viewer').src='about:blank';
    const pane=document.querySelector('main > section')||document.querySelector('main'),picker=element('div',{class:'studio-document-picker'});
    picker.append(element('h2',{},'편집할 문서를 선택하세요'),element('p',{},'최근에 만든 문서를 열거나 새 문서를 생성할 수 있습니다.'));
    const list=element('div',{class:'studio-document-list'});picker.append(list);pane.append(picker);
    try{const {documents}=await api('/api/ai-builder/recent?limit=8');for(const d of documents){const link=element('a',{class:'studio-document',href:`/ai-builder/user?${new URLSearchParams({projectName:d.projectName,layoutDraftId:d.draftId})}`});link.append(element('b',{},d.title||'문서'),element('small',{},new Date(d.createdAt).toLocaleString('ko-KR')));list.append(link)}if(!documents.length)list.append(element('p',{class:'studio-document-empty'},'아직 만든 문서가 없습니다.'))}catch(error){showError(error)}
    const create=element('a',{class:'studio-document-create',href:'/ai-builder/import'},'새 문서 만들기');picker.append(create);
    $('builder-document-name').textContent='문서 선택';
  }
  greet();
  selectTab(PROFILE.defaultTab);
  if (SURFACE==='user' && !params.get('projectName')) { const last=AiBuilderSidebar.lastQuery(); if (last) { location.replace(`/ai-builder/user${last}`); return; } chooseDocument(); }
  else boot().catch(showError);

  window.aiBuilder={surface:SURFACE,selectTab,openAssistant:()=>toggleAssistant(true),closeAssistant:()=>toggleAssistant(false),setPreview,get previewing(){return previewing},scope,state,builderState,get selectedObjectId(){return state.selection?.sourceObjectId||null},get savedPreview(){return state.savedPreview},get importContext(){return state.importContext},loadBinding:renderData,
    chat:{setProvider(provider){chatProvider=provider||null},get provider(){return chatProvider}},renderInspector,showError};
})();
