(()=>{
  const oldToggle=window.toggleSavedItem;
  let busy=new Set();

  window.toggleSavedItem=async function(x){
    const b=typeof current==='function'?current():null;
    if(!b||!x)return;

    const api=window.inspoCloudApi;
    if(!api?.toggleSavedItem){
      if(typeof oldToggle==='function')return oldToggle(x);
      return;
    }

    const key=b.id+':'+x.id;
    if(busy.has(key))return;
    busy.add(key);

    const previousSaved=[...(b.saved||[])];
    const previousFaces={...(b._favoriteFaces||{})};
    try{
      const saved=await api.toggleSavedItem(b.id,x.id);

      b.saved=b.saved||[];
      b.saved=b.saved.filter(id=>id!==x.id);
      if(saved)b.saved.push(x.id);

      saveLocal();
      if(api.refreshFavoriteFaces)await api.refreshFavoriteFaces();
      else renderBoard();

      toast(saved?'Saved ♡':'Removed from saved');
    }catch(e){
      console.warn('Like toggle',e);
      b.saved=previousSaved;
      b._favoriteFaces=previousFaces;
      saveLocal();
      renderBoard();
      toast('Could not sync that like. Try again.');
    }finally{
      busy.delete(key);
    }
  };
})();