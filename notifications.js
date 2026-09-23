(()=>{
  let rows=[],known=new Set(),initialized=false;

  function api(){return window.inspoCloudApi}
  function initials(name='Someone'){
    const p=String(name).trim().split(/\s+/).filter(Boolean);
    return (p.length>1?(p[0][0]+p[p.length-1][0]):String(name).slice(0,2)).toUpperCase();
  }
  function ensureUI(){
    const bar=document.getElementById('cloudUserBar');if(!bar)return false;
    if(!document.getElementById('notificationBell')){
      const btn=document.createElement('button');btn.id='notificationBell';btn.className='notification-bell';btn.type='button';btn.setAttribute('aria-label','Notifications');btn.innerHTML='🔔<span id="notificationBadge" class="notification-badge" hidden></span>';
      const signout=document.getElementById('cloudSignOut');bar.insertBefore(btn,signout);
      btn.onclick=openModal;
    }
    if(!document.getElementById('notificationModal')){
      document.body.insertAdjacentHTML('beforeend','<div id="notificationModal" class="overlay"><div class="sheet notification-sheet"><div class="sheet-head"><h2>Notifications</h2><button id="closeNotifications" class="close">×</button></div><div class="notification-actions"><button id="enableDeviceAlerts">Enable device alerts</button><button id="markAllNotifications">Mark all read</button></div><div id="notificationList" class="notification-list"></div></div></div>');
      document.getElementById('closeNotifications').onclick=()=>document.getElementById('notificationModal').classList.remove('show');
      document.getElementById('notificationModal').onclick=e=>{if(e.target.id==='notificationModal')e.currentTarget.classList.remove('show')};
      document.getElementById('markAllNotifications').onclick=markAll;
      document.getElementById('enableDeviceAlerts').onclick=enableAlerts;
    }
    return true;
  }
  function face(row){
    const el=document.createElement('span');el.className='notification-face';
    const src=typeof safeImageUrl==='function'?safeImageUrl(row.actor_avatar||''):'';
    if(src){const im=document.createElement('img');im.src=src;im.alt='';im.referrerPolicy='no-referrer';el.appendChild(im)}
    else el.textContent=initials(row.actor_name||'Someone');
    return el;
  }
  function render(){
    if(!ensureUI())return;
    const unread=rows.filter(r=>!r.read_at).length,badge=document.getElementById('notificationBadge');
    badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);
    const list=document.getElementById('notificationList');list.innerHTML='';
    if(!rows.length){list.innerHTML='<div class="notification-empty">No notifications yet.</div>';return}
    rows.forEach(row=>{
      const card=document.createElement('button');card.type='button';card.className='notification-row'+(row.read_at?'':' unread');
      card.appendChild(face(row));
      const copy=document.createElement('div');copy.className='notification-copy';
      const title=document.createElement('b');title.textContent=(row.actor_name||'Someone')+' commented on '+(row.item_title||'a find');
      const body=document.createElement('span');body.textContent=row.body||'';
      const meta=document.createElement('small');
      let when='';try{when=new Date(row.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{}
      meta.textContent=(row.board_title||'Shared board')+(when?' · '+when:'');
      copy.append(title,body,meta);card.appendChild(copy);
      card.onclick=()=>openNotification(row);
      list.appendChild(card);
    });
  }
  async function load(announce=false){
    if(!api()?.getNotifications)return;
    try{
      const fresh=await api().getNotifications(50);
      const newRows=initialized?fresh.filter(r=>!known.has(r.notification_id)&&!r.read_at):[];
      rows=fresh;known=new Set(fresh.map(r=>r.notification_id));initialized=true;render();
      if(announce&&newRows.length)showDeviceAlert(newRows[0]);
    }catch(e){console.warn('Notifications',e)}
  }
  async function openModal(){
    await load(false);document.getElementById('notificationModal').classList.add('show');
  }
  async function markAll(){
    const unread=rows.filter(r=>!r.read_at).map(r=>r.notification_id);
    if(!unread.length)return;
    try{await api().markNotificationsRead(unread);rows.forEach(r=>r.read_at=r.read_at||new Date().toISOString());render()}catch(e){toast('Could not mark notifications read')}
  }
  async function openNotification(row){
    try{if(!row.read_at)await api().markNotificationsRead([row.notification_id])}catch{}
    document.getElementById('notificationModal').classList.remove('show');
    if(row.board_id&&typeof openBoard==='function'){
      openBoard(row.board_id);
      setTimeout(()=>window.inspoComments?.open(row.board_id,row.item_id),180);
    }
    load(false);
  }
  async function enableAlerts(){
    const btn=document.getElementById('enableDeviceAlerts');
    if(!('Notification' in window)){btn.textContent='Device alerts unavailable here';btn.disabled=true;return}
    try{
      const p=await Notification.requestPermission();
      btn.textContent=p==='granted'?'Device alerts enabled':p==='denied'?'Alerts blocked in browser':'Enable device alerts';
      if(p==='granted')toast('Device alerts enabled');
    }catch{btn.textContent='Device alerts unavailable here'}
  }
  async function showDeviceAlert(row){
    if(!('Notification' in window)||Notification.permission!=='granted')return;
    const title=(row.actor_name||'Someone')+' commented';
    const body=(row.board_title?row.board_title+': ':'')+(row.body||'New comment');
    try{
      const reg=await navigator.serviceWorker?.ready;
      if(reg)await reg.showNotification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'comment-'+row.notification_id,data:{url:'/'}});
      else new Notification(title,{body});
    }catch{}
  }
  window.addEventListener('inspo-session',e=>{if(e.detail?.signedIn){setTimeout(()=>load(false),150)}else{rows=[];known.clear();initialized=false;render()}});
  window.addEventListener('inspo-notifications-changed',()=>load(true));
  window.addEventListener('focus',()=>load(false));
  setTimeout(()=>{ensureUI();if(api()?.getUser?.())load(false)},500);
})();