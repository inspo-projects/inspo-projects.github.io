function renderCompare(){
  const grid=$('#compareGrid');if(!grid)return;grid.innerHTML='';if(filter!=='saved')return;const b=current(),a=(b.items||[]).filter(x=>(b.saved||[]).includes(x.id));
  if(!a.length){grid.innerHTML='<div class="compare-empty">Save a few finds first, then compare them here.</div>';return}
  a.forEach(x=>{
    const c=document.createElement('article');c.className='cmp-card';
    const imageUrl=safeImageUrl(x.image),sourceUrl=safeHttpUrl(x.url);
    const img=imageUrl?`<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(x.title||'')}" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('missing');this.remove()">`:'<div class="cmp-noimg">Visual unavailable</div>';
    const reviews=x.reviews||x.rating||'—';
    c.innerHTML=`<div class="cmp-media">${img}</div><div class="cmp-info"><div class="cmp-store">${escapeHTML(x.source||'Inspo')}</div><div class="cmp-name">${escapeHTML(x.title||'Untitled find')}</div>${compareRow('Price',x.price)}${compareRow('Size',x.size)}${compareRow('Reviews',reviews)}${compareRow('Condition',x.condition)}${sourceUrl?`<a class="cmp-open" href="${escapeHTML(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a>`:''}</div>`;
    grid.appendChild(c);
  });
}

function compareRow(label,value){
  return `<div class="cmp-row"><span>${label}</span><b>${escapeHTML(value||'—')}</b></div>`;
}

function parseDetails(text=''){
  const s=String(text).replace(/\s+/g,' ').trim(),out={};
  let m=s.match(/(?:US\$|CA\$|AU\$|\$|€|£)\s?\d+(?:[.,]\d{1,2})?/i);
  if(m)out.price=m[0].replace(/\s+/g,'');
  m=s.match(/\b(XXXL|XXL|XL|L|M|S|XS|XXS)\s*\/\s*US\s*(\d{1,2}(?:\s*[-–]\s*\d{1,2})?)/i);
  if(m)out.size=m[1].toUpperCase()+' / US '+m[2].replace(/\s+/g,'');
  else{
    m=s.match(/\bSize\s*[:\-]?\s*(XXXL|XXL|XL|L|M|S|XS|XXS|\d{1,2}(?:\s*[-–]\s*\d{1,2})?)/i);
    if(m)out.size=m[1].toUpperCase();
  }
  const star=s.match(/([0-5](?:\.\d)?)\s*(?:out of 5|stars?|★)/i),rev=s.match(/([\d,]+)\s*(?:ratings?|reviews?)/i);
  if(star||rev)out.reviews=[star?star[1]+' ★':'',rev?rev[1]+' reviews':''].filter(Boolean).join(' · ');
  m=s.match(/\b(new with tags|new without tags|very good|good|satisfactory|used|new)\b/i);
  if(m)out.condition=m[1].replace(/\b\w/g,c=>c.toUpperCase());
  return out;
}

function isAmazonUrl(url=''){
  try{const h=new URL(url).hostname.toLowerCase();return h==='a.co'||h.includes('amazon.')}catch{return false}
}
function isVintedUrl(url=''){
  try{return new URL(url).hostname.toLowerCase().includes('vinted.')}catch{return false}
}
function isDepopUrl(url=''){
  try{
    const h=new URL(url).hostname.toLowerCase();
    return h==='depop.app.link'||h==='depop.com'||h.endsWith('.depop.com');
  }catch{return false}
}
function isEbayUrl(url=''){
  try{
    const h=new URL(url).hostname.toLowerCase();
    return h==='ebay.com'||h.endsWith('.ebay.com')||h==='ebay.us'||h.endsWith('.ebay.us');
  }catch{return false}
}
function depopFallbackUrls(url=''){
  const out=[];const add=v=>{v=safeHttpUrl(v);if(v&&!out.includes(v))out.push(v)};
  add(url);
  try{
    const u=new URL(url),h=u.hostname.toLowerCase(),path=u.pathname.replace(/^\/+/, '');
    if(h==='depop.app.link'&&path){
      add('https://depop_webonly.app.link/'+path);
      add('https://depop-web.app.link/'+path);
      const web=new URL(url);web.searchParams.set('$web_only','true');web.searchParams.set('$desktop_web_only','true');web.searchParams.set('$mobile_web_only','true');add(web.toString());
    }
  }catch{}
  return out;
}
function genericListingTitle(value=''){
  const s=String(value||'').trim();
  const looksLikeShareCode=/^(?=.{8,24}$)(?=.*[a-z])(?=.*[A-Z0-9])[A-Za-z0-9_-]+$/.test(s);
  return !s
    ||looksLikeShareCode
    ||/^(Amazon|Vinted|Depop|Inspo) (outfit option|find)$/i.test(s)
    ||/^Look what I just found on Depop/i.test(s)
    ||/^Error Page\s*\|\s*eBay$/i.test(s)
    ||/^eBay listing$/i.test(s)
    ||/^Dress \| Vinted$/i.test(s);
}
function genericDepopImage(value=''){
  const s=String(value||'');
  return !!s&&!/media-photos\.depop\.com/i.test(s);
}
function cleanListingPrice(value=''){
  const s=typeof value==='string'?value:(value?.value||value?.text||'');
  const m=String(s||'').replace(/\s+/g,' ').match(/(?:US\$|CA\$|AU\$|\$|€|£)\s?\d+(?:[.,]\d{1,2})?/i);
  return m?m[0].replace(/\s+/g,''):'';
}
function parseVintedStructured(raw=''){
  try{
    const obj=typeof raw==='string'?JSON.parse(raw):raw;
    const stack=[obj];
    while(stack.length){
      const cur=stack.shift();
      if(!cur||typeof cur!=='object')continue;
      const type=String(cur['@type']||'').toLowerCase();
      if(type==='product'||cur.offers){
        const offers=Array.isArray(cur.offers)?cur.offers[0]:cur.offers;
        let price='';
        if(offers&&offers.price!=null){
          const currency=String(offers.priceCurrency||'USD').toUpperCase();
          const symbol=currency==='USD'?'$':currency==='EUR'?'€':currency==='GBP'?'£':currency+' ';
          price=symbol+String(offers.price);
        }
        const image=Array.isArray(cur.image)?cur.image[0]:cur.image;
        return{price:cleanListingPrice(price),image:safeImageUrl(image)||'',title:cur.name||''};
      }
      Object.values(cur).forEach(v=>{
        if(v&&typeof v==='object'){
          if(Array.isArray(v))stack.push(...v);else stack.push(v);
        }
      });
    }
  }catch(e){}
  return{price:'',image:'',title:''};
}

function amazonReviews(rating='',count=''){
  const r=String(rating||'').match(/([0-5](?:\.\d)?)/),c=String(count||'').match(/([\d,]+)/);
  return [r?r[1]+' ★':'',c?c[1]+' reviews':''].filter(Boolean).join(' · ');
}
function cleanAmazonPrice(value=''){
  const m=String(value||'').match(/\$\s?\d+(?:[.,]\d{2})?/);
  return m?m[0].replace(/\s+/g,''):'';
}
function cleanAmazonSize(value=''){
  const s=String(value||'').replace(/\s+/g,' ').trim();
  return s&&s.length<45?s:'';
}
function amazonProductImage(value=''){
  const safe=safeImageUrl(value)||'';
  if(!safe)return '';
  try{
    const u=new URL(safe),h=u.hostname.toLowerCase();
    const amazonHost=h==='m.media-amazon.com'||h.endsWith('.media-amazon.com')||h==='images-na.ssl-images-amazon.com';
    return amazonHost&&/\/images\/I\//i.test(u.pathname)?safe:'';
  }catch{return ''}
}

async function previewDetails(url){
  url=safeHttpUrl(url);if(!url)throw new Error('unsafe url');
  const amazon=isAmazonUrl(url),vinted=isVintedUrl(url),depop=isDepopUrl(url),ebay=isEbayUrl(url),q=new URLSearchParams();

  if(ebay){
    let direct={};
    if(window.inspoCloudApi?.previewEbay){
      try{direct=await window.inspoCloudApi.previewEbay(url)||{}}catch(e){}
    }

    let title=direct.title||'';
    let image=safeImageUrl(direct.image)||'';
    const resolvedUrl=safeHttpUrl(direct.resolvedUrl)||'';

    if(!title||!image){
      try{
        const id=String(url).match(/\/itm\/(?:[^/]+\/)?(\d{9,15})/i)?.[1]||'';
        const previewUrl=id?'https://www.ebay.com/itm/'+id:(resolvedUrl||url);
        const mq=new URLSearchParams();
        mq.set('url',previewUrl);
        mq.set('prerender','true');
        const mr=await fetch('https://api.microlink.io/?'+mq.toString());
        if(mr.ok){
          const mj=await mr.json(),md=mj.data||{};
          const mt=String(md.title||'').trim();
          const mi=safeImageUrl(md.image?.url||'');
          if(!title&&mt&&!genericListingTitle(mt))title=mt;
          if(!image&&mi){
            try{
              const h=new URL(mi).hostname.toLowerCase();
              if(h==='i.ebayimg.com'||h.endsWith('.ebayimg.com'))image=mi;
            }catch(e){}
          }
        }
      }catch(e){}
    }

    return{
      title,
      image,
      source:'eBay',
      price:direct?.priceExact===true?(direct.price||''):'',
      size:direct?.size||'',
      reviews:'',
      condition:direct?.condition||'',
      resolvedUrl,
      priceExact:direct?.priceExact===true
    };
  }

  let depopDirect={},depopResolved='',depopMicrolink={};
  if(depop&&window.inspoCloudApi?.previewDepop){
    try{
      depopDirect=await window.inspoCloudApi.previewDepop(url)||{};
      depopResolved=safeHttpUrl(depopDirect.resolvedUrl)||'';
      if(depopResolved)url=depopResolved;
    }catch(e){}
  }

  if(depop&&!depopResolved&&(!depopDirect.title||!depopDirect.image)){
    const candidates=depopFallbackUrls(url);
    for(const candidate of candidates){
      try{
        const mq=new URLSearchParams();
        mq.set('url',candidate);mq.set('prerender','true');
        const mr=await fetch('https://api.microlink.io/?'+mq.toString());
        if(!mr.ok)continue;
        const mj=await mr.json(),md=mj.data||{};
        const mt=String(md.title||'').trim(),mi=safeImageUrl(md.image?.url||''),mu=safeHttpUrl(md.url||md.canonical?.url||'');
        if(mt&&!genericListingTitle(mt))depopMicrolink.title=mt;
        if(mi)depopMicrolink.image=mi;
        if(mu&&isDepopUrl(mu))depopMicrolink.resolvedUrl=mu;
        if(depopMicrolink.title&&depopMicrolink.image)break;
      }catch(e){}
    }
    if(depopMicrolink.resolvedUrl){
      depopResolved=depopMicrolink.resolvedUrl;
      url=depopResolved;
    }
  }

  if(vinted&&window.inspoCloudApi?.previewVinted){
    try{
      const direct=await window.inspoCloudApi.previewVinted(url);
      if(direct&&(direct.title||direct.image||direct.price||direct.size||direct.condition)){
        return{
          title:direct.title||'',
          image:safeImageUrl(direct.image)||'',
          source:'Vinted',
          price:direct.price||'',
          size:direct.size||'',
          reviews:'',
          condition:direct.condition||''
        };
      }
    }catch(e){}
  }

  q.set('url',url);
  q.set('prerender','true');
  q.set('data.pageText.selector','body');
  q.set('data.pageText.attr','text');

  if(vinted){
    q.set('data.vintedPrice.selector','[data-testid="item-sidebar-price-container"]');
    q.set('data.vintedPrice.attr','text');
    q.set('data.vintedTotal.selector','[data-testid="total-combined-price"]');
    q.set('data.vintedTotal.attr','text');
    q.set('data.vintedImage.selector','meta[property="og:image"]');
    q.set('data.vintedImage.attr','content');
    q.set('data.vintedTitle.selector','meta[property="og:title"]');
    q.set('data.vintedTitle.attr','content');
    q.set('data.vintedDescription.selector','meta[name="description"]');
    q.set('data.vintedDescription.attr','content');
    q.set('data.vintedJson.selector','script[type="application/ld+json"]');
    q.set('data.vintedJson.attr','text');
  }

  if(amazon){
    q.set('data.amazonRating.selector','#acrPopover');q.set('data.amazonRating.attr','title');
    q.set('data.amazonReviewCount.selector','#acrCustomerReviewText');q.set('data.amazonReviewCount.attr','aria-label');
    q.set('data.amazonPrice.selector','#corePrice_feature_div .a-price .a-offscreen');q.set('data.amazonPrice.attr','text');
    q.set('data.amazonSize.selector','#variation_size_name .selection');q.set('data.amazonSize.attr','text');
  }

  const r=await fetch('https://api.microlink.io/?'+q.toString());
  if(!r.ok)throw new Error('details');
  const j=await r.json(),d=j.data||{};
  const text=typeof d.pageText==='string'?d.pageText:(d.pageText?.value||'');
  const det=parseDetails([d.title,d.description,text].filter(Boolean).join(' '));
  const amazonReview=amazonReviews(d.amazonRating,d.amazonReviewCount);

  if(vinted){
    const structured=parseVintedStructured(d.vintedJson);
    const exactPrice=cleanListingPrice(d.vintedPrice)
      ||cleanListingPrice(d.vintedTotal)
      ||structured.price
      ||cleanListingPrice(d.vintedDescription)
      ||cleanListingPrice(text)
      ||det.price
      ||'';
    const image=safeImageUrl(d.vintedImage)||structured.image||safeImageUrl(d.image?.url)||'';
    const title=d.vintedTitle||structured.title||d.title||'';
    return{title,image,source:d.publisher||'Vinted',price:exactPrice,size:det.size||'',reviews:det.reviews||'',condition:det.condition||''};
  }

  if(amazon){
    let title=d.title||'';
    let image=amazonProductImage(d.image?.url)||'';
    let exactPrice=cleanAmazonPrice(d.amazonPrice);
    let exactSize=cleanAmazonSize(d.amazonSize);
    let reviews=amazonReview||det.reviews||'';
    let resolvedUrl='';

    // First keep the older preview result when it works.
    // If an a.co link comes back blank/generic, resolve it to the real Amazon product URL
    // and run the same proven preview method again on that full URL.
    if((!image||genericListingTitle(title)||/^Amazon\.com(?::|$)/i.test(String(title).trim()))&&window.inspoCloudApi?.previewAmazon){
      try{
        const direct=await window.inspoCloudApi.previewAmazon(url)||{};
        const directImage=amazonProductImage(direct.image)||'';
        const directTitle=String(direct.title||'').trim();
        resolvedUrl=safeHttpUrl(direct.resolvedUrl)||'';

        if(!image&&directImage)image=directImage;
        if((genericListingTitle(title)||/^Amazon\.com(?::|$)/i.test(String(title).trim()))&&directTitle&&!genericListingTitle(directTitle))title=directTitle;
        if(!exactPrice)exactPrice=cleanAmazonPrice(direct.price);
        if(!exactSize)exactSize=cleanAmazonSize(direct.size);
        if(!reviews&&direct.reviews)reviews=direct.reviews;

        if(resolvedUrl&&isAmazonUrl(resolvedUrl)&&(!image||genericListingTitle(title)||/^Amazon\.com(?::|$)/i.test(String(title).trim()))){
          try{
            const aq=new URLSearchParams();
            aq.set('url',resolvedUrl);
            aq.set('prerender','true');
            aq.set('data.amazonRating.selector','#acrPopover');aq.set('data.amazonRating.attr','title');
            aq.set('data.amazonReviewCount.selector','#acrCustomerReviewText');aq.set('data.amazonReviewCount.attr','aria-label');
            aq.set('data.amazonPrice.selector','#corePrice_feature_div .a-price .a-offscreen');aq.set('data.amazonPrice.attr','text');
            aq.set('data.amazonSize.selector','#variation_size_name .selection');aq.set('data.amazonSize.attr','text');
            const ar=await fetch('https://api.microlink.io/?'+aq.toString());
            if(ar.ok){
              const aj=await ar.json(),ad=aj.data||{};
              const retryImage=amazonProductImage(ad.image?.url)||'';
              const retryTitle=String(ad.title||'').trim();
              if(!image&&retryImage)image=retryImage;
              if((genericListingTitle(title)||/^Amazon\.com(?::|$)/i.test(String(title).trim()))&&retryTitle&&!genericListingTitle(retryTitle))title=retryTitle;
              if(!exactPrice)exactPrice=cleanAmazonPrice(ad.amazonPrice);
              if(!exactSize)exactSize=cleanAmazonSize(ad.amazonSize);
              if(!reviews)reviews=amazonReviews(ad.amazonRating,ad.amazonReviewCount);
            }
          }catch(e){}
        }
      }catch(e){}
    }

    return{
      title:title||'',
      image,
      source:'Amazon',
      price:exactPrice||'See Amazon',
      size:exactSize||'Choose on Amazon',
      reviews,
      condition:'',
      resolvedUrl
    };
  }

  if(depop){
    const microlinkTitle=genericListingTitle(d.title)?'':(d.title||'');
    return{
      title:depopDirect.title||depopMicrolink.title||microlinkTitle,
      image:safeImageUrl(depopDirect.image)||safeImageUrl(depopMicrolink.image)||safeImageUrl(d.image?.url)||'',
      source:'Depop',
      price:depopDirect.price||det.price||'',
      size:depopDirect.size||det.size||'',
      reviews:'',
      condition:depopDirect.condition||det.condition||'',
      resolvedUrl:depopResolved||''
    };
  }

  return{title:d.title||'',image:d.image?.url||'',source:d.publisher||'',price:det.price||'',size:det.size||'',reviews:det.reviews||'',condition:det.condition||''};
}

async function enrichItem(x,force=false){
  if(!x?.url)return false;
  const hasDetails=!!(x.price||x.size||x.reviews||x.condition),fresh=x.detailsChecked&&Date.now()-x.detailsChecked<21600000;
  if(!force&&hasDetails&&fresh)return false;
  try{
    const d=await previewDetails(x.url);let changed=false;
    const depop=isDepopUrl(x.url),ebay=isEbayUrl(x.url);
    if(d.image&&(!x.image||(depop&&(genericListingTitle(x.title)||genericDepopImage(x.image)))||(amazon&&!amazonProductImage(x.image)))){x.image=d.image;changed=true}
    if(d.title&&genericListingTitle(x.title)){x.title=d.title;changed=true}
    if((depop||ebay||amazon)&&d.resolvedUrl&&safeHttpUrl(d.resolvedUrl)&&x.url!==d.resolvedUrl){x.url=d.resolvedUrl;changed=true}
    const s=sourceName(x.url,d.source);if(s&&s!==x.source){x.source=s;changed=true}
    const amazon=isAmazonUrl(x.url);
    if(amazon){
      for(const k of ['price','size','reviews'])if(d[k]&&x[k]!==d[k]){x[k]=d[k];changed=true}
    }else if(ebay){
      if(d.priceExact===true&&x.price!==d.price){x.price=d.price||'';changed=true}
      for(const k of ['size','condition'])if(d[k]&&(!x[k]||force)&&x[k]!==d[k]){x[k]=d[k];changed=true}
    }else{
      for(const k of ['price','size','reviews','condition'])if(d[k]&&(!x[k]||force)&&x[k]!==d[k]){x[k]=d[k];changed=true}
    }
    x.detailsChecked=Date.now();
    return changed;
  }catch{
    x.detailsChecked=Date.now();
    return false;
  }
}

async function refreshSavedDetails(force=true){
  const b=current();if(!b)return;
  const a=(b.items||[]).filter(x=>(b.saved||[]).includes(x.id));
  if(!a.length){toast('Save a few finds first');return}
  $('#refreshDetails').disabled=true;$('#refreshDetails').textContent='Refreshing…';
  let changed=false,found=0;
  for(const x of a){
    const before=[x.price,x.size,x.reviews,x.condition].filter(Boolean).length;
    changed=(await enrichItem(x,force))||changed;
    const after=[x.price,x.size,x.reviews,x.condition].filter(Boolean).length;
    if(after>before)found++;
  }
  if(changed){b.updated=now();persist()}
  $('#refreshDetails').disabled=false;$('#refreshDetails').textContent='↻ Refresh details';
  renderBoard();
  toast(changed?(found?'Details pulled from source':'Details refreshed'):'No new details found');
}

async function hydrateMissing(){
  let changed=false;
  for(const b of projects){
    for(const x of (b.items||[])){
      if(x.url&&(!x.image||!x.detailsChecked))changed=(await enrichItem(x,false))||changed;
    }
  }
  if(changed)persist();
  if(currentId)renderBoard();else renderHome();
}

$('#savedBrowseBtn').onclick=()=>{savedMode='browse';renderBoard()};
$('#savedCompareBtn').onclick=()=>{savedMode='compare';renderBoard();setTimeout(()=>refreshSavedDetails(false),100)};
$('#refreshDetails').onclick=()=>refreshSavedDetails(true);
