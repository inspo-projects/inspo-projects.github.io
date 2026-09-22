function openFindModal(id=null){
  editItemId=id;
  const b=current(),x=id?(b.items||[]).find(i=>i.id===id):null;
  $('#findModalTitle').textContent=x?'Edit find':'Add a find';
  $('#findUrl').value=x?.url||'';
  $('#findName').value=x?.title||'';
  $('#findImage').value=x?.image||'';
  $('#findTag').value=x?.tag||'';
  $('#findPrice').value=x?.price||'';
  $('#findSize').value=x?.size||'';
  $('#findReviews').value=x?.reviews||'';
  $('#findCondition').value=x?.condition||'';
  $('#saveFind').textContent=x?'Save changes':'Add to board';
  $('#deleteFind').hidden=!x;
  $('#findStatus').textContent='';

  const moveWrap=$('#moveFindWrap'),moveSelect=$('#moveFindBoard');
  if(moveWrap&&moveSelect){
    moveSelect.innerHTML='';
    const targets=(projects||[]).filter(p=>p.id!==currentId&&p._role!=='viewer');
    if(x&&targets.length){
      const hold=document.createElement('option');
      hold.value='';hold.textContent='Keep on this board';
      moveSelect.appendChild(hold);
      targets.forEach(p=>{
        const opt=document.createElement('option');
        opt.value=p.id;
        opt.textContent=(p.icon?p.icon+' ':'')+p.title;
        moveSelect.appendChild(opt);
      });
      moveWrap.hidden=false;
    }else{
      moveWrap.hidden=true;
    }
  }

  openModal('findModal');
  setTimeout(()=>$('#findUrl').focus(),120);
}
async function preview(url){const r=await fetch('https://api.microlink.io/?url='+encodeURIComponent(url));if(!r.ok)throw new Error('preview');const d=(await r.json()).data||{};return{title:d.title||'',image:d.image?.url||'',source:d.publisher||'',description:d.description||''}}
$('#saveFind').onclick=async()=>{
  const b=current();if(!b)return;
  const original=b.items.find(i=>i.id===editItemId);
  let url=$('#findUrl').value.trim(),title=$('#findName').value.trim(),image=$('#findImage').value.trim(),tag=$('#findTag').value.trim(),price=$('#findPrice').value.trim(),size=$('#findSize').value.trim(),reviews=$('#findReviews').value.trim(),condition=$('#findCondition').value.trim(),source='',detailsChecked=0;
  const targetId=editItemId&&!$('#moveFindWrap').hidden?$('#moveFindBoard').value:'';

  if(url){url=safeHttpUrl(url);if(!url){$('#findStatus').textContent='Use a normal http or https source link.';return}}
  if(image){image=safeImageUrl(image);if(!image){$('#findStatus').textContent='Use a normal http or https photo URL.';return}}
  if(!url&&!image){$('#findStatus').textContent='Add a source link or a photo URL.';return}
  if(!editItemId&&url&&(b.items||[]).some(x=>x.url===url)){$('#findStatus').textContent='That link is already on this board.';return}

  const target=targetId?(projects||[]).find(p=>p.id===targetId):null;
  if(target&&url&&(target.items||[]).some(x=>x.url===url)){
    $('#findStatus').textContent='That find is already on '+target.title+'.';
    return;
  }

  $('#saveFind').textContent=target?'Moving…':(editItemId?'Saving…':'Adding…');
  $('#saveFind').disabled=true;

  if(url&&(!title||!image||!price||!size||!reviews||!condition)){
    try{
      const d=await previewDetails(url);
      if(!title)title=d.title;
      if(!image)image=d.image;
      source=sourceName(url,d.source);
      if(!price)price=d.price||'';
      if(!size)size=d.size||'';
      if(!reviews)reviews=d.reviews||'';
      if(!condition)condition=d.condition||'';
      detailsChecked=Date.now();
    }catch{
      try{
        const d=await preview(url);
        if(!title)title=d.title;
        if(!image)image=d.image;
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

  if(editItemId&&original){
    const wasSaved=(b.saved||[]).includes(original.id);
    if(target){
      const moved={
        ...original,
        id:crypto.randomUUID(),
        url,title,image,tag,source,price,size,reviews,condition,
        detailsChecked:detailsChecked||original.detailsChecked||0
      };
      b.items=b.items.filter(i=>i.id!==original.id);
      b.saved=(b.saved||[]).filter(id=>id!==original.id);
      target.items=target.items||[];
      target.saved=target.saved||[];
      target.items.unshift(moved);
      if(wasSaved)target.saved.push(moved.id);
      b.updated=now();target.updated=now();
      persist();
      if(window.inspoCloudApi?.saveItemToBoard)await window.inspoCloudApi.saveItemToBoard(target,moved);
      if(window.inspoCloudApi?.deleteItem)await window.inspoCloudApi.deleteItem(b.id,original.id);
      else if(window.inspoCloudApi?.sync)await window.inspoCloudApi.sync();
      $('#saveFind').disabled=false;
      closeModal('findModal');
      idx=0;filter='all';
      renderBoard();
      toast('Moved to '+target.title);
      return;
    }
    original.url=url;original.title=title;original.image=image;original.tag=tag;original.source=source;original.price=price;original.size=size;original.reviews=reviews;original.condition=condition;original.detailsChecked=detailsChecked||original.detailsChecked||0;
  }else{
    b.items.unshift({id:'item-'+now(),url,title,image,tag,source,price,size,reviews,condition,detailsChecked});
  }

  b.updated=now();persist();
  $('#saveFind').disabled=false;
  $('#saveFind').textContent=editItemId?'Save changes':'Add to board';
  closeModal('findModal');idx=0;filter='all';renderBoard();
  toast(editItemId?'Find updated':'Added to board');
};
$('#deleteFind').onclick=async()=>{
  const b=current(),x=b?.items.find(i=>i.id===editItemId);if(!x)return;
  if(!confirm('Remove this find from the board?'))return;
  const btn=$('#deleteFind');btn.disabled=true;btn.textContent='Removing…';
  try{
    if(window.inspoCloudApi?.deleteItem&&b._cloud)await window.inspoCloudApi.deleteItem(b.id,x.id);
    b.items=b.items.filter(i=>i.id!==x.id);
    b.saved=(b.saved||[]).filter(id=>id!==x.id);
    b.updated=now();saveLocal();
    closeModal('findModal');idx=0;renderBoard();toast('Find removed');
  }catch(e){
    console.warn('Find delete',e);toast('Could not remove find');
  }finally{btn.disabled=false;btn.textContent='Remove from board'}
};
