(()=>{
  const KEY='inspoTheme_v1';
  const root=document.documentElement;
  const media=window.matchMedia?.('(prefers-color-scheme: dark)');
  const saved=localStorage.getItem(KEY);
  let theme=saved==='dark'||saved==='light'?saved:(media?.matches?'dark':'light');

  function apply(next,persist=false){
    theme=next==='dark'?'dark':'light';
    root.dataset.theme=theme;
    root.style.colorScheme=theme;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='dark'?'#11100f':'#f5f0e8');
    if(persist)localStorage.setItem(KEY,theme);
    updateButton();
  }
  function updateButton(){
    const btn=document.getElementById('themeToggle');if(!btn)return;
    btn.textContent=theme==='dark'?'☀︎ Light':'☾ Dark';
    btn.setAttribute('aria-label',theme==='dark'?'Switch to light mode':'Switch to dark mode');
  }
  function ensureButton(){
    const bar=document.getElementById('cloudUserBar');
    if(!bar||document.getElementById('themeToggle'))return;
    const btn=document.createElement('button');
    btn.id='themeToggle';btn.className='theme-toggle';btn.type='button';
    const bell=document.getElementById('notificationBell'),signout=document.getElementById('cloudSignOut');
    bar.insertBefore(btn,bell||signout||null);
    btn.onclick=()=>apply(theme==='dark'?'light':'dark',true);
    updateButton();
  }

  apply(theme,false);
  ensureButton();
  window.addEventListener('inspo-session',()=>setTimeout(ensureButton,0));
  document.addEventListener('DOMContentLoaded',ensureButton);
  media?.addEventListener?.('change',e=>{if(!localStorage.getItem(KEY))apply(e.matches?'dark':'light',false)});
})();