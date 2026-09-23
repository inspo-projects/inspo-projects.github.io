(function(){
var APP_URL='https://inspo-projects.github.io/';
var IPHONE_SHORTCUT_URL=''; // Paste the published iCloud Shortcut link here once created.
var PENDING_KEY='inspoPendingSharedFind';
var installPrompt=null;
var sharedOpen=false;

function q(id){return document.getElementById(id)}
function currentUser(){return window.inspoCloudApi&&window.inspoCloudApi.getUser?window.inspoCloudApi.getUser():null}
function usableSharedTitle(value,url){
  var s=String(value||'').trim();
  if(!s)return '';
  if(typeof genericListingTitle==='function'&&genericListingTitle(s))return '';
  if(typeof isDepopUrl==='function'&&isDepopUrl(url)&&/^(?=.{8,24}$)(?=.*[a-z])(?=.*[A-Z0-9])[A-Za-z0-9_-]+$/.test(s))return '';
  return s;
}
function extractUrl(text){
  var m=String(text||'').match(/https?:\/\/[^\s<>]+/i);
  return m?safeHttpUrl(m[0].replace(/[),.;!?]+$/,'')):'';
}
function captureIncoming(){
  var u=new URL(location.href);
  if(u.searchParams.get('share_target')!=='1')return false;
  var url=safeHttpUrl(u.searchParams.get('shared_url'))||extractUrl(u.searchParams.get('shared_text'));
  if(url){
    localStorage.setItem(PENDING_KEY,JSON.stringify({
      url:url,
      title:u.searchParams.get('shared_title')||'',
      text:u.searchParams.get('shared_text')||'',
      received:Date.now()
    }));
  }
  history.replaceState(null,'',APP_URL);
  return !!url;
}
function ensureUI(){
  if(!q('sharedFindModal')){
    document.body.insertAdjacentHTML('beforeend',
      '<div id="sharedFindModal" class="overlay"><div class="sheet">'+
      '<div class="sheet-head"><h2>Save shared find</h2><button class="close" id="closeSharedFind">×</button></div>'+
      '<div id="sharedFindBody"></div></div></div>'+
      '<div id="phoneShareModal" class="overlay"><div class="sheet">'+
      '<div class="sheet-head"><h2>Phone sharing</h2><button class="close" id="closePhoneShare">×</button></div>'+
      '<div id="phoneShareBody"></div></div></div>'+
      '<div id="pasteLinkModal" class="overlay"><div class="sheet">'+
      '<div class="sheet-head"><h2>Paste a link</h2><button class="close" id="closePasteLink">×</button></div>'+
      '<div class="field"><label>Product or inspo link</label><input id="pasteLinkInput" type="url" inputmode="url" placeholder="Paste the link here"></div>'+
      '<button id="usePastedLink" class="primary">Add this find</button><div id="pasteLinkStatus" class="hintline"></div></div></div>'
    );
    q('closeSharedFind').onclick=function(){closeShared(true)};
    q('closePhoneShare').onclick=function(){q('phoneShareModal').classList.remove('show')};
    q('closePasteLink').onclick=function(){q('pasteLinkModal').classList.remove('show')};
    q('usePastedLink').onclick=useManualPastedLink;
    q('sharedFindModal').onclick=function(e){if(e.target.id==='sharedFindModal')closeShared(true)};
    q('phoneShareModal').onclick=function(e){if(e.target.id==='phoneShareModal')q('phoneShareModal').classList.remove('show')};
    q('pasteLinkModal').onclick=function(e){if(e.target.id==='pasteLinkModal')q('pasteLinkModal').classList.remove('show')};
  }
  var home=document.querySelector('.home-actions');
  if(home&&!q('pasteLinkBtn')){
    home.insertAdjacentHTML('beforeend','<button id="pasteLinkBtn" class="share-setup-btn">＋ Paste link</button><button id="phoneSharingSetup" class="share-setup-btn">↗ Phone sharing</button>');
    q('pasteLinkBtn').onclick=pasteLinkFlow;
    q('phoneSharingSetup').onclick=openPhoneSetup;
  }
}
function closeShared(discard){
  if(q('sharedFindModal'))q('sharedFindModal').classList.remove('show');
  sharedOpen=false;
  if(discard)localStorage.removeItem(PENDING_KEY);
}
async function previewShared(data){
  var incomingTitle=usableSharedTitle(data.title,data.url);
  var base={
    url:data.url,
    title:incomingTitle||sourceName(data.url)+' listing',
    image:'',
    source:sourceName(data.url),
    price:'',
    size:'',
    reviews:'',
    condition:''
  };
  var depop=typeof isDepopUrl==='function'&&isDepopUrl(data.url);
  var attempts=depop?3:1;

  for(var i=0;i<attempts;i++){
    try{
      var d=await previewDetails(base.url);
      var resolved=safeHttpUrl(d.resolvedUrl)||'';
      if(resolved)base.url=resolved;

      var detailTitle=usableSharedTitle(d.title,base.url);
      if(detailTitle)base.title=detailTitle;

      base.image=safeImageUrl(d.image)||base.image;
      base.source=sourceName(base.url,d.source);
      base.price=d.price||base.price;
      base.size=d.size||base.size;
      base.reviews=d.reviews||base.reviews;
      base.condition=d.condition||base.condition;

      if(base.image||!depop)return base;
    }catch(ignore){}

    if(i<attempts-1){
      await new Promise(function(resolve){setTimeout(resolve,700*(i+1))});
    }
  }

  try{
    var p=await preview(base.url);
    var fallbackTitle=usableSharedTitle(p.title,base.url);
    if(fallbackTitle)base.title=fallbackTitle;
    base.image=safeImageUrl(p.image)||base.image;
    base.source=sourceName(base.url,p.source);
  }catch(ignore){}

  return base;
}
function boardOptions(){
  return (projects||[]).filter(function(p){return p._role!=='viewer'});
}
async function openPending(){
  ensureUI();
  if(sharedOpen||!currentUser())return false;
  var raw=localStorage.getItem(PENDING_KEY);
  if(!raw)return false;
  var data=safeJSON(raw,null);
  if(!data||!safeHttpUrl(data.url)){localStorage.removeItem(PENDING_KEY);return false}
  sharedOpen=true;
  q('sharedFindBody').innerHTML='<div class="shared-loading">Pulling in the product…</div>';
  q('sharedFindModal').classList.add('show');
  var info=await previewShared(data);
  if(!sharedOpen)return false;
  var boards=boardOptions();
  var defaultBoard=(typeof currentId!=='undefined'&&boards.some(function(b){return b.id===currentId}))?currentId:(boards[0]&&boards[0].id);
  var boardChoices='<div id="sharedBoardChoices" class="board-multi-list">';
  boards.forEach(function(b){
    boardChoices+='<label class="board-multi-option"><input type="checkbox" name="sharedBoard" value="'+escapeHTML(b.id)+'" '+(b.id===defaultBoard?'checked':'')+'><span>'+escapeHTML((b.icon?b.icon+' ':'')+b.title)+'</span></label>';
  });
  boardChoices+='<label class="board-multi-option"><input type="checkbox" name="sharedBoard" value="__quick__" '+(!boards.length?'checked':'')+'><span>✦ Quick Saves</span></label></div>';
  q('sharedFindBody').innerHTML=
    '<div class="shared-preview">'+
      (info.image?'<img src="'+escapeHTML(info.image)+'" alt="" referrerpolicy="no-referrer">':'<div class="shared-preview-ph">✦</div>')+
      '<div><span>'+escapeHTML(info.source||'Inspo')+'</span><b>'+escapeHTML(info.title||'Shared find')+'</b>'+
      '<small>'+escapeHTML(info.price||'')+'</small></div>'+
    '</div>'+
    '<div class="field"><label>Save to one or more boards</label>'+boardChoices+'<div id="sharedBoardStatus" class="hintline"></div></div>'+
    '<button id="saveSharedFind" class="primary">Save find</button>'+
    '<button id="cancelSharedFind" class="share-cancel">Not now</button>';
  q('cancelSharedFind').onclick=function(){closeShared(true)};
  q('saveSharedFind').onclick=async function(){
    var btn=q('saveSharedFind'),status=q('sharedBoardStatus');
    var ids=Array.from(document.querySelectorAll('input[name="sharedBoard"]:checked')).map(function(el){return el.value});
    if(!ids.length){status.textContent='Choose at least one board.';return}
    btn.disabled=true;btn.textContent='Saving…';status.textContent='';
    var user=currentUser(),targets=[];
    for(var id of ids){
      var b=(projects||[]).find(function(x){return x.id===id});
      if(id==='__quick__'){
        b=(projects||[]).find(function(x){return x._role==='owner'&&x.title==='Quick Saves'});
        if(!b){
          b={id:crypto.randomUUID(),type:'inspo',icon:'✦',title:'Quick Saves',subtitle:'Things I shared to Inspo Projects.',created:now(),updated:now(),items:[],saved:[],_ownerId:user.id,_role:'owner',_cloud:false};
          projects.unshift(b);
        }
      }
      if(b&&!targets.some(function(t){return t.id===b.id}))targets.push(b);
    }

    var savedBoards=[],skipped=0,failed=0,pending=[];
    for(var b of targets){
      b.items=b.items||[];
      if(info.url&&b.items.some(function(x){return x.url===info.url})){skipped++;continue}
      var item={id:crypto.randomUUID(),url:info.url,title:info.title,image:info.image,tag:'',source:info.source,price:info.price,size:info.size,reviews:info.reviews,condition:info.condition,detailsChecked:Date.now(),_createdBy:user.id};
      b.items.unshift(item);b.updated=now();
      pending.push({board:b,item:item});
    }

    if(window.inspoCloudApi?.saveLocalOnly)window.inspoCloudApi.saveLocalOnly();

    var results=await Promise.allSettled(pending.map(function(row){
      if(window.inspoCloudApi&&window.inspoCloudApi.saveItemToBoard)return window.inspoCloudApi.saveItemToBoard(row.board,row.item);
      if(window.inspoCloudApi&&window.inspoCloudApi.sync)return window.inspoCloudApi.sync();
      return Promise.resolve(true);
    }));

    results.forEach(function(result,i){
      var row=pending[i];
      if(result.status==='fulfilled')savedBoards.push(row.board);
      else{
        failed++;
        row.board.items=row.board.items.filter(function(x){return x.id!==row.item.id});
      }
    });
    if(failed&&window.inspoCloudApi?.saveLocalOnly)window.inspoCloudApi.saveLocalOnly();

    if(!savedBoards.length&&failed){
      btn.disabled=false;btn.textContent='Save find';status.textContent='Could not save the find. Try again.';return;
    }
    localStorage.removeItem(PENDING_KEY);closeShared(false);
    if(savedBoards[0])openBoard(savedBoards[0].id);
    var msg=savedBoards.length?'Saved to '+savedBoards.length+' board'+(savedBoards.length===1?'':'s'):'Already on the selected board'+(targets.length===1?'':'s');
    if(skipped&&savedBoards.length)msg+=' · '+skipped+' already had it';
    toast(msg);
  };
  return true;
}

function queueSharedUrl(url,title=''){
  url=safeHttpUrl(url);
  if(!url)return false;
  localStorage.setItem(PENDING_KEY,JSON.stringify({url:url,title:title||'',text:'',received:Date.now()}));
  return true;
}
async function pasteLinkFlow(){
  ensureUI();
  var text='';
  try{
    if(navigator.clipboard&&navigator.clipboard.readText)text=await navigator.clipboard.readText();
  }catch(e){}
  var url=extractUrl(text)||safeHttpUrl(text);
  if(url){
    queueSharedUrl(url);
    await openPending();
    return;
  }
  q('pasteLinkInput').value='';
  q('pasteLinkStatus').textContent='Copy a product link first, then paste it here.';
  q('pasteLinkModal').classList.add('show');
  setTimeout(function(){q('pasteLinkInput').focus()},100);
}
function useManualPastedLink(){
  var raw=q('pasteLinkInput').value.trim();
  var url=extractUrl(raw)||safeHttpUrl(raw);
  if(!url){
    q('pasteLinkStatus').textContent='That does not look like a normal web link yet.';
    return;
  }
  q('pasteLinkModal').classList.remove('show');
  queueSharedUrl(url);
  openPending();
}
function openPhoneSetup(){
  ensureUI();
  var standalone=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;
  q('phoneShareBody').innerHTML=
    '<div class="phone-share-block"><div class="phone-share-kicker">ANDROID</div>'+
    '<b>Share straight to Inspo Projects</b>'+
    '<p>'+(standalone?'This app is installed. Share a product link and choose Inspo Projects.':'Install the app first. Then Inspo Projects can appear in your phone Share menu.')+'</p>'+
    '<button id="installInspo" class="primary">'+(standalone?'Installed ✓':'Install Inspo Projects')+'</button>'+
    '<div id="installHelp" class="hintline"></div></div>'+
    '<div class="phone-share-block"><div class="phone-share-kicker">IPHONE</div>'+
    '<b>Set up iPhone sharing</b>'+
    '<p>For the easiest setup, add Inspo Projects to your Home Screen and install the one-tap Share Shortcut.</p>'+
    '<button id="installIphoneShortcut" class="share-choice iphone-primary">🍎 Add Inspo to my Share Menu<small>'+(IPHONE_SHORTCUT_URL?'One-time setup. Tap Get Shortcut on the next screen.':'The shortcut install link still needs to be published once.')+'</small></button>'+
    '<button id="showIphoneHomeSteps" class="share-choice">▣ Add Inspo Projects to my Home Screen<small>Safari → Share → Add to Home Screen → Open as Web App.</small></button>'+
    '<p class="iphone-save-note">If you skip the shortcut, you can still use Share → Copy Link → open Inspo Projects → <b>Paste link</b>.</p>'+
    '<button id="iphonePasteHelp" class="share-choice">Use Paste link instead<small>No Shortcut setup needed.</small></button></div>';
  q('phoneShareModal').classList.add('show');
  q('installInspo').onclick=async function(){
    if(standalone)return;
    if(installPrompt){
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt=null;
    }else{
      q('installHelp').textContent='In Chrome, tap ⋮ and choose Install app or Add to Home screen. Then reopen Inspo Projects from the new icon.';
    }
  };
  q('installIphoneShortcut').onclick=function(){
    if(!IPHONE_SHORTCUT_URL){
      toast('Shortcut install link is not published yet');
      return;
    }
    location.href=IPHONE_SHORTCUT_URL;
  };
  q('showIphoneHomeSteps').onclick=function(){
    q('phoneShareBody').insertAdjacentHTML('beforeend',
      '<div id="iphoneHomeSteps" class="iphone-steps"><b>Add to Home Screen</b><p>1. Open Inspo Projects in Safari.<br>2. Tap Share.<br>3. Tap Add to Home Screen.<br>4. Turn on Open as Web App.<br>5. Tap Add.</p><button id="copyIphoneAppLink" class="share-choice">Copy app link</button></div>');
    q('showIphoneHomeSteps').disabled=true;
    q('copyIphoneAppLink').onclick=async function(){
      try{await navigator.clipboard.writeText(APP_URL);toast('App link copied')}
      catch(e){toast('Could not copy app link')}
    };
  };
  q('iphonePasteHelp').onclick=function(){q('phoneShareModal').classList.remove('show');pasteLinkFlow()};
}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();installPrompt=e});
window.addEventListener('appinstalled',function(){installPrompt=null;toast('Inspo Projects installed')});
window.addEventListener('inspo-session',function(e){if(e.detail&&e.detail.signedIn)setTimeout(openPending,50)});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js?v=4',{updateViaCache:'none'}).catch(function(){})}
captureIncoming();
ensureUI();
setTimeout(function(){if(currentUser())openPending()},700);
})();