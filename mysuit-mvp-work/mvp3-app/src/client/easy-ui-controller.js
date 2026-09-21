(function(){
  const advanced=document.getElementById('advanced-toggle');
  const review=document.getElementById('review-toggle');
  const title=document.getElementById('context-title');
  const badge=document.getElementById('context-badge');
  const guideTitle=document.getElementById('guide-title');
  const guideMain=document.getElementById('guide-main');
  const modeCopy=document.getElementById('mode-copy');
  const targetClasses=['target-object','target-logical-column','target-logical-row','target-composite-table','target-static-table'];
  const targetCopy={
    OBJECT:['객체','문구와 모양 편집','더블클릭하면 문구를 바로 수정하고, 드래그하면 위치를 옮깁니다.'],
    LOGICAL_COLUMN:['열','열 순서와 너비 편집','주황 ↔ 손잡이는 순서 이동, 진한 경계 손잡이는 너비 조절입니다.'],
    LOGICAL_ROW:['행','행 순서와 높이 편집','왼쪽 파란 ↕ 손잡이를 위아래로 끌고 원하는 위치에서 놓으세요.'],
    COMPOSITE_TABLE:['데이터 표','본문 표 전체 편집','표 안쪽의 손잡이로 전체 위치와 너비를 조절합니다.'],
    STATIC_TABLE:['정적 표','결재 표 전체 선택','결재 표가 하나의 영역으로 선택되었습니다.']
  };
  function setAdvanced(enabled){
    document.body.classList.toggle('advanced-ui',enabled);
    advanced.setAttribute('aria-pressed',String(enabled));
    advanced.textContent=enabled?'고급 도구 닫기':'고급 도구';
    localStorage.setItem('mysuit:advanced-ui',String(enabled));
  }
  function setTarget(detail){
    document.body.classList.remove(...targetClasses);
    const copy=targetCopy[detail?.targetType];
    if(!copy){badge.textContent='선택 없음';title.textContent='편집할 대상을 선택하세요';return}
    document.body.classList.add(`target-${detail.targetType.toLowerCase().replaceAll('_','-')}`);
    badge.textContent=copy[0];title.textContent=copy[1];
    const help=document.getElementById('selection-help');help.textContent=copy[2];help.className='';
  }
  function syncMode(){
    const editing=review.getAttribute('aria-pressed')==='true';
    document.body.classList.toggle('review-active',editing);
    guideTitle.textContent=editing?'편집 모드':'보기 모드';
    guideMain.textContent=editing?'대상을 선택하고 손잡이를 끌어 놓으면 자동 저장됩니다.':'편집 시작을 누르면 원본은 보존한 채 수정 도구가 표시됩니다.';
    modeCopy.textContent=editing?'선택한 대상만 편집 · 놓으면 자동 저장':'원본 Viewer · 편집 내용 미적용';
    if(!editing)setTarget(null);
  }
  advanced.addEventListener('click',()=>setAdvanced(!document.body.classList.contains('advanced-ui')));
  review.addEventListener('click',()=>requestAnimationFrame(syncMode));
  window.addEventListener('mvp:target-selected',event=>setTarget(event.detail));
  window.addEventListener('mvp:static-table-selected',event=>setTarget(event.detail));
  window.addEventListener('mvp:clear-object-selection',()=>{});
  document.getElementById('changes-tab').addEventListener('click',()=>document.body.classList.add('changes-view'));
  document.getElementById('original-tab').addEventListener('click',()=>document.body.classList.remove('changes-view'));
  document.getElementById('candidate-tab').addEventListener('click',()=>document.body.classList.remove('changes-view'));
  const viewerId=document.getElementById('viewer-id');
  new MutationObserver(()=>{const id=viewerId.textContent.trim();if(id&&id!=='—')setTarget({targetType:'OBJECT'})}).observe(viewerId,{childList:true,characterData:true,subtree:true});
  setAdvanced(localStorage.getItem('mysuit:advanced-ui')==='true');syncMode();setTarget(null);
})();
