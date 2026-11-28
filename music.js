/* 音乐：桌面小组件 + 音乐 App。通过你自己部署的网易云 API（NeteaseCloudMusicApiEnhanced/api-enhanced）取歌。
   只在本机保存：API 地址、登录 Cookie、播放队列。key：snowfall-music-v1 */
window.snowfallMusic=(()=>{
 'use strict';
 const KEY='snowfall-music-v1';
 const $=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const btn=(label,fn,cls='')=>{const b=$('button',cls,label);b.type='button';if(fn)b.addEventListener('click',fn);return b;};
 let st={api:'',cookie:'',user:null,queue:[],index:-1};
 try{const raw=JSON.parse(localStorage.getItem(KEY));if(raw&&typeof raw==='object'){
  st.api=typeof raw.api==='string'?raw.api:'';st.cookie=typeof raw.cookie==='string'?raw.cookie:'';
  st.user=raw.user&&typeof raw.user==='object'?raw.user:null;
  st.queue=Array.isArray(raw.queue)?raw.queue.filter(t=>t&&Number.isFinite(+t.id)).slice(0,300):[];
  st.index=Number.isInteger(raw.index)&&raw.index<st.queue.length?raw.index:(st.queue.length?0:-1);
 }}catch{}
 function save(){try{localStorage.setItem(KEY,JSON.stringify(st));}catch{}}
 const audio=new Audio();audio.preload='none';
 const listeners=new Set();
 let lyric=[],lyricLine='',loading=false,message='';
 function emit(){for(const fn of listeners)try{fn();}catch{}}
 const current=()=>st.queue[st.index]||null;
 const https=u=>typeof u==='string'?u.replace(/^http:\/\//,'https://'):'';
 const apiBase=()=>st.api.trim().replace(/\/+$/,'');

 async function call(path,params={}){
  const base=apiBase();if(!base)throw Error('还没有填写网易云 API 地址。');
  if(!/^https:\/\//.test(base)&&location.protocol==='https:')throw Error('API 地址需要以 https:// 开头。');
  const q=new URLSearchParams({...params,timestamp:Date.now()});
  if(st.cookie)q.set('cookie',st.cookie);
  let res;
  try{res=await fetch(`${base}${path}?${q}`,{credentials:'omit'});}
  catch{throw Error('连不上 API：检查地址是否正确、服务是否在运行。');}
  let data;try{data=await res.json();}catch{throw Error(`API 返回了无法读取的内容（${res.status}）。`);}
  if(data&&data.code&&![200,800,801,802,803].includes(data.code))throw Error(data.message||data.msg||`网易云返回错误 ${data.code}`);
  return data;
 }
 const toTrack=s=>({id:+s.id,name:s.name||'未知歌曲',artist:(s.ar||s.artists||[]).map(a=>a.name).join(' / ')||'未知歌手',cover:https((s.al||s.album||{}).picUrl||''),dt:s.dt||s.duration||0});

 function parseLrc(text){
  const out=[];
  for(const line of String(text||'').split('\n')){
   const words=line.replace(/\[[^\]]*\]/g,'').trim();
   for(const m of line.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g))if(words)out.push([+m[1]*60+ +m[2],words]);
  }
  return out.sort((a,b)=>a[0]-b[0]);
 }
 async function playAt(i){
  if(i<0||i>=st.queue.length)return;
  st.index=i;save();const t=current();loading=true;message='';lyric=[];lyricLine='';emit();
  try{
   const data=await call('/song/url/v1',{id:t.id,level:'standard'});
   const url=https(data?.data?.[0]?.url);
   if(!url)throw Error('这首歌暂时放不了（可能需要会员或没有版权）。');
   audio.src=url;await audio.play();
   call('/lyric',{id:t.id}).then(d=>{if(current()?.id===t.id){lyric=parseLrc(d?.lrc?.lyric);emit();}}).catch(()=>{});
  }catch(err){message=err.message||'播放失败';}
  finally{loading=false;emit();updateSession();}
 }
 function playList(tracks,start=0){st.queue=tracks.slice(0,300);save();playAt(start);}
 function toggle(){
  if(!current()){message=apiBase()?'先在音乐里选一首歌。':'先打开音乐 App 连接网易云。';emit();return;}
  if(!audio.src){playAt(st.index);return;}
  if(audio.paused)audio.play().catch(e=>{message=e.message;emit();});else audio.pause();
 }
 const next=()=>{if(st.queue.length)playAt((st.index+1)%st.queue.length);};
 const prev=()=>{if(audio.currentTime>4){audio.currentTime=0;return;}if(st.queue.length)playAt((st.index-1+st.queue.length)%st.queue.length);};
 audio.addEventListener('ended',next);
 for(const ev of ['play','pause','loadedmetadata'])audio.addEventListener(ev,emit);
 audio.addEventListener('error',()=>{if(audio.src){message='音频加载失败，换一首试试。';emit();}});
 audio.addEventListener('timeupdate',()=>{
  const t=audio.currentTime;let line='';for(const [s,w] of lyric){if(s>t+.2)break;line=w;}
  if(line!==lyricLine){lyricLine=line;emit();}
  tick();
 });
 function updateSession(){
  const t=current();if(!t||!('mediaSession' in navigator))return;
  try{navigator.mediaSession.metadata=new MediaMetadata({title:t.name,artist:t.artist,artwork:t.cover?[{src:t.cover,sizes:'512x512'}]:[]});
   navigator.mediaSession.setActionHandler('play',toggle);navigator.mediaSession.setActionHandler('pause',toggle);
   navigator.mediaSession.setActionHandler('nexttrack',next);navigator.mediaSession.setActionHandler('previoustrack',prev);}catch{}
 }
 const ticks=new Set();function tick(){for(const fn of ticks)fn();}
 const fmt=s=>{s=Math.max(0,Math.floor(s||0));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
 const icon={play:'▶',pause:'❚❚',prev:'⏮',next:'⏭'};

 /* ── 桌面小组件 ── */
 function createWidget(){
  const node=$('div','snow-music'),cover=$('div','snow-music-cover'),img=$('img'),info=$('div','snow-music-info');
  const kicker=$('span','snow-widget-kicker','正在播放'),title=$('strong','snow-music-title'),artist=$('span','snow-music-artist'),line=$('span','snow-music-lyric');
  const bar=$('div','snow-music-bar'),fill=$('i');bar.append(fill);
  const ctrl=$('div','snow-music-ctrl'),bp=btn(icon.prev,e=>{e.stopPropagation();prev();}),bt=btn(icon.play,e=>{e.stopPropagation();toggle();},'is-main'),bn=btn(icon.next,e=>{e.stopPropagation();next();});
  for(const [b,a,l] of [[bp,'prev','上一首'],[bt,'toggle','播放或暂停'],[bn,'next','下一首']]){b.dataset.musicAction=a;b.setAttribute('aria-label',l);}
  img.alt='';img.draggable=false;cover.append(img);cover.dataset.musicOpen='';title.dataset.musicOpen='';
  cover.addEventListener('click',e=>{e.stopPropagation();if(typeof go==='function')go('app-music');});
  title.addEventListener('click',e=>{e.stopPropagation();if(typeof go==='function')go('app-music');});
  info.append(kicker,title,artist,line);ctrl.append(bp,bt,bn);node.append(cover,info,bar,ctrl);
  function draw(){
   const t=current();
   title.textContent=t?t.name:'还没有在放歌';artist.textContent=t?t.artist:(apiBase()?'打开音乐挑一首':'点封面连接网易云');
   line.textContent=message||lyricLine||'';line.hidden=!line.textContent;
   kicker.textContent=loading?'加载中…':audio.paused?'音乐':'正在播放';
   const src=t?.cover?`${t.cover}?param=300y300`:'';if(img.getAttribute('src')!==src){if(src)img.src=src;else img.removeAttribute('src');}
   cover.classList.toggle('is-empty',!src);node.classList.toggle('is-playing',!audio.paused);
   bt.textContent=audio.paused?icon.play:icon.pause;
  }
  const progress=()=>{fill.style.width=audio.duration?`${audio.currentTime/audio.duration*100}%`:'0%';};
  listeners.add(draw);ticks.add(progress);draw();
  return {node,draw(){draw();progress();}};
 }

 /* ── 音乐 App ── */
 function mountApp(){
  if(document.getElementById('app-music'))return;
  const screen=$('section','screen');screen.id='app-music';
  screen.innerHTML='<header><button class="back" data-go="home" aria-label="返回桌面">‹</button><div><b>音乐</b><small class="music-who"></small></div><button type="button" class="header-action music-gear">连接</button></header>';
  const body=$('div','scroll music-body');screen.append(body);
  // 正在播放
  const now=$('section','music-now'),ncov=$('img','music-now-cover'),nt=$('strong','music-now-title'),na=$('span','music-now-artist'),nl=$('p','music-now-lyric');
  const range=$('input','music-range');range.type='range';range.min=0;range.max=1000;range.value=0;range.setAttribute('aria-label','播放进度');
  const times=$('div','music-times'),t1=$('span','','0:00'),t2=$('span','','0:00');times.append(t1,t2);
  const nc=$('div','music-now-ctrl'),np=btn(icon.prev,prev),nb=btn(icon.play,toggle,'is-main'),nn=btn(icon.next,next);nc.append(np,nb,nn);
  ncov.alt='';const ntext=$('div','music-now-text');ntext.append(nt,na);
  now.append(ncov,ntext,nl,range,times,nc);
  let seeking=false;
  range.addEventListener('input',()=>{seeking=true;t1.textContent=fmt(range.value/1000*(audio.duration||0));});
  range.addEventListener('change',()=>{if(audio.duration)audio.currentTime=range.value/1000*audio.duration;seeking=false;});
  ticks.add(()=>{if(!seeking&&audio.duration){range.value=Math.round(audio.currentTime/audio.duration*1000);t1.textContent=fmt(audio.currentTime);t2.textContent=fmt(audio.duration);}});
  // 标签
  const tabs=$('div','music-tabs'),panes={};const tabNames=[['search','搜索'],['daily','每日推荐'],['lists','我的歌单']];
  const status=$('p','music-status');status.setAttribute('role','status');
  for(const [k,label] of tabNames){const b=btn(label,()=>show(k));b.dataset.tab=k;tabs.append(b);panes[k]=$('div','music-pane');panes[k].hidden=true;}
  // 搜索
  const sform=$('form','music-search'),sin=$('input');sin.type='search';sin.placeholder='搜歌名、歌手';sin.enterKeyHint='search';
  const sbtn=$('button','','搜索');sbtn.type='submit';sform.append(sin,sbtn);const slist=$('ol','music-list');panes.search.append(sform,slist);
  sform.addEventListener('submit',async e=>{e.preventDefault();const kw=sin.value.trim();if(!kw)return;sin.blur();
   await load(slist,async()=>((await call('/cloudsearch',{keywords:kw,limit:30}))?.result?.songs||[]).map(toTrack));});
  // 每日推荐
  const dlist=$('ol','music-list');panes.daily.append(dlist);
  // 歌单
  const lwrap=$('div','music-lists'),ltracks=$('ol','music-list'),lback=btn('‹ 全部歌单',()=>{ltracks.hidden=true;lback.hidden=true;lwrap.hidden=false;},'music-link');
  ltracks.hidden=true;lback.hidden=true;panes.lists.append(lback,lwrap,ltracks);
  // 设置
  const setup=$('section','music-setup');setup.hidden=true;
  body.append(now,status,tabs,...Object.values(panes),setup);
  document.querySelector('.phone')?.append(screen)||document.body.append(screen);
  screen.querySelector('[data-go=home]').addEventListener('click',()=>{if(typeof go==='function')go('home');});

  function setStatus(t){status.textContent=t||'';status.hidden=!t;}
  function renderList(list,tracks){
   list.replaceChildren();
   if(!tracks.length){list.append($('li','music-empty','没有找到歌曲'));return;}
   tracks.forEach((t,i)=>{
    const li=$('li'),b=$('button','music-row'),img=$('img');b.type='button';img.alt='';img.loading='lazy';
    if(t.cover)img.src=`${t.cover}?param=96y96`;
    const tx=$('span','music-row-text');tx.append($('strong','',t.name),$('small','',t.artist));
    b.append(img,tx,$('span','music-row-time',t.dt?fmt(t.dt/1000):''));
    b.addEventListener('click',()=>playList(tracks,i));li.append(b);list.append(li);
   });
  }
  async function load(list,get){
   setStatus('加载中…');list.replaceChildren();
   try{renderList(list,await get());setStatus('');}catch(err){setStatus(err.message);}
  }
  let tab='search';
  function show(k){
   tab=k;setup.hidden=true;
   for(const b of tabs.children)b.classList.toggle('is-on',b.dataset.tab===k);
   for(const [name,p] of Object.entries(panes))p.hidden=name!==k;
   if(!apiBase()){openSetup();return;}
   if(k==='daily'&&!dlist.childElementCount){if(!st.cookie){setStatus('每日推荐需要先登录网易云账号。');return;}load(dlist,async()=>((await call('/recommend/songs'))?.data?.dailySongs||[]).map(toTrack));}
   if(k==='lists'&&!lwrap.childElementCount)loadLists();
   if(k==='search')setStatus('');
  }
  async function loadLists(){
   if(!st.user?.id){setStatus('我的歌单需要先登录网易云账号。');return;}
   setStatus('加载中…');
   try{
    const pl=(await call('/user/playlist',{uid:st.user.id,limit:50}))?.playlist||[];
    lwrap.replaceChildren();
    for(const p of pl){
     const b=$('button','music-pl'),img=$('img');b.type='button';img.alt='';img.loading='lazy';img.src=`${https(p.coverImgUrl)}?param=120y120`;
     const tx=$('span','music-row-text');tx.append($('strong','',p.name),$('small','',`${p.trackCount} 首`));b.append(img,tx);
     b.addEventListener('click',()=>{lwrap.hidden=true;lback.hidden=false;ltracks.hidden=false;load(ltracks,async()=>((await call('/playlist/track/all',{id:p.id,limit:200}))?.songs||[]).map(toTrack));});
     lwrap.append(b);
    }
    setStatus(pl.length?'':'还没有歌单。');
   }catch(err){setStatus(err.message);}
  }
  // 连接设置：API 地址 + 登录
  let qrTimer=0;
  function openSetup(){
   clearInterval(qrTimer);setStatus('');setup.hidden=false;for(const p of Object.values(panes))p.hidden=true;
   setup.replaceChildren();
   const h=$('h3','','连接网易云');
   const tip=$('p','music-tip','先把 api-enhanced 部署成你自己的服务（例如 fork 后在 Vercel 一键部署），再把得到的 https 地址填在这里。');
   const af=$('form','music-field'),ai=$('input');ai.type='url';ai.placeholder='https://你的服务.vercel.app';ai.value=st.api;ai.autocomplete='off';
   const as=$('button','widget-primary','保存地址');as.type='submit';af.append(ai,as);
   const out=$('p','music-status');out.setAttribute('role','status');
   af.addEventListener('submit',async e=>{e.preventDefault();st.api=ai.value.trim();save();out.textContent='正在测试…';
    try{await call('/search/hot');out.textContent='连接成功 ✓';emit();refreshWho();}catch(err){out.textContent=err.message;}});
   setup.append(h,tip,af,out);
   const login=$('div','music-login');
   if(st.cookie){
    login.append($('p','',`已登录：${st.user?.nickname||'网易云账号'}`),btn('退出登录',()=>{st.cookie='';st.user=null;save();refreshWho();openSetup();}));
   }else{
    login.append($('h3','','登录（可选，听会员歌和看自己的歌单）'));
    // 手机验证码
    const pf=$('form','music-field'),pi=$('input'),ci=$('input'),send=btn('发验证码',async()=>{lo.textContent='发送中…';try{await call('/captcha/sent',{phone:pi.value.trim()});lo.textContent='验证码已发送';}catch(err){lo.textContent=err.message;}});
    pi.type='tel';pi.placeholder='手机号';ci.inputMode='numeric';ci.placeholder='验证码';
    const go2=$('button','widget-primary','登录');go2.type='submit';pf.append(pi,send,ci,go2);
    const lo=$('p','music-status');
    pf.addEventListener('submit',async e=>{e.preventDefault();lo.textContent='登录中…';
     try{const d=await call('/login/cellphone',{phone:pi.value.trim(),captcha:ci.value.trim()});await finishLogin(d.cookie);lo.textContent='';}catch(err){lo.textContent=err.message;}});
    // 二维码
    const qb=btn('用另一台设备扫码登录',startQr,'music-link'),qbox=$('div','music-qr');
    async function startQr(){
     clearInterval(qrTimer);qbox.replaceChildren($('p','music-status','生成二维码…'));
     try{
      const key=(await call('/login/qr/key'))?.data?.unikey;
      const qr=(await call('/login/qr/create',{key,qrimg:true}))?.data;
      const img=$('img');img.src=qr.qrimg;img.alt='网易云登录二维码';const s=$('p','music-status','用网易云 App 扫一扫');
      qbox.replaceChildren(img,s);
      qrTimer=setInterval(async()=>{
       try{const d=await call('/login/qr/check',{key});
        if(d.code===800){clearInterval(qrTimer);s.textContent='二维码过期了，再点一次生成。';}
        else if(d.code===802)s.textContent='已扫码，请在手机上确认';
        else if(d.code===803){clearInterval(qrTimer);await finishLogin(d.cookie);}
       }catch{}
      },2500);
     }catch(err){qbox.replaceChildren($('p','music-status',err.message));}
    }
    login.append(pf,lo,qb,qbox);
   }
   setup.append(login);
  }
  async function finishLogin(cookie){
   if(!cookie)throw Error('登录没有返回 Cookie，请再试一次。');
   st.cookie=cookie;save();
   try{const d=await call('/user/account');const p=d?.profile;if(p)st.user={id:p.userId,nickname:p.nickname};}catch{}
   save();refreshWho();dlist.replaceChildren();lwrap.replaceChildren();openSetup();
  }
  function refreshWho(){screen.querySelector('.music-who').textContent=st.cookie?(st.user?.nickname||'已登录'):apiBase()?'未登录 · 可搜索试听':'未连接';}
  screen.querySelector('.music-gear').addEventListener('click',()=>setup.hidden?openSetup():show(tab));
  function drawNow(){
   const t=current();nt.textContent=t?t.name:'还没有在放歌';na.textContent=t?t.artist:'在下面搜一首吧';
   nl.textContent=message||lyricLine||(loading?'加载中…':'');
   const src=t?.cover?`${t.cover}?param=400y400`:'';if(ncov.getAttribute('src')!==src){if(src)ncov.src=src;else ncov.removeAttribute('src');}
   ncov.classList.toggle('is-empty',!src);nb.textContent=audio.paused?icon.play:icon.pause;now.classList.toggle('is-playing',!audio.paused);
  }
  listeners.add(drawNow);drawNow();refreshWho();show('search');
 }

 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mountApp);else mountApp();
 return {createWidget,toggle,next,prev,playList,get state(){return {...st};}};
})();
