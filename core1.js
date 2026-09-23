const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const safeJSON=(s,d)=>{try{return JSON.parse(s)}catch{return d}};
const clone=o=>JSON.parse(JSON.stringify(o));
const now=()=>Date.now();
function seedBoard(){return{id:'blink-182-birthday',type:'inspo',icon:'🖤',title:'Blink-182 Birthday Fits',subtitle:'Grunge outfit ideas for the birthday party.',created:now(),updated:now(),items:clone(starterItems),saved:[]}}
function loadProjects(){
  const raw=localStorage.getItem(KEY); let p=raw===null?[]:safeJSON(raw,[]);
  if(!Array.isArray(p))p=[];
  if(!localStorage.getItem(MIG)){
    const b=p.find(x=>x.id==='blink-182-birthday');
    if(b){
      const oldCustom=safeJSON(localStorage.getItem('blinkCustomFinds'),[]);
      const oldSaved=safeJSON(localStorage.getItem('blinkSaved'),[]);
      if(Array.isArray(oldCustom))oldCustom.forEach(x=>{if(x?.url&&!b.items.some(i=>i.url===x.url))b.items.push({...x,id:x.id||'old-'+now()})});
      if(Array.isArray(oldSaved))b.saved=[...new Set([...(b.saved||[]),...oldSaved])];
    }
    localStorage.setItem(MIG,'1'); localStorage.setItem(KEY,JSON.stringify(p));
  }
  return p;
}
let projects=loadProjects(), currentId=null, filter='all', idx=0, viewMode='grid', savedMode='browse', editBoardId=null, editItemId=null, boardTypeChoice='inspo';
const current=()=>projects.find(p=>p.id===currentId);
function persist(){localStorage.setItem(KEY,JSON.stringify(projects))}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function sourceName(url,publisher=''){
  let host='';try{host=new URL(url).hostname.toLowerCase()}catch{}
  const p=String(publisher||'').toLowerCase();
  const has=s=>host.includes(s)||p.includes(s);
  if(has('vinted'))return'Vinted';if(has('amazon')||host==='a.co')return'Amazon';if(has('poshmark'))return'Poshmark';if(has('pinterest'))return'Pinterest';if(has('etsy'))return'Etsy';if(has('target'))return'Target';if(has('walmart'))return'Walmart';if(has('ebay'))return'eBay';if(has('depop'))return'Depop';if(has('facebook')||host==='fb.me'||host==='fb.watch')return'Facebook';
  if(publisher)return publisher.replace(/\s*\|.*$/,'').replace(/^www\./i,'').trim();
  if(!host)return'Inspo';return host.replace(/^www\./,'').split('.')[0].replace(/^./,c=>c.toUpperCase())
}
function renderHome(){
  $('#homeView').hidden=false; $('#boardView').hidden=true; const wrap=$('#projects'); wrap.innerHTML='';
  $('#emptyHome').hidden=projects.length!==0;
  [...projects].sort((a,b)=>(b.updated||0)-(a.updated||0)).forEach(p=>{
    const btn=document.createElement('button'); btn.className='project-card';
    const imgs=(p.items||[]).filter(x=>x.image).slice(0,4);
    let cover=imgs.length?'<div class="cover">'+imgs.map(x=>`<img src="${escapeHTML(x.image)}" alt="" referrerpolicy="no-referrer">`).join('')+'</div>':`<div class="cover empty">${escapeHTML(p.icon||'✦')}</div>`;
    const saved=(p.saved||[]).length, count=(p.items||[]).length;
    btn.innerHTML=cover+`<div class="pc-body"><span class="pill">${p.type==='project'?'Project board':'Inspo board'}</span><div class="pc-title">${escapeHTML(p.icon||'')} ${escapeHTML(p.title)}</div><div class="pc-sub">${escapeHTML(p.subtitle||'')}</div><div class="pc-meta">${count} find${count===1?'':'s'}${saved?' · '+saved+' saved':''}</div></div><button class="pc-more" aria-label="Edit board">•••</button>`;
    btn.onclick=e=>{if(e.target.closest('.pc-more')){openBoardModal(p.id);e.stopPropagation();return}openBoard(p.id)};
    wrap.appendChild(btn);
  });
}
function openBoard(id){currentId=id;filter='all';idx=0;viewMode='grid';savedMode='browse';$('#homeView').hidden=true;$('#boardView').hidden=false;window.scrollTo(0,0);renderBoard();setTimeout(()=>{if(typeof hydrateBoardDetails==='function')hydrateBoardDetails(id);window.inspoComments?.load(id)},120)}
function boardList(){const b=current();if(!b)return[];const items=b.items||[];if(filter==='all')return items;if(filter==='saved')return items.filter(x=>(b.saved||[]).includes(x.id));return items.filter(x=>x.source===filter)}
