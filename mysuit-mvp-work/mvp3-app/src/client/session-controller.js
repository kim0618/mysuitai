(function(){
  const params=new URLSearchParams(location.search);
  const explicit=params.get('layoutDraftId');
  if(explicit&&explicit!=='layout_sample_default'){window.__mysuitSession={draftId:explicit,implicit:false};return}
  const key='mysuit:active-layout-draft';
  let draft=sessionStorage.getItem(key);
  if(!/^layout_session_[A-Za-z0-9_-]{8,64}$/.test(draft||'')){
    const token=(crypto.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2)}`).replaceAll('-','_');
    draft=`layout_session_${token}`;
    sessionStorage.setItem(key,draft);
  }
  params.set('layoutDraftId',draft);
  history.replaceState(null,'',`${location.pathname}?${params}${location.hash}`);
  window.__mysuitSession={draftId:draft,implicit:true};
})();
