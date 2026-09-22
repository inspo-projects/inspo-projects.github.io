const CACHE='inspo-projects-v4';

self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

async function handleShare(request){
  try{
    const form=await request.formData();
    const params=new URLSearchParams();
    params.set('share_target','1');
    const title=form.get('shared_title');
    const text=form.get('shared_text');
    const url=form.get('shared_url');
    if(typeof title==='string'&&title)params.set('shared_title',title);
    if(typeof text==='string'&&text)params.set('shared_text',text);
    if(typeof url==='string'&&url)params.set('shared_url',url);
    return Response.redirect('/?'+params.toString(),303);
  }catch{
    return Response.redirect('/?share_target=1',303);
  }
}

self.addEventListener('fetch',event=>{
  const u=new URL(event.request.url);
  if(u.origin!==location.origin)return;
  if(event.request.method==='POST'&&u.pathname==='/share-target'){
    event.respondWith(handleShare(event.request));
    return;
  }
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
