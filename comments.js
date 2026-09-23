(()=>{
  const cache=new Map();
  let openBoardId='',openItemId='',loadingBoards=new Set();

  function boardComments(boardId){return cache.get(boardId)||{}}
  function itemComments(boardId,itemId){return boardComments(boardId)[itemId]||[]}
  function currentBoard(){return typeof current==='function'?current():null}
  function currentItem(){
    try{
      const a=typeof boardList==='function'?boardList():[];
      return a[idx]||null;
    }catch{return null}
  }
  function groupRows(rows){
    const map={};
    (rows||[]).forEach(row=>(map[row.item_id]||(map[row.item_id]=[])).push(row));
    return map;
  }
  async function load(boardId){
    if(!boardId||loadingBoards.has(boardId)||!window.inspoCloudApi?.getBoardComments)return;
    loadingBoards.add(boardId);
    try{
      const rows=await window.inspoCloudApi.getBoardComments(boardId);
      cache.set(boardId,groupRows(rows));
      decorate();
      if(openBoardId===boardId&&openItemId)renderModal();
    }catch(e){console.warn('Comments load',e)}
    finally{loadingBoards.delete(boardId)}
  }
  function buttonText(n){return n?('💬 '+n+' comment'+(n===1?'':'s')):'💬 Comment'}
  function decorate(){
    const b=currentBoard();if(!b)return;

    const swipeLikes=document.getElementById('swipeLikes');
    const x=currentItem();
    if(swipeLikes&&x){
      let wrap=document.getElementById('swipeCommentArea');
      if(!wrap){
        wrap=document.createElement('div');wrap.id='swipeCommentArea';wrap.className='swipe-comment-area';
        swipeLikes.insertAdjacentElement('afterend',wrap);
      }
      const comments=itemComments(b.id,x.id),latest=comments[comments.length-1];
      wrap.innerHTML='';
      const btn=document.createElement('button');btn.type='button';btn.className='comment-open-btn';btn.textContent=buttonText(comments.length);
      btn.onclick=()=>openComments(b.id,x.id);
      wrap.appendChild(btn);
      if(latest){
        const peek=document.createElement('div');peek.className='comment-peek';
        const name=document.createElement('b');name.textContent=latest.display_name||'User';
        const body=document.createElement('span');body.textContent=latest.body||'';
        peek.append(name,document.createTextNode(' '),body);
        wrap.appendChild(peek);
      }
    }

    document.querySelectorAll('#moodgrid .tile[data-item-id]').forEach(tile=>{
      const itemId=tile.dataset.itemId,info=tile.querySelector('.tile-info');
      if(!itemId||!info)return;
      let btn=info.querySelector('.tile-comment-btn');
      if(!btn){
        btn=document.createElement('button');btn.type='button';btn.className='tile-comment-btn';
        btn.onclick=e=>{e.stopPropagation();openComments(b.id,itemId)};
        info.appendChild(btn);
      }
      const n=itemComments(b.id,itemId).length;
      btn.textContent=n?('💬 '+n):'💬';
      btn.setAttribute('aria-label',n?(n+' comments'):'Add comment');
    });
  }
  function initials(name='User'){
    const parts=String(name).trim().split(/\s+/).filter(Boolean);
    return (parts.length>1?(parts[0][0]+parts[parts.length-1][0]):String(name).slice(0,2)).toUpperCase();
  }
  function face(row){
    const el=document.createElement('span');el.className='comment-face';
    const img=typeof safeImageUrl==='function'?safeImageUrl(row.avatar_url||''):'';
    if(img){const im=document.createElement('img');im.src=img;im.alt='';im.referrerPolicy='no-referrer';el.appendChild(im)}
    else el.textContent=initials(row.display_name||'User');
    return el;
  }
  function ensureModal(){
    let modal=document.getElementById('commentsModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='commentsModal';modal.className='overlay';
    modal.innerHTML='<div class="sheet comments-sheet"><div class="sheet-head"><div><h2>Comments</h2><div id="commentsItemTitle" class="comments-item-title"></div></div><button id="closeComments" class="close">×</button></div><div id="commentsList" class="comments-list"></div><div class="comment-compose"><textarea id="commentText" maxlength="800" placeholder="Add a comment…"></textarea><button id="postComment" class="primary">Post comment</button><div id="commentStatus" class="status"></div></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#closeComments').onclick=()=>modal.classList.remove('show');
    modal.onclick=e=>{if(e.target===modal)modal.classList.remove('show')};
    modal.querySelector('#postComment').onclick=postComment;
    return modal;
  }
  async function openComments(boardId,itemId){
    openBoardId=boardId;openItemId=itemId;
    const modal=ensureModal();modal.classList.add('show');
    renderModal();
    await load(boardId);
    renderModal();
    setTimeout(()=>modal.querySelector('#commentText')?.focus(),80);
  }
  function renderModal(){
    const modal=ensureModal(),list=modal.querySelector('#commentsList');
    const b=projects.find(p=>p.id===openBoardId),x=b?.items?.find(i=>i.id===openItemId);
    modal.querySelector('#commentsItemTitle').textContent=x?.title||'This find';
    const rows=itemComments(openBoardId,openItemId);
    list.innerHTML='';
    if(!rows.length){
      const empty=document.createElement('div');empty.className='comments-empty';empty.textContent='No comments yet. Be the first to add one.';
      list.appendChild(empty);return;
    }
    rows.forEach(row=>{
      const card=document.createElement('div');card.className='comment-row';
      card.appendChild(face(row));
      const body=document.createElement('div');body.className='comment-body';
      const top=document.createElement('div');top.className='comment-top';
      const name=document.createElement('b');name.textContent=row.display_name||'User';
      const time=document.createElement('span');
      try{time.textContent=new Date(row.created_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{time.textContent=''}
      top.append(name,time);
      const text=document.createElement('div');text.className='comment-text';text.textContent=row.body||'';
      body.append(top,text);
      if(row.can_delete){
        const del=document.createElement('button');del.type='button';del.className='comment-delete';del.textContent='Delete';
        del.onclick=async()=>{
          if(!confirm('Delete this comment?'))return;
          try{await window.inspoCloudApi.deleteItemComment(row.comment_id);await load(openBoardId);renderModal();decorate()}
          catch(e){toast('Could not delete comment')}
        };
        body.appendChild(del);
      }
      card.appendChild(body);list.appendChild(card);
    });
    list.scrollTop=list.scrollHeight;
  }
  async function postComment(){
    const modal=ensureModal(),input=modal.querySelector('#commentText'),status=modal.querySelector('#commentStatus'),btn=modal.querySelector('#postComment');
    const body=input.value.trim();if(!body){status.textContent='Write a comment first.';return}
    btn.disabled=true;btn.textContent='Posting…';status.textContent='';
    try{
      await window.inspoCloudApi.addItemComment(openBoardId,openItemId,body);
      input.value='';
      await load(openBoardId);
      renderModal();decorate();
    }catch(e){status.textContent=e?.message||'Could not post comment.'}
    finally{btn.disabled=false;btn.textContent='Post comment'}
  }

  window.addEventListener('inspo-comments-changed',()=>{
    const b=currentBoard();if(b)load(b.id);
  });
  window.addEventListener('focus',()=>{const b=currentBoard();if(b)load(b.id)});
  window.inspoComments={load,decorate,open:openComments};
})();