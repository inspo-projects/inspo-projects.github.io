
(()=> {
const SUPABASE_URL='https://lvbtuweiariexxtulqmo.supabase.co';
const SUPABASE_KEY='sb_publishable_gV3fjp4nxKlMQP2qGoy65A_5Wtd-WA-';
const APP_URL='https://inspo-projects.github.io/';
if(!window.supabase)return;
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,detectSessionInUrl:true}});
let cloudUser=null,cloudProfile=null,syncTimer=null,syncing=false,reloading=false,channel=null,ownedIds=new Set(),googleEnabled=false;
const uuidRe=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const legacyPersist=persist;
window.inspoCloudApi={
  getUser:()=>cloudUser,
  getProfile:()=>cloudProfile,
  sync:()=>syncNow(),
  saveItemToBoard:async(p,x)=>{
    if(!cloudUser)throw new Error('Sign in required');
    if(!p||!x)throw new Error('Missing board or find');
    if(!uuidRe.test(p.id))p.id=crypto.randomUUID();
    if(!uuidRe.test(x.id))x.id=crypto.randomUUID();
    if(!p._cloud){
      const {error:boardError}=await sb.from('boards').insert(toBoardRow(p));
      if(boardError)throw boardError;
      p._cloud=true;p._ownerId=cloudUser.id;p._role='owner';ownedIds.add(p.id);
    }
    const {error:itemError}=await sb.from('items').upsert({
      id:x.id,board_id:p.id,created_by:x._createdBy||cloudUser.id,
      source_url:safeHttpUrl(x.url)||null,source_name:x.source||null,
      title:x.title||'Untitled find',image_url:safeImageUrl(x.image)||null,
      tag:x.tag||null,price:x.price||null,size:x.size||null,
      reviews:x.reviews||null,condition:x.condition||null,
      position:0
    });
    if(itemError)throw itemError;
    saveLocal();
    return true;
  },
  createBoard:async p=>{
    if(!cloudUser)throw new Error('Sign in required');
    if(!uuidRe.test(p.id))p.id=crypto.randomUUID();
    p._ownerId=cloudUser.id;p._role='owner';
    const {error}=await sb.from('boards').insert(toBoardRow(p));
    if(error)throw error;
    p._cloud=true;
    ownedIds.add(p.id);
    saveLocal();
    return true;
  },
  refreshFavoriteFaces:async()=>{
    await loadFavoriteFacesForBoards();
    if(currentId)renderBoard();
  },
  previewVinted:async url=>{
    if(!cloudUser)throw new Error('Sign in required');
    const {data,error}=await sb.functions.invoke('vinted-preview',{body:{url}});
    if(error)throw error;
    return data||{};
  },
  previewDepop:async url=>{
    if(!cloudUser)throw new Error('Sign in required');
    const {data,error}=await sb.functions.invoke('depop-preview',{body:{url}});
    if(error)throw error;
    return data||{};
  },
  previewEbay:async url=>{
    if(!cloudUser)throw new Error('Sign in required');
    const {data,error}=await sb.functions.invoke('ebay-preview',{body:{url}});
    if(error)throw error;
    return data||{};
  }
};
const LEGACY_CLAIM='inspoLegacyClaimedBy_v1';
const userCacheKey=()=>cloudUser?`inspoProjects_user_${cloudUser.id}`:KEY;
function saveLocal(){localStorage.setItem(userCacheKey(),JSON.stringify(projects))}
function tokenFromUrl(kind){
  const u=new URL(location.href),q=u.searchParams.get(kind);
  if(q)return q;
  const h=new URLSearchParams(location.hash.replace(/^#/,''));
  return h.get(kind)||'';
}
function scrubShareToken(){history.replaceState(null,'',APP_URL)}

function injectUI(){
  document.body.insertAdjacentHTML('afterbegin',`
  <div id="authGate"><div class="auth-card"><div class="eyebrow">private visual workspace</div><h2>Inspo Projects</h2><p id="authMsg">Sign in to see your boards.</p><button id="googleLogin" class="auth-btn auth-google">Continue with Google</button><div class="auth-or">or</div><input id="emailLogin" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"><button id="emailLoginBtn" class="auth-btn auth-email">Continue with email</button><div id="authStatus" class="auth-status"></div></div></div>
  <div id="shareCloudModal" class="overlay"><div class="sheet"><div class="sheet-head"><h2>Share board</h2><button class="close" id="closeCloudShare">×</button></div><div id="shareCloudBody"></div></div></div>
  <div id="profileModal" class="overlay"><div class="sheet profile-sheet"><div class="sheet-head"><h2>Edit profile</h2><button class="close" id="closeProfile">×</button></div>
    <div class="profile-photo-row"><div id="profilePreview" class="profile-preview"></div><div><label class="profile-upload" for="profilePhoto">Choose photo</label><input id="profilePhoto" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><div class="hintline">Square photos work best. We’ll resize it for you.</div></div></div>
    <div class="field"><label>Name</label><input id="profileName" maxlength="60" placeholder="Your name"></div>
    <button id="saveProfile" class="primary">Save profile</button><div id="profileStatus" class="status"></div>
  </div></div>`);
  const home=document.querySelector('.home-actions'); if(home){home.insertAdjacentHTML('beforebegin','<div id="cloudUserBar" class="cloud-user" hidden><button id="profileButton" class="profile-button" type="button"><span id="profileButtonAvatar" class="profile-button-avatar"></span><span id="cloudUserText"></span></button><button id="cloudSignOut">Sign out</button></div>')}
  $('#closeCloudShare').onclick=()=>$('#shareCloudModal').classList.remove('show');
  $('#shareCloudModal').onclick=e=>{if(e.target.id==='shareCloudModal')e.currentTarget.classList.remove('show')};
  $('#closeProfile').onclick=()=>$('#profileModal').classList.remove('show');
  $('#profileModal').onclick=e=>{if(e.target.id==='profileModal')e.currentTarget.classList.remove('show')};
  $('#profileButton').onclick=openProfileModal;
  $('#saveProfile').onclick=saveProfileChanges;
  $('#profilePhoto').onchange=previewSelectedProfilePhoto;
  $('#googleLogin').onclick=googleLogin; $('#emailLoginBtn').onclick=emailLogin; $('#cloudSignOut').onclick=()=>sb.auth.signOut();
}

function initialsFor(name='',email=''){
  const base=String(name||'').trim()||String(email||'').split('@')[0]||'?';
  const parts=base.split(/\s+/).filter(Boolean);
  if(parts.length>1)return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  return base.slice(0,2).toUpperCase();
}
function profileAvatarMarkup(profile,sizeClass=''){
  const name=profile?.display_name||'';
  const email=profile?.email||cloudUser?.email||'';
  const image=safeImageUrl(profile?.avatar_url||'');
  return image
    ?'<img class="person-avatar-img '+sizeClass+'" src="'+escapeHTML(image)+'" alt="" referrerpolicy="no-referrer">'
    :'<span class="person-avatar-fallback '+sizeClass+'">'+escapeHTML(initialsFor(name,email))+'</span>';
}
function updateProfileButton(){
  if(!cloudUser)return;
  const label=cloudProfile?.display_name||cloudUser.user_metadata?.full_name||cloudUser.user_metadata?.name||cloudUser.email||'Profile';
  $('#cloudUserText').textContent=label;
  $('#profileButtonAvatar').innerHTML=profileAvatarMarkup(cloudProfile);
}
async function loadMyProfile(){
  if(!cloudUser)return;
  let {data,error}=await sb.from('profiles').select('id,email,display_name,avatar_url').eq('id',cloudUser.id).maybeSingle();
  if(error)console.warn('Profile load',error);
  if(!data){
    const display=cloudUser.user_metadata?.full_name||cloudUser.user_metadata?.name||String(cloudUser.email||'').split('@')[0]||'';
    const row={id:cloudUser.id,email:cloudUser.email||null,display_name:display||null,avatar_url:cloudUser.user_metadata?.avatar_url||null};
    const created=await sb.from('profiles').upsert(row).select('id,email,display_name,avatar_url').single();
    data=created.data||row;
  }
  cloudProfile=data||{id:cloudUser.id,email:cloudUser.email||'',display_name:'',avatar_url:''};
  updateProfileButton();
}
function renderProfilePreview(profile=cloudProfile){
  const el=$('#profilePreview');if(!el)return;
  el.innerHTML=profileAvatarMarkup(profile,'large');
}
function openProfileModal(){
  if(!cloudUser)return;
  $('#profileName').value=cloudProfile?.display_name||'';
  $('#profilePhoto').value='';
  $('#profileStatus').textContent='';
  renderProfilePreview();
  $('#profileModal').classList.add('show');
}
async function loadProfileImageSource(file){
  if('createImageBitmap' in window){
    try{
      const bitmap=await createImageBitmap(file);
      return{source:bitmap,width:bitmap.width,height:bitmap.height,cleanup:()=>{try{bitmap.close()}catch{}}};
    }catch(e){}
  }
  return await new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>resolve({source:img,width:img.naturalWidth,height:img.naturalHeight,cleanup:()=>URL.revokeObjectURL(url)});
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Your browser could not open that photo. Try a JPG, PNG, or another photo.'))};
    img.src=url;
  });
}
async function resizeProfileImage(file){
  if(!file||!String(file.type||'').startsWith('image/'))throw new Error('Choose an image file.');
  const loaded=await loadProfileImageSource(file);
  try{
    if(!loaded.width||!loaded.height)throw new Error('That photo could not be read.');
    const size=512,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser could not prepare that photo.');
    const scale=Math.max(size/loaded.width,size/loaded.height);
    const w=loaded.width*scale,h=loaded.height*scale;
    ctx.drawImage(loaded.source,(size-w)/2,(size-h)/2,w,h);
    return await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Could not prepare photo.')),'image/jpeg',0.86));
  }finally{
    loaded.cleanup();
  }
}
async function previewSelectedProfilePhoto(){
  const file=$('#profilePhoto').files?.[0];if(!file)return;
  try{
    const blob=await resizeProfileImage(file);
    const url=URL.createObjectURL(blob);
    $('#profilePreview').innerHTML='<img class="person-avatar-img large" src="'+url+'" alt="">';
  }catch(e){$('#profileStatus').textContent=e.message||'Could not use that photo.'}
}
async function saveProfileChanges(){
  if(!cloudUser)return;
  const btn=$('#saveProfile'),statusEl=$('#profileStatus');
  btn.disabled=true;btn.textContent='Saving…';statusEl.textContent='';
  try{
    const displayName=$('#profileName').value.trim();
    let avatarUrl=cloudProfile?.avatar_url||'';
    const file=$('#profilePhoto').files?.[0];
    if(file){
      statusEl.textContent='Uploading photo…';
      const blob=await resizeProfileImage(file);
      const path=cloudUser.id+'/avatar.jpg';
      const {error:uploadError}=await sb.storage.from('avatars').upload(path,blob,{contentType:'image/jpeg',upsert:true,cacheControl:'60'});
      if(uploadError)throw new Error(uploadError.message||'Could not upload photo.');
      const {data:publicData}=sb.storage.from('avatars').getPublicUrl(path);
      const baseUrl=publicData?.publicUrl||'';
      avatarUrl=baseUrl?(baseUrl+(baseUrl.includes('?')?'&':'?')+'v='+Date.now()):'';
    }
    const payload={id:cloudUser.id,email:cloudUser.email||null,display_name:displayName||null,avatar_url:avatarUrl||null,updated_at:new Date().toISOString()};
    const {data,error}=await sb.from('profiles').upsert(payload).select('id,email,display_name,avatar_url').single();
    if(error)throw error;
    cloudProfile=data||payload;
    updateProfileButton();
    await loadFavoriteFacesForBoards();
    if(currentId)renderBoard();
    $('#profileModal').classList.remove('show');
    toast('Profile updated');
  }catch(e){
    statusEl.textContent=e.message||'Could not save profile.';
  }finally{
    btn.disabled=false;btn.textContent='Save profile';
  }
}
async function loadFavoriteFacesForBoards(){
  if(!cloudUser||!projects?.length)return;
  await Promise.all(projects.map(async p=>{
    const {data,error}=await sb.rpc('board_favorite_faces',{bid:p.id});
    if(error){p._favoriteFaces={};return}
    const map={};
    (data||[]).forEach(row=>{
      (map[row.item_id]||(map[row.item_id]=[])).push({
        user_id:row.user_id,
        display_name:row.display_name||'User',
        avatar_url:row.avatar_url||''
      });
    });
    p._favoriteFaces=map;
  }));
}
function showGate(msg='Sign in to see your boards.'){document.querySelector('.shell').style.display='none';$('#authMsg').textContent=msg;$('#authGate').classList.add('show')}
function hideGate(){document.querySelector('.shell').style.display='';$('#authGate').classList.remove('show')}
function status(s){$('#authStatus').textContent=s||''}
async function loadAuthCapabilities(){
  try{
    const r=await fetch(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:SUPABASE_KEY}});
    const s=await r.json();googleEnabled=!!s?.external?.google;
    const btn=$('#googleLogin');
    if(btn){
      btn.setAttribute('aria-disabled',googleEnabled?'false':'true');
      btn.textContent=googleEnabled?'Continue with Google':'Google sign-in needs setup';
    }
  }catch{}
}
async function googleLogin(){
  if(!googleEnabled){status('Google sign-in is not enabled yet. Use email for now, or finish the one-time Google setup.');return}
  localStorage.setItem('inspoPendingJoin',tokenFromUrl('join')||localStorage.getItem('inspoPendingJoin')||'');
  const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:APP_URL}});
  if(error)status(error.message||'Google sign-in could not start.');
}
async function emailLogin(){
  const email=$('#emailLogin').value.trim(); if(!email){status('Enter your email first.');return}
  localStorage.setItem('inspoPendingJoin',tokenFromUrl('join')||localStorage.getItem('inspoPendingJoin')||'');
  status('Sending your sign-in link…');
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:APP_URL,shouldCreateUser:true}});
  status(error?error.message:'Check your email for the sign-in link ✦');
}
function normalizeIds(){
  for(const p of projects){
    const oldBoard=p.id;if(!uuidRe.test(p.id)){p.id=crypto.randomUUID();if(currentId===oldBoard)currentId=p.id}
    const map=new Map();for(const x of (p.items||[])){const old=x.id;if(!uuidRe.test(x.id))x.id=crypto.randomUUID();map.set(old,x.id)}
    p.saved=(p.saved||[]).map(id=>map.get(id)||id).filter(id=>uuidRe.test(id));
  }
  saveLocal();
}
function toBoardRow(p){
  return{id:p.id,owner_id:p._ownerId||cloudUser.id,title:p.title||'Untitled board',subtitle:p.subtitle||null,icon:p.icon||null,board_type:p.type||'inspo'};
}
async function syncNow(){
  for(let i=0;i<60;i++){
    if(!syncing&&!reloading)return syncAll(true);
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error('Cloud sync is busy. Please try again.');
}
async function syncAll(force=false){
  if(!cloudUser||syncing||(!force&&reloading))return;syncing=true;
  try{
    normalizeIds();
    const presentOwned=new Set();
    for(const p of projects){
      const role=p._role||'owner'; const owner=p._ownerId||cloudUser.id;
      if(role==='viewer')continue;
      if(role==='owner'||owner===cloudUser.id){
        presentOwned.add(p.id);
        if(!p._cloud){
          const {error}=await sb.from('boards').insert(toBoardRow(p)); if(error)throw error;
          p._cloud=true;p._ownerId=cloudUser.id;p._role='owner';
        }else{
          await sb.from('boards').update({title:p.title,subtitle:p.subtitle||null,icon:p.icon||null,board_type:p.type||'inspo'}).eq('id',p.id);
        }
      }else{
        await sb.from('boards').update({title:p.title,subtitle:p.subtitle||null,icon:p.icon||null,board_type:p.type||'inspo'}).eq('id',p.id);
      }
      const localIds=new Set();
      for(let pos=0;pos<(p.items||[]).length;pos++){
        const x=p.items[pos]; if(!uuidRe.test(x.id))x.id=crypto.randomUUID();localIds.add(x.id);
        await sb.from('items').upsert({id:x.id,board_id:p.id,created_by:x._createdBy||cloudUser.id,source_url:safeHttpUrl(x.url)||null,source_name:x.source||null,title:x.title||'Untitled find',image_url:safeImageUrl(x.image)||null,tag:x.tag||null,price:x.price||null,size:x.size||null,reviews:x.reviews||null,condition:x.condition||null,position:pos});
      }
      const {data:dbItems}=await sb.from('items').select('id').eq('board_id',p.id);
      const stale=(dbItems||[]).map(r=>r.id).filter(id=>!localIds.has(id)); if(stale.length)await sb.from('items').delete().in('id',stale);
      await sb.from('saved_items').delete().eq('board_id',p.id).eq('user_id',cloudUser.id);
      const saves=(p.saved||[]).filter(id=>localIds.has(id)).map(item_id=>({board_id:p.id,item_id,user_id:cloudUser.id}));
      if(saves.length)await sb.from('saved_items').insert(saves);
    }
    for(const id of ownedIds){if(!presentOwned.has(id)){await sb.from('boards').delete().eq('id',id)}}
    ownedIds=presentOwned; saveLocal();
  }catch(e){console.warn('Cloud sync',e);throw e}finally{syncing=false}
}
persist=function(){saveLocal();if(cloudUser&&!reloading){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncAll(false),450)}};

function prepareUserCache(){
  const cached=safeJSON(localStorage.getItem(userCacheKey()),null);
  if(Array.isArray(cached)){projects=cached;return}
  const claimed=localStorage.getItem(LEGACY_CLAIM);
  const legacy=safeJSON(localStorage.getItem(KEY),[]);
  if(!claimed&&Array.isArray(legacy)&&legacy.length){
    projects=legacy;
    localStorage.setItem(LEGACY_CLAIM,cloudUser.id);
    saveLocal();
    localStorage.removeItem(KEY);
  }else{
    projects=[];
    saveLocal();
  }
}
function dbBoardToLocal(b,items,saved,members){
  const its=(items||[]).filter(i=>i.board_id===b.id).sort((a,z)=>(a.position||0)-(z.position||0)).map(i=>({id:i.id,url:i.source_url||'',source:i.source_name||'',title:i.title||'',image:i.image_url||'',tag:i.tag||'',price:i.price||'',size:i.size||'',reviews:i.reviews||'',condition:i.condition||'',_createdBy:i.created_by}));
  const role=b.owner_id===cloudUser.id?'owner':((members||[]).find(m=>m.board_id===b.id&&m.user_id===cloudUser.id)?.role||'viewer');
  return{id:b.id,type:b.board_type,icon:b.icon||'✦',title:b.title,subtitle:b.subtitle||'',created:Date.parse(b.created_at),updated:Date.parse(b.updated_at),items:its,saved:(saved||[]).filter(s=>s.board_id===b.id&&s.user_id===cloudUser.id).map(s=>s.item_id),_cloud:true,_ownerId:b.owner_id,_role:role,_shareToken:b.share_token,_collaborateToken:b.collaborate_token,_visibility:b.visibility};
}
async function loadCloud(){
  if(!cloudUser)return;reloading=true;
  try{
    const [{data:boards,error:be},{data:items},{data:saved},{data:members}]=await Promise.all([
      sb.from('boards').select('*').order('updated_at',{ascending:false}),
      sb.from('items').select('*'),
      sb.from('saved_items').select('*'),
      sb.from('board_members').select('*')
    ]);
    if(be)throw be;
    if((boards||[]).length===0&&projects.length){
      normalizeIds();for(const p of projects){p._ownerId=cloudUser.id;p._role='owner';p._cloud=false}await syncAll(true);
      return loadCloud();
    }
    projects=(boards||[]).map(b=>dbBoardToLocal(b,items,saved,members));
    ownedIds=new Set(projects.filter(p=>p._role==='owner').map(p=>p.id));
    saveLocal();currentId=null;renderHome();
    loadFavoriteFacesForBoards().then(()=>{if(currentId)renderBoard();else renderHome()}).catch(e=>console.warn('Favorite faces',e));
  }catch(e){console.warn(e);toast('Could not load cloud boards')}finally{reloading=false}
}
const originalRenderHome=renderHome;
renderHome=function(){
  if(!cloudUser){originalRenderHome();return}
  $('#homeView').hidden=false;$('#boardView').hidden=true;const wrap=$('#projects');wrap.innerHTML='';$('#emptyHome').hidden=projects.length!==0;
  const groups=[['My Boards',projects.filter(p=>p._role==='owner')],['Shared With Me',projects.filter(p=>p._role!=='owner')]];
  const card=p=>{
    const btn=document.createElement('button');btn.className='project-card';const imgs=(p.items||[]).map(x=>safeImageUrl(x.image)).filter(Boolean).slice(0,4);
    const cover=imgs.length?'<div class="cover">'+imgs.map(src=>`<img src="${escapeHTML(src)}" alt="" referrerpolicy="no-referrer">`).join('')+'</div>':`<div class="cover empty">${escapeHTML(p.icon||'✦')}</div>`;
    const saved=(p.saved||[]).length,count=(p.items||[]).length;
    btn.innerHTML=cover+`<div class="pc-body"><span class="pill">${p._role==='owner'?(p.type==='project'?'Project board':'Inspo board'):'Shared '+p._role}</span><div class="pc-title">${escapeHTML(p.icon||'')} ${escapeHTML(p.title)}</div><div class="pc-sub">${escapeHTML(p.subtitle||'')}</div><div class="pc-meta">${count} find${count===1?'':'s'}${saved?' · '+saved+' saved':''}</div></div>${p._role==='owner'?'<button class="pc-more" aria-label="Edit board">•••</button>':''}`;
    btn.onclick=e=>{if(e.target.closest('.pc-more')){openBoardModal(p.id);e.stopPropagation();return}openBoard(p.id)};return btn
  };
  groups.forEach(([title,arr])=>{if(!arr.length)return;const h=document.createElement('div');h.className='project-section-title';h.textContent=title;wrap.appendChild(h);arr.sort((a,b)=>(b.updated||0)-(a.updated||0)).forEach(p=>wrap.appendChild(card(p)))});
};
async function openCloudShare(){
  const b=current();if(!b)return;if(b._role!=='owner'){toast('Only the board owner can change sharing');return}
  await syncAll();
  const {data:fresh}=await sb.from('boards').select('share_token,collaborate_token,visibility').eq('id',b.id).single();
  if(fresh){b._shareToken=fresh.share_token;b._collaborateToken=fresh.collaborate_token;b._visibility=fresh.visibility}
  const body=$('#shareCloudBody');body.innerHTML=`
    <button class="share-choice" id="copyViewLink">🔗 Copy view-only link<small>Anyone with the link can look at this board. They cannot edit it.</small></button>
    <button class="share-choice" id="copyCollabLink">👥 Copy collaboration link<small>They’ll sign in, then both of you can edit the same live board.</small></button>
    <button class="share-choice" id="disableLinks">🔒 Turn off old links<small>Makes the board private again and replaces both share links.</small></button>
    <div class="collab-list"><div class="project-section-title">Collaborators</div><div id="collabRows">Loading…</div></div>`;
  $('#shareCloudModal').classList.add('show');
  $('#copyViewLink').onclick=async()=>{await sb.from('boards').update({visibility:'link_view'}).eq('id',b.id);b._visibility='link_view';await copyShare(APP_URL+'#view='+b._shareToken,'View link copied')};
  $('#copyCollabLink').onclick=()=>copyShare(APP_URL+'#join='+b._collaborateToken,'Collaboration link copied');
  $('#disableLinks').onclick=async()=>{await sb.from('boards').update({visibility:'private'}).eq('id',b.id);const {data}=await sb.rpc('rotate_board_tokens',{bid:b.id});const row=Array.isArray(data)?data[0]:data;if(row){b._shareToken=row.share_token;b._collaborateToken=row.collaborate_token}b._visibility='private';toast('Old links turned off')};
  loadCollaborators(b.id);
}
async function copyShare(url,msg){
  try{if(navigator.share)await navigator.share({title:current()?.title||'Inspo board',url});else await navigator.clipboard.writeText(url);toast(msg)}catch(e){if(e?.name!=='AbortError')toast('Could not share link')}
}
async function loadCollaborators(bid){
  const el=$('#collabRows');const {data,error}=await sb.rpc('board_collaborators',{bid});if(error){el.textContent='Could not load collaborators.';return}
  if(!data?.length){el.textContent='No collaborators yet.';return}el.innerHTML='';
  data.forEach(m=>{const row=document.createElement('div');row.className='collab-row';row.innerHTML=`<div class="who"><b>${escapeHTML(m.display_name||m.email||'Collaborator')}</b><span>${escapeHTML(m.email||'')} · ${escapeHTML(m.role)}</span></div><button>Remove</button>`;row.querySelector('button').onclick=async()=>{await sb.rpc('remove_board_collaborator',{bid,member_id:m.user_id});loadCollaborators(bid);toast('Collaborator removed')};el.appendChild(row)})
}
$('#shareBoard').onclick=openCloudShare;

async function joinPending(){
  const token=tokenFromUrl('join')||localStorage.getItem('inspoPendingJoin');if(!token||!cloudUser)return false;if(!uuidRe.test(token)){localStorage.removeItem('inspoPendingJoin');toast('That collaboration link is not valid');return false}
  const {data,error}=await sb.rpc('join_board_as_editor',{token});if(error){toast('That collaboration link could not be used');return false}
  localStorage.removeItem('inspoPendingJoin');scrubShareToken();await loadCloud();if(data)openBoard(data);toast('Board added to Shared With Me');return true
}
async function publicView(token){
  document.querySelector('.shell').style.display='none';$('#authGate').classList.remove('show');if(!uuidRe.test(token)){document.body.insertAdjacentHTML('beforeend','<div class="public-wrap"><h1>Board unavailable</h1><p class="sub">This link is not valid.</p></div>');return}
  const {data,error}=await sb.rpc('public_board_snapshot',{token});
  if(error||!data){document.body.insertAdjacentHTML('beforeend','<div class="public-wrap"><h1>Board unavailable</h1><p class="sub">This link may have been turned off.</p></div>');return}
  const b=data.board,items=data.items||[];document.body.insertAdjacentHTML('beforeend',`<main class="public-wrap"><div class="eyebrow">shared inspo board</div><h1>${escapeHTML((b.icon?b.icon+' ':'')+b.title)}</h1><p class="sub">${escapeHTML(b.subtitle||'')}</p><div class="public-grid">${items.map(x=>{const imageUrl=safeImageUrl(x.image_url),sourceUrl=safeHttpUrl(x.source_url);return `<article class="public-card">${imageUrl?`<img src="${escapeHTML(imageUrl)}" alt="" referrerpolicy="no-referrer">`:''}<div class="public-info"><div class="public-store">${escapeHTML(x.source_name||'Inspo')}</div><div class="public-title">${escapeHTML(x.title||'Untitled find')}</div><div class="public-meta">${[x.price,x.size,x.reviews,x.condition].filter(Boolean).map(escapeHTML).join(' · ')}</div>${sourceUrl?`<a class="public-open" href="${escapeHTML(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>`:''}</div></article>`}).join('')}</div></main>`);
}
function subscribeRealtime(){
  if(channel)sb.removeChannel(channel);
  channel=sb.channel('inspo-cloud')
    .on('postgres_changes',{event:'*',schema:'public',table:'boards'},scheduleReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'items'},scheduleReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'saved_items'},scheduleReload)
    .on('postgres_changes',{event:'*',schema:'public',table:'board_members'},scheduleReload)
    .subscribe()
}
let reloadTimer=null;function scheduleReload(){if(syncing)return;clearTimeout(reloadTimer);reloadTimer=setTimeout(async()=>{const open=currentId;await loadCloud();if(open&&projects.some(p=>p.id===open))openBoard(open)},650)}
async function onSession(session){
  cloudUser=session?.user||null;
  if(!cloudUser){projects=[];currentId=null;$('#cloudUserBar').hidden=true;showGate();window.dispatchEvent(new CustomEvent('inspo-session',{detail:{signedIn:false}}));return}
  showGate('Loading your private boards…');
  prepareUserCache();
  $('#cloudUserBar').hidden=false;
  $('#cloudUserText').textContent=cloudUser.email||'Signed in';
  subscribeRealtime();
  await loadCloud();
  hideGate();
  loadMyProfile().catch(e=>console.warn('Profile load',e));
  joinPending().catch(e=>console.warn('Pending join',e));
  window.dispatchEvent(new CustomEvent('inspo-session',{detail:{signedIn:true}}))
}
async function start(){
  injectUI();await loadAuthCapabilities();showGate('Loading your private boards…');
  const viewToken=tokenFromUrl('view');
  if(viewToken){scrubShareToken();await publicView(viewToken);return}
  const joinToken=tokenFromUrl('join');
  if(joinToken){if(uuidRe.test(joinToken))localStorage.setItem('inspoPendingJoin',joinToken);scrubShareToken()}
  const {data:{session}}=await sb.auth.getSession();await onSession(session);
  sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='SIGNED_OUT')setTimeout(()=>onSession(session),0)});
}
start();
})();
