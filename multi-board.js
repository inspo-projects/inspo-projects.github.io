(()=>{
  const originalOpen=window.openFindModal;
  const saveBtn=document.getElementById('saveFind');
  const originalSave=saveBtn?.onclick;
  if(typeof originalOpen!=='function'||!saveBtn)return;

  function ensureBoardPicker(){
    let wrap=document.getElementById('addBoardsWrap');
    if(wrap)return wrap;
    const move=document.getElementById('moveFindWrap');
    wrap=document.createElement('div');
    wrap.id='addBoardsWrap';wrap.className='field multi-board-field';
    wrap.innerHTML='<label>Add to one or more boards</label><div id="addBoardsList" class="board-multi-list"></div><div class="hintline">Choose every board you want this find saved to.</div>';
    move.parentNode.insertBefore(wrap,move);
    return wrap;
  }
  function fillPicker(){
    const wrap=ensureBoardPicker(),list=document.getElementById('addBoardsList');
    list.innerHTML='';
    (projects||[]).filter(p=>p._role!=='viewer').forEach(p=>{
      const label=document.createElement('label');label.className='board-multi-option';
      const input=document.createElement('input');input.type='checkbox';input.name='addBoard';input.value=p.id;input.checked=p.id===currentId;
      const span=document.createElement('span');span.textContent=(p.icon?p.icon+' ':'')+p.title;
      label.append(input,span);list.appendChild(label);
    });
    wrap.hidden=!!editItemId;
  }

  window.openFindModal=function(id=null){
    originalOpen(id);
    fillPicker();
  };

  saveBtn.onclick=async function(e){
    if(editItemId&&typeof originalSave==='function')return originalSave.call(this,e);

    const base=current();if(!base)return;
    const selected=Array.from(document.querySelectorAll('input[name="addBoard"]:checked')).map(el=>el.value);
    const targets=(projects||[]).filter(p=>selected.includes(p.id)&&p._role!=='viewer');
    if(!targets.length){document.getElementById('findStatus').textContent='Choose at least one board.';return}

    let url=document.getElementById('findUrl').value.trim(),title=document.getElementById('findName').value.trim(),image=document.getElementById('findImage').value.trim(),tag=document.getElementById('findTag').value.trim(),price=document.getElementById('findPrice').value.trim(),size=document.getElementById('findSize').value.trim(),reviews=document.getElementById('findReviews').value.trim(),condition=document.getElementById('findCondition').value.trim(),source='',detailsChecked=0;
    const status=document.getElementById('findStatus');

    if(url){url=safeHttpUrl(url);if(!url){status.textContent='Use a normal http or https source link.';return}}
    if(image){image=safeImageUrl(image);if(!image){status.textContent='Use a normal http or https photo URL.';return}}
    if(!url&&!image){status.textContent='Add a source link or a photo URL.';return}

    saveBtn.disabled=true;saveBtn.textContent='Adding…';status.textContent='';

    if(url&&(!title||!image||!price||!size||!reviews||!condition)){
      try{
        const d=await previewDetails(url);
        if(d.resolvedUrl&&safeHttpUrl(d.resolvedUrl))url=d.resolvedUrl;
        if(!title)title=d.title||'';
        if(!image)image=d.image||'';
        source=sourceName(url,d.source);
        if(!price)price=d.price||'';
        if(!size)size=d.size||'';
        if(!reviews)reviews=d.reviews||'';
        if(!condition)condition=d.condition||'';
        detailsChecked=Date.now();
      }catch{
        try{
          const d=await preview(url);
          if(!title)title=d.title||'';
          if(!image)image=d.image||'';
          source=sourceName(url,d.source);
          const det=parseDetails([d.title,d.description].filter(Boolean).join(' '));
          if(!price)price=det.price||'';
          if(!size)size=det.size||'';
          if(!reviews)reviews=det.reviews||'';
          if(!condition)condition=det.condition||'';
          detailsChecked=Date.now();
        }catch{}
      }
    }
    source=source||sourceName(url);title=title||source+' find';

    let added=0,skipped=0,failed=0;
    const user=window.inspoCloudApi?.getUser?.(),pending=[];
    for(const b of targets){
      b.items=b.items||[];
      if(url&&b.items.some(x=>x.url===url)){skipped++;continue}
      const item={id:crypto.randomUUID(),url,title,image,tag,source,price,size,reviews,condition,detailsChecked,_createdBy:user?.id};
      b.items.unshift(item);b.updated=now();
      pending.push({board:b,item});
    }

    if(window.inspoCloudApi?.saveLocalOnly)window.inspoCloudApi.saveLocalOnly();

    const results=await Promise.allSettled(pending.map(row=>{
      if(window.inspoCloudApi?.saveItemToBoard)return window.inspoCloudApi.saveItemToBoard(row.board,row.item);
      return Promise.resolve(true);
    }));

    results.forEach((result,i)=>{
      const row=pending[i];
      if(result.status==='fulfilled')added++;
      else{
        failed++;
        row.board.items=row.board.items.filter(x=>x.id!==row.item.id);
      }
    });
    if(failed&&window.inspoCloudApi?.saveLocalOnly)window.inspoCloudApi.saveLocalOnly();

    saveBtn.disabled=false;saveBtn.textContent='Add to board';
    if(!added&&failed){status.textContent='Could not save this find. Try again.';return}
    closeModal('findModal');idx=0;filter='all';renderBoard();
    let msg=added?'Added to '+added+' board'+(added===1?'':'s'):'Already on the selected board'+(targets.length===1?'':'s');
    if(skipped&&added)msg+=' · '+skipped+' already had it';
    toast(msg);
  };
})();