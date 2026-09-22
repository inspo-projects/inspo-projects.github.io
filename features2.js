function move(n){const a=boardList();if(!a.length)return;idx=(idx+n+a.length)%a.length;renderSwipe();const active=$('.thumb.on');if(active)active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})}
$('#prev').onclick=()=>move(-1);$('#next').onclick=()=>move(1);$('#backHome').onclick=()=>{currentId=null;renderHome();window.scrollTo(0,0)};
$('#swipeViewBtn').onclick=()=>{viewMode='swipe';renderBoard()};$('#gridViewBtn').onclick=()=>{viewMode='grid';renderBoard()};
$('#heart').onclick=()=>{const x=boardList()[idx];if(x)toggleSavedItem(x)};
$('#itemMore').onclick=()=>{const x=boardList()[idx];if(x)openFindModal(x.id)};$('#editBoard').onclick=()=>openBoardModal(currentId);$('#addFind').onclick=()=>openFindModal(null);
$$('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));$$('.overlay').forEach(o=>o.onclick=e=>{if(e.target===o)closeModal(o.id)});
function openModal(id){$('#'+id).classList.add('show')}function closeModal(id){$('#'+id).classList.remove('show')}
function openBoardModal(id=null){
  editBoardId=id; const p=id?projects.find(x=>x.id===id):null; boardTypeChoice=p?.type||'inspo';
  $('#boardModalTitle').textContent=p?'Edit board':'New board';$('#boardIcon').value=p?.icon||'';$('#boardName').value=p?.title||'';$('#boardNote').value=p?.subtitle||'';$('#saveBoard').textContent=p?'Save changes':'Create board';$('#saveBoard').disabled=false;$('#deleteBoard').hidden=!p;if($('#boardStatus'))$('#boardStatus').textContent='';syncTypeButtons();openModal('boardModal');setTimeout(()=>$('#boardName').focus(),120)
}
function syncTypeButtons(){$('#typeInspo').classList.toggle('on',boardTypeChoice==='inspo');$('#typeProject').classList.toggle('on',boardTypeChoice==='project')}
$('#typeInspo').onclick=()=>{boardTypeChoice='inspo';syncTypeButtons()};$('#typeProject').onclick=()=>{boardTypeChoice='project';syncTypeButtons()};$('#newBoard').onclick=()=>openBoardModal(null);
$('#saveBoard').onclick=async()=>{
  const title=$('#boardName').value.trim();if(!title){toast('Give the board a name first');return}
  const btn=$('#saveBoard'),status=$('#boardStatus');
  btn.disabled=true;btn.textContent=editBoardId?'Saving…':'Creating…';if(status)status.textContent='';
  try{
    if(editBoardId){
      const p=projects.find(x=>x.id===editBoardId);if(!p)return;
      p.type=boardTypeChoice;p.icon=$('#boardIcon').value.trim()||'✦';p.title=title;p.subtitle=$('#boardNote').value.trim();p.updated=now();
      persist();
      if(window.inspoCloudApi?.sync)await window.inspoCloudApi.sync();
      closeModal('boardModal');if(currentId)openBoard(currentId);else renderHome();toast('Board updated');
    }else{
      const p={id:crypto.randomUUID(),type:boardTypeChoice,icon:$('#boardIcon').value.trim()||'✦',title,subtitle:$('#boardNote').value.trim(),created:now(),updated:now(),items:[],saved:[],_role:'owner',_cloud:false};
      if(window.inspoCloudApi?.getUser?.())p._ownerId=window.inspoCloudApi.getUser().id;
      projects.push(p);currentId=p.id;persist();
      try{
        if(window.inspoCloudApi?.createBoard)await window.inspoCloudApi.createBoard(p);
        else if(window.inspoCloudApi?.sync)await window.inspoCloudApi.sync();
      }catch(e){
        projects=projects.filter(x=>x.id!==p.id);currentId=null;persist();
        throw e;
      }
      closeModal('boardModal');openBoard(p.id);toast('Board created');
    }
  }catch(e){
    console.warn('Board save',e);
    if(status)status.textContent=e?.message||'Could not create the board. Please try again.';
    else toast('Could not create board');
  }finally{
    btn.disabled=false;btn.textContent=editBoardId?'Save changes':'Create board';
  }
};
$('#deleteBoard').onclick=async()=>{
  const p=projects.find(x=>x.id===editBoardId);if(!p)return;
  if(!confirm(`Delete “${p.title}”? This will remove the board and its finds.`))return;
  const btn=$('#deleteBoard');btn.disabled=true;btn.textContent='Deleting…';
  try{
    if(window.inspoCloudApi?.deleteBoard&&p._cloud)await window.inspoCloudApi.deleteBoard(p.id);
    projects=projects.filter(x=>x.id!==p.id);
    saveLocal();
    closeModal('boardModal');
    if(currentId===p.id)currentId=null;
    renderHome();toast('Board deleted');
  }catch(e){
    console.warn('Board delete',e);toast('Could not delete board');
  }finally{btn.disabled=false;btn.textContent='Delete board'}
};
