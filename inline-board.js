(()=>{
  function makeChoice(list,p,inputName){
    if(!list||!p)return;
    const existing=list.querySelector('input[value="'+CSS.escape(p.id)+'"]');
    if(existing){existing.checked=true;return}
    const label=document.createElement('label');label.className='board-multi-option';
    const input=document.createElement('input');input.type='checkbox';input.name=inputName;input.value=p.id;input.checked=true;
    const span=document.createElement('span');span.textContent=(p.icon?p.icon+' ':'')+p.title;
    label.append(input,span);list.appendChild(label);
  }

  function mount(container,opts={}){
    if(!container||container.dataset.inlineBoardReady==='1')return;
    container.dataset.inlineBoardReady='1';
    const list=document.getElementById(opts.listId);
    const inputName=opts.inputName||'board';

    const button=document.createElement('button');
    button.type='button';button.className='inline-board-toggle';button.textContent='＋ Create a new board';

    const form=document.createElement('div');form.className='inline-board-form';form.hidden=true;
    form.innerHTML=
      '<div class="inline-board-row">'+
        '<input class="inline-board-icon" maxlength="4" placeholder="✦" aria-label="Board icon">'+
        '<input class="inline-board-name" maxlength="70" placeholder="Board name" aria-label="Board name">'+
      '</div>'+
      '<select class="inline-board-type" aria-label="Board type"><option value="inspo">Inspo board</option><option value="project">Project board</option></select>'+
      '<button type="button" class="inline-board-create">Create + select board</button>'+
      '<div class="inline-board-status"></div>';

    container.append(button,form);
    button.onclick=()=>{form.hidden=!form.hidden;if(!form.hidden)setTimeout(()=>form.querySelector('.inline-board-name')?.focus(),40)};

    form.querySelector('.inline-board-create').onclick=async()=>{
      const create=form.querySelector('.inline-board-create');
      const status=form.querySelector('.inline-board-status');
      const name=form.querySelector('.inline-board-name').value.trim();
      const icon=form.querySelector('.inline-board-icon').value.trim()||'✦';
      const type=form.querySelector('.inline-board-type').value||'inspo';
      if(!name){status.textContent='Give the board a name first.';return}
      if(!window.inspoCloudApi?.createBoard){status.textContent='Board creation is not ready yet.';return}

      const user=window.inspoCloudApi.getUser?.();
      if(!user){status.textContent='Sign in first.';return}

      const p={
        id:crypto.randomUUID(),type,icon,title:name,subtitle:'',
        created:Date.now(),updated:Date.now(),items:[],saved:[],
        _ownerId:user.id,_role:'owner',_cloud:false
      };

      create.disabled=true;create.textContent='Creating…';status.textContent='';
      projects.unshift(p);
      try{
        await window.inspoCloudApi.createBoard(p);
        makeChoice(list,p,inputName);
        form.querySelector('.inline-board-name').value='';
        form.querySelector('.inline-board-icon').value='';
        form.querySelector('.inline-board-type').value='inspo';
        form.hidden=true;
        button.textContent='✓ '+name+' created';
        setTimeout(()=>button.textContent='＋ Create another board',1400);
      }catch(e){
        projects=projects.filter(x=>x.id!==p.id);
        window.inspoCloudApi.saveLocalOnly?.();
        status.textContent='Could not create that board. Try again.';
      }finally{
        create.disabled=false;create.textContent='Create + select board';
      }
    };
  }

  window.inspoInlineBoardCreator={mount};
})();