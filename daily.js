/* Daily page. Levels: public (daily.json), unlisted (unlisted.json, shown on more.html), private (encrypted vault inside daily.json). */
const R='bxuvnesh/bxuvnesh.github.io',API='https://api.github.com/repos/'+R+'/contents/',$=s=>document.querySelector(s);
const MORE=!!document.body.dataset.more,ADMIN=!MORE&&location.search.includes('admin');
let D={posts:[],days:[]},U={posts:[]},V=[],K=null,ft='';
const te=s=>new TextEncoder().encode(s),td=u=>new TextDecoder().decode(u);
const b64=buf=>{let s='',u=new Uint8Array(buf);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const rid=()=>[...crypto.getRandomValues(new Uint8Array(8))].map(x=>x.toString(16).padStart(2,'0')).join('');
const day=t=>new Date(t).toLocaleDateString('en-CA');
const ls=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch(e){return''}};
const hdr=()=>({Authorization:'Bearer '+$('#tok').value.trim(),Accept:'application/vnd.github+json'});

/* crypto: passphrase -> PBKDF2 -> AES-256-GCM key. The key lives in memory only, never in storage. */
async function derive(pw,salt){const m=await crypto.subtle.importKey('raw',te(pw),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function enc(u){const iv=crypto.getRandomValues(new Uint8Array(12)),c=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},K.key,u)),o=new Uint8Array(12+c.length);o.set(iv);o.set(c,12);return o}
async function dec(u){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:u.subarray(0,12)},K.key,u.subarray(12)))}

/* GitHub */
async function rd(p){const r=await fetch(API+p+'?ref=main&t='+Date.now(),{headers:hdr()});if(r.status===404)return{};if(!r.ok)throw new Error('Token problem ('+r.status+')');const f=await r.json();return{sha:f.sha,j:JSON.parse(td(unb64(f.content.replace(/\n/g,''))))}}
async function put(path,content,msg,sha){const r=await fetch(API+path,{method:'PUT',headers:hdr(),body:JSON.stringify({message:msg,content,branch:'main',sha})});if(!r.ok)throw new Error(path+' ('+r.status+') '+(await r.json()).message)}
async function rm(path){const r=await fetch(API+path+'?ref=main&t='+Date.now(),{headers:hdr()});if(!r.ok)return;const d=await fetch(API+path,{method:'DELETE',headers:hdr(),body:JSON.stringify({message:'Delete media',sha:(await r.json()).sha,branch:'main'})});if(!d.ok)throw new Error(path+' ('+d.status+')')}
async function raw(path){const r=await fetch(API+path+'?ref=main&t='+Date.now(),{headers:{...hdr(),Accept:'application/vnd.github.raw'}});if(!r.ok)throw new Error(path+' ('+r.status+')');return new Uint8Array(await r.arrayBuffer())}

/* one safe read-change-write for everything; need=true when a private post is involved */
async function mutate(fn,need){
  const[a,b]=await Promise.all([rd('daily.json'),rd('unlisted.json')]),d=a.j||{},u=b.j||{};
  d.posts=d.posts||[];d.days=d.days||[];u.posts=u.posts||[];
  let v={posts:[]};
  if(d.vault&&(need||K)){
    if(!K||K.s!==d.vault.s)throw new Error('Unlock first');
    try{v=JSON.parse(td(await dec(unb64(d.vault.b))))}catch(e){throw new Error('Vault could not be opened. Unlock again.')}
  }
  const s0=JSON.stringify(d),s1=JSON.stringify(u),sv=JSON.stringify(v),after=[];
  await fn({pub:d.posts,unl:u.posts,prv:v.posts,d,after});
  if(JSON.stringify(v)!==sv){if(!K)throw new Error('Unlock first');d.vault={s:K.s,b:b64(await enc(te(JSON.stringify(v))))}}
  const save=(p,o,s,x)=>JSON.stringify(o)!==s?put(p,b64(te(JSON.stringify(o,null,1))),'Update daily',x):0;
  await save('daily.json',d,s0,a.sha);await save('unlisted.json',u,s1,b.sha);
  for(const f of after)await f();
  D=d;U=u;V=v.posts;draw();
}
const act=async(m,fn,need)=>{try{st(m+'...');await mutate(fn,need);st('Saved. Public and unlisted changes are live in about a minute.')}catch(e){st('Error: '+e.message)}};
const find=(a,id)=>a.findIndex(x=>x.id===id);
const move=(p,from,to)=>act('Moving',async c=>{
  const i=find(c[from],p.id);if(i<0)throw new Error('Post not found');
  const q=c[from].splice(i,1)[0];
  if(q.img&&(from==='prv')!==(to==='prv')){
    const old=q.img,bytes=from==='prv'?await dec(await raw(old)):await raw(old);
    q.img=to==='prv'?`media/daily/${rid()}.enc`:`media/daily/${q.id}.jpg`;
    await put(q.img,b64(to==='prv'?await enc(bytes):bytes),'Move media');
    c.after.push(()=>rm(old));
  }
  c[to].unshift(q);
},from==='prv'||to==='prv');
const del=(p,lv)=>confirm('Delete this post for good? Old copies can stay in GitHub history.')&&act('Deleting',async c=>{
  const i=find(c[lv],p.id);if(i>=0)c[lv].splice(i,1);if(p.img)c.after.push(()=>rm(p.img));
},lv==='prv');
async function create(lv,p,f){
  if(f){
    const u=scrub(new Uint8Array(await(await shrink(f)).arrayBuffer()));
    p.img=lv==='prv'?`media/daily/${rid()}.enc`:`media/daily/${p.id}.jpg`;
    await put(p.img,b64(lv==='prv'?await enc(u):u),'Add photo');
  }
  await mutate(c=>{c[lv].unshift(p);const k=day(p.id);if(!c.d.days.includes(k))c.d.days.push(k)},lv==='prv');
}
async function unlock(pw){
  let j={};try{const r=await fetch('daily.json?'+Date.now(),{cache:'no-store'});if(r.ok)j=await r.json()}catch(e){}
  if(j.vault){
    K={key:await derive(pw,unb64(j.vault.s)),s:j.vault.s};
    try{V=JSON.parse(td(await dec(unb64(j.vault.b)))).posts}catch(e){K=null;throw new Error('Wrong passphrase')}
  }else{
    if(prompt('No vault yet. Type the passphrase again to confirm. It cannot be recovered.')!==pw)throw new Error('Passphrases did not match');
    const s=crypto.getRandomValues(new Uint8Array(16));K={key:await derive(pw,s),s:b64(s)};V=[];
  }
}

/* second pass after shrink(): drops every metadata segment (EXIF/GPS, XMP, IPTC, ICC, comments); blocks the upload if the file looks wrong */
function scrub(u){
  if(u[0]!==0xFF||u[1]!==0xD8)throw new Error('Not a JPEG, upload blocked');
  const keep=[u.subarray(0,2)];let i=2,ok=0;
  while(i<u.length){
    if(u[i]!==0xFF)throw new Error('Unreadable JPEG, upload blocked');
    const m=u[i+1];
    if(m===0xFF){i++;continue}
    if(m===0xDA){keep.push(u.subarray(i));ok=1;break}
    const n=(u[i+2]<<8|u[i+3])+2;
    if(!((m>=0xE1&&m<=0xEF)||m===0xFE))keep.push(u.subarray(i,i+n));
    i+=n;
  }
  if(!ok)throw new Error('Unreadable JPEG, upload blocked');
  const out=new Uint8Array(keep.reduce((a,k)=>a+k.length,0));let o=0;
  keep.forEach(k=>{out.set(k,o);o+=k.length});
  return out;
}
async function shrink(f){
  const bm=await createImageBitmap(f,{imageOrientation:'from-image'}),s=Math.min(1,1920/Math.max(bm.width,bm.height)),c=document.createElement('canvas');
  c.width=Math.round(bm.width*s);c.height=Math.round(bm.height*s);
  c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/jpeg',.88));
}

/* ---------- UI ---------- */
const st=m=>{const e=$('#msg');if(e)e.textContent=m};
const LV={pub:'Public',unl:'Unlisted',prv:'Private'},imgs=new Map();
const btn=(t,f)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=f;return b};
const el=(t,c,x)=>{const e=document.createElement(t);e.className=c;if(x)e.textContent=x;return e};
const streak=()=>{const s=new Set(D.days||[]);let n=0,d=new Date();if(!s.has(day(d)))d.setDate(d.getDate()-1);while(s.has(day(d))){n++;d.setDate(d.getDate()-1)}return n};
async function photo(im,p,lv){
  if(lv!=='prv'){im.src=p.img;return}
  try{
    if(!imgs.has(p.img))imgs.set(p.img,URL.createObjectURL(new Blob([await dec(await raw(p.img))],{type:'image/jpeg'})));
    im.src=imgs.get(p.img);
  }catch(e){im.alt='Could not decrypt this photo'}
}
function draw(){
  const L=[];
  if(MORE)U.posts.forEach(p=>L.push([p,'unl']));
  else{D.posts.forEach(p=>L.push([p,'pub']));if(ADMIN){U.posts.forEach(p=>L.push([p,'unl']));V.forEach(p=>L.push([p,'prv']))}}
  L.sort((a,b)=>b[0].id-a[0].id);
  const tags=[...new Set(L.map(x=>x[0].tag).filter(Boolean))],tb=$('#tags');
  if(tb){tb.textContent='';if(tags.length)['',...tags].forEach(t=>{const b=btn(t?'#'+t:'All',()=>{ft=t;draw()});b.className='chip'+(t===ft?' on':'');tb.append(b)})}
  const sk=$('#streak');
  if(sk){const n=streak();sk.textContent=n?`Day ${n} locked in 🔥`:(ADMIN?'No streak yet. Post today.':'')}
  const f=$('#feed'),shown=L.filter(x=>!ft||x[0].tag===ft);
  f.textContent='';
  if(!shown.length)f.textContent='Nothing here yet.';
  shown.forEach(([p,lv])=>{
    const a=el('article','post'),m=el('div','meta');
    m.append(el('span','',new Date(p.id).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})));
    if(p.tag)m.append(el('span','tag','#'+p.tag));
    if(ADMIN)m.append(el('span','bd '+lv,LV[lv]));
    a.append(m);
    if(p.text)a.append(el('p','txt',p.text));
    if(p.img){const im=el('img','ph');im.alt='';im.loading='lazy';a.append(im);photo(im,p,lv)}
    if(ADMIN){const x=el('div','act');Object.keys(LV).filter(k=>k!==lv).forEach(k=>x.append(btn('Make '+LV[k].toLowerCase(),()=>move(p,lv,k))));x.append(btn('Delete',()=>del(p,lv)));a.append(x)}
    f.append(a);
  });
}
if(ADMIN){
  $('#adm').classList.add('on');$('#tok').value=ls('ghtok')||'';
  $('#ul').onclick=async()=>{try{st('Unlocking...');await unlock($('#pw').value);$('#pw').value='';st('Unlocked.');draw()}catch(e){st('Error: '+e.message)}};
  $('#lk').onclick=()=>{K=null;V=[];imgs.forEach(u=>URL.revokeObjectURL(u));imgs.clear();draw();st('Locked.')};
  $('#up').onclick=async()=>{try{
    const tx=$('#tx').value.trim(),lv=$('#lv').value,f=$('#pf').files[0];
    if(!tx&&!f)return st('Write something or add a photo.');
    if(lv==='prv'&&!K)return st('Unlock first (passphrase above).');
    ls('ghtok',$('#tok').value.trim());
    st('Posting...');
    await create(lv,{id:Date.now(),tag:$('#tg').value.trim().replace(/^#/,'').toLowerCase()||undefined,text:tx},f);
    $('#tx').value='';$('#pf').value='';$('#tg').value='';st('Posted. Public and unlisted posts are live in about a minute.');
  }catch(e){st('Error: '+e.message)}};
}
async function get(f,d){try{const r=await fetch(f+'?'+Date.now(),{cache:'no-store'});if(r.ok)return await r.json()}catch(e){}return d}
(async()=>{
  if(MORE)U=await get('unlisted.json',{posts:[]});
  else{D=await get('daily.json',{posts:[],days:[]});if(ADMIN)U=await get('unlisted.json',{posts:[]})}
  D.posts=D.posts||[];U.posts=U.posts||[];draw();
})();
