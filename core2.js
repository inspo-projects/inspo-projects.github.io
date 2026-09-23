function favoriteFaceHTML(face){
  const name=face?.display_name||'User',img=safeImageUrl(face?.avatar_url||'');
  const initials=String(name).trim().split(/\s+/).filter(Boolean);
  const letters=(initials.length>1?(initials[0][0]+initials[initials.length-1][0]):String(name).slice(0,2)).toUpperCase();
  return img
    ?'<span class="listing-face" title="'+escapeHTML(name)+'"><img src="'+escapeHTML(img)+'" alt="" referrerpolicy="no-referrer"></span>'
    :'<span class="listing-face initials" title="'+escapeHTML(name)+'">'+escapeHTML(letters||'?')+'</span>';
}
function favoriteFacesFor(board,itemId){return board?._favoriteFaces?.[itemId]||[]}
function favoriteFacesHTML(board,itemId){
  const faces=favoriteFacesFor(board,itemId);
  if(!faces.length)return '';
  return '<div class="listing-like-row"><span class="liked-by-label">Liked by</span><div class="listing-face-stack" aria-label="'+faces.length+' people liked this">'+faces.slice(0,5).map(favoriteFaceHTML).join('')+(faces.length>5?'<span class="listing-face initials more-faces">+'+(faces.length-5)+'</span>':'')+'</div></div>';
}
function renderBoard(){
  const b=current(); if(!b){renderHome();return}
  $('#boardType').textContent=b.type==='project'?'Project board':'Inspo board';$('#boardTitle').textContent=(b.icon?b.icon+' ':'')+b.title;$('#boardSub').textContent=b.subtitle||'';
  const comparing=filter==='saved'&&savedMode==='compare';
  $('#swipeViewBtn').classList.toggle('on',viewMode==='swipe');$('#gridViewBtn').classList.toggle('on',viewMode==='grid');
  $('#savedTools').classList.toggle('show',filter==='saved');$('#savedBrowseBtn').classList.toggle('on',savedMode==='browse');$('#savedCompareBtn').classList.toggle('on',savedMode==='compare');
  $('#comparePanel').classList.toggle('show',comparing);$('#swipePanel').hidden=comparing||viewMode!=='swipe';$('#gridPanel').hidden=comparing||viewMode!=='grid';
  renderFilters(); renderSwipe(); renderGrid(); renderCompare(); setTimeout(()=>window.inspoComments?.decorate(),0);
}
function renderFilters(){
  const b=current(), f=$('#filters'); f.innerHTML=''; const sources=[...new Set((b.items||[]).map(x=>x.source).filter(Boolean))];
  const defs=[['all','All'],...sources.map(s=>[s,s]),['saved','♡ Saved '+(b.saved||[]).length]];
  defs.forEach(([key,label])=>{const bt=document.createElement('button');bt.className='chip'+(filter===key?' on':'');bt.textContent=label;bt.onclick=()=>{filter=key;idx=0;if(key!=='saved')savedMode='browse';renderBoard()};f.appendChild(bt)});
}
function renderSwipe(){
  const a=boardList(), b=current(); const has=a.length>0;
  $('#card').hidden=!has;$('#emptySwipe').hidden=has;$('#thumbs').innerHTML='';
  $('#thumbTitle').textContent=filter==='saved'?'Saved finds':filter==='all'?'All finds':filter;
  if(!has){$('#emptyTitle').textContent=filter==='saved'?'No saved finds yet':'Nothing here yet';$('#emptyText').textContent=filter==='saved'?'Tap the heart on anything you want to keep.':'Add a find or try another filter.';return}
  idx=Math.max(0,Math.min(idx,a.length-1));const x=a[idx];
  $('#src').textContent=x.source||'Inspo';$('#tag').textContent=x.tag||'';$('#count').textContent=`${idx+1} of ${a.length}`;$('#ttl').textContent=x.title||'Untitled find';
  const swipePrice=$('#swipePrice');
  if(swipePrice){
    swipePrice.classList.remove('muted-price');
    if(x.price)swipePrice.textContent=x.price;
    else if(x._priceLoading||!x._priceChecked){swipePrice.textContent='Loading price…';swipePrice.classList.add('muted-price')}
    else{swipePrice.textContent='Price unavailable';swipePrice.classList.add('muted-price')}
  }
  $('#heart').textContent=(b.saved||[]).includes(x.id)?'♥':'♡';$('#heart').classList.toggle('on',(b.saved||[]).includes(x.id));
  const swipeLikes=$('#swipeLikes');if(swipeLikes)swipeLikes.innerHTML=favoriteFacesHTML(b,x.id);
  const shop=$('#shop'),link=$('#picLink'),safeUrl=safeHttpUrl(x.url); if(safeUrl){shop.href=safeUrl;shop.classList.remove('disabled');link.href=safeUrl;link.removeAttribute('aria-disabled')}else{shop.removeAttribute('href');shop.classList.add('disabled');link.removeAttribute('href');link.setAttribute('aria-disabled','true')}
  showMainImage(x); renderThumbs(a); setTimeout(()=>window.inspoComments?.decorate(),0);
}
function showMainImage(x){const im=$('#pic'),ph=$('#ph'),src=safeImageUrl(x.image);if(src){im.hidden=false;ph.hidden=true;im.src=src;im.alt=x.title||'';im.referrerPolicy='no-referrer';im.onerror=()=>{im.hidden=true;ph.hidden=false}}else{im.hidden=true;ph.hidden=false}}
function renderThumbs(a){const t=$('#thumbs'),b=current();a.forEach((x,i)=>{const bt=document.createElement('button');bt.className='thumb'+(i===idx?' on':'');const thumbSrc=safeImageUrl(x.image);if(thumbSrc){const im=document.createElement('img');im.src=thumbSrc;im.alt='';im.referrerPolicy='no-referrer';im.onerror=()=>im.remove();bt.appendChild(im)}if((b.saved||[]).includes(x.id)){const h=document.createElement('span');h.className='mh';h.textContent='♥';bt.appendChild(h)}bt.onclick=()=>{idx=i;renderSwipe();bt.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'})};t.appendChild(bt)})}
async function toggleSavedItem(x){
  const b=current();if(!b||!x)return;
  b.saved=b.saved||[];
  const at=b.saved.indexOf(x.id),wasSaved=at>=0,wantSaved=!wasSaved;
  const previousFaces=[...(b._favoriteFaces?.[x.id]||[])];

  if(wasSaved)b.saved.splice(at,1);else b.saved.push(x.id);

  b._favoriteFaces=b._favoriteFaces||{};
  const user=window.inspoCloudApi?.getUser?.(),profile=window.inspoCloudApi?.getProfile?.();
  let faces=previousFaces.filter(f=>f.user_id!==user?.id);
  if(user&&wantSaved){
    faces.push({
      user_id:user.id,
      display_name:profile?.display_name||user.email?.split('@')[0]||'You',
      avatar_url:profile?.avatar_url||''
    });
  }
  b._favoriteFaces[x.id]=faces;
  saveLocal();
  renderBoard();

  try{
    if(window.inspoCloudApi?.setSavedItem){
      await window.inspoCloudApi.setSavedItem(b.id,x.id,wantSaved);
    }else{
      persist();
    }
    if(window.inspoCloudApi?.refreshFavoriteFaces)await window.inspoCloudApi.refreshFavoriteFaces();
    toast(wantSaved?'Saved ♡':'Removed from saved');
  }catch(e){
    console.warn('Like sync',e);
    b.saved=b.saved||[];
    const nowAt=b.saved.indexOf(x.id);
    if(wasSaved&&nowAt<0)b.saved.push(x.id);
    if(!wasSaved&&nowAt>=0)b.saved.splice(nowAt,1);
    b._favoriteFaces[x.id]=previousFaces;
    saveLocal();
    renderBoard();
    toast('Could not sync that like. Try again.');
  }

  if(filter==='saved'&&!wantSaved&&idx>=boardList().length)idx=Math.max(0,boardList().length-1);
}
function renderGrid(){
  const a=boardList(),g=$('#moodgrid');g.innerHTML='';$('#emptyGrid').hidden=a.length>0;
  const b=current();a.forEach((x,i)=>{
    const tile=document.createElement('div');tile.className='tile';tile.dataset.itemId=x.id;tile.setAttribute('role','button');tile.tabIndex=0;

    const media=document.createElement('div');media.className='tile-media';
    const tileSrc=safeImageUrl(x.image);
    media.innerHTML=tileSrc?`<img src="${escapeHTML(tileSrc)}" alt="" referrerpolicy="no-referrer">`:`<div class="tile-ph">✦<br>${escapeHTML(x.title||'Find')}</div>`;

    const source=document.createElement('span');source.className='source-dot';source.textContent=x.source||'Inspo';media.appendChild(source);

    const heart=document.createElement('button');heart.type='button';heart.className='tile-heart'+((b.saved||[]).includes(x.id)?' on':'');heart.setAttribute('aria-label',(b.saved||[]).includes(x.id)?'Remove from saved':'Save find');heart.textContent=(b.saved||[]).includes(x.id)?'♥':'♡';
    heart.onclick=e=>{e.stopPropagation();toggleSavedItem(x)};media.appendChild(heart);
    tile.appendChild(media);

    const info=document.createElement('div');info.className='tile-info';
    const title=document.createElement('div');title.className='tile-title';title.textContent=x.title||'Untitled find';info.appendChild(title);

    const price=document.createElement('div');price.className='tile-price';
    if(x.price){
      price.textContent=x.price;
    }else if(x._priceLoading||!x._priceChecked){
      price.textContent='Loading price…';
      price.classList.add('muted-price');
    }else{
      price.textContent='Price unavailable';
      price.classList.add('muted-price');
    }
    info.appendChild(price);
    const faces=document.createElement('div');faces.className='tile-likes';faces.innerHTML=favoriteFacesHTML(b,x.id);info.appendChild(faces);
    tile.appendChild(info);

    const open=()=>{viewMode='swipe';idx=i;renderBoard();window.scrollTo({top:0,behavior:'smooth'})};
    tile.onclick=open;tile.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&e.target===tile){e.preventDefault();open()}};
    g.appendChild(tile)
  });
}
