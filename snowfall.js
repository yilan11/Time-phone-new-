/* 雪落机启动层：独立作用域，不读写本地存储。 */
(()=>{'use strict';
const root=document.getElementById('snowfall-splash');if(!root)return;
const $=id=>root.querySelector('#sf-'+id),stage=$('stage'),DURATION=6300;
let animations=[],time=0,ready=false,raf=0,last=0,done=false,resize,observer;
const siblings=[...root.parentElement.children].filter(n=>n!==root);
const inertBefore=siblings.map(n=>n.inert);
const timer=setTimeout(()=>finish('watchdog'),12000);
function finish(reason){if(done)return;done=true;clearTimeout(timer);cancelAnimationFrame(raf);cancelAnimationFrame(resize);observer?.disconnect();animations.forEach(a=>a.cancel());root.hidden=true;siblings.forEach((n,i)=>n.inert=inertBefore[i]);document.dispatchEvent(new CustomEvent('snowfall:complete',{detail:{preview:false,duration:DURATION,reason}}));}
let lastSkipClick=null;
root.style.touchAction='manipulation';
root.addEventListener('click',()=>{if(done)return;const now=performance.now();if(lastSkipClick!==null&&now-lastSkipClick<=450){lastSkipClick=null;finish('skip');}else{lastSkipClick=now;}});
window.snowfallSplash={skip:()=>finish('skip'),getState:()=>({ready,time,ended:done,animations:animations.length,particles:root.querySelectorAll('.dot').length})};
try{
const particles=[];
// 固定种子与爪印轮廓分布，保证重播及拖动时光点不会随机抖动。
let seed=71;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};
const pads=[[-.085,-.085,.027,.036],[-.035,-.13,.027,.034],[.035,-.13,.027,.034],[.085,-.085,.027,.036],[0,.015,.082,.06]];
for(let i=0;i<64;i++){
 const p=document.createElement('i');p.className='dot';p.style.width=p.style.height=(2+random()*4)+'px';
 p.style.background=['#b6abdb','#b3c7e4','#cec1e4'][i%3];$('particles').append(p);
 const pad=pads[i%5],a=random()*Math.PI*2,r=Math.sqrt(random());
 particles.push({el:p,x:pad[0]+Math.cos(a)*pad[2]*r,y:pad[1]+Math.sin(a)*pad[3]*r,angle:random()*Math.PI*2,travel:.16+random()*.34});
}
function add(el,frames){const a=el.animate(frames.map(({t,...f})=>({...f,offset:t/DURATION})),{duration:DURATION,fill:'both',easing:'linear'});a.pause();a.currentTime=time;animations.push(a)}
function sprite(id,points){const w=stage.clientWidth,h=stage.clientHeight;add(typeof id==='string'?$(id):id,points.map(([t,x,y,s,o,r=0])=>({t,opacity:o,transform:`translate(-50%,-50%) translate(${x*w}px,${y*h}px) scale(${s}) rotate(${r}deg)`})));}
function opacity(id,points){add($(id),points.map(([t,opacity])=>({t,opacity})));}
function build(){
 animations.forEach(a=>a.cancel());animations=[];
 sprite('crouch',[[0,.67,.13,.62,0,-8],[120,.48,.12,.65,1,-5],[440,.30,.11,.74,1,0],[620,.28,.135,.80,1,-3],[740,.25,.10,.78,0,-8],[6300,.25,.10,.78,0]]);
 sprite('leap',[[0,.24,.08,.78,0],[650,.24,.08,.78,0,-8],[760,.18,-.01,.83,1,-12],[1010,-.05,-.15,.95,1,-7],[1230,-.18,-.12,.92,1,4],[1470,-.20,.12,.86,1,9],[1580,-.20,.14,.83,1,2],[1770,-.19,.07,.90,0,-6],[6300,0,0,1,0]]);
 sprite('front',[[0,-.25,.12,.55,0],[1660,-.25,.12,.55,0,-8],[1810,-.19,.02,.64,1,-6],[2130,-.07,-.13,.82,1,-3],[2430,0,-.01,1.05,1,0],[2710,0,.01,1.20,1,0],[2920,0,.01,1.30,0,0],[6300,0,0,1.3,0]]);
 // 把缺失的底部压在画面之外；通过推进、柔光与爪印完成拍屏，不假造独立前爪。
 sprite('pat',[[0,0,.39,.95,0],[2820,0,.39,.95,0,-3],[2960,0,.34,1.07,1,-2],[3160,0,.30,1.26,1,0],[3370,0,.32,1.50,1,1],[3520,0,.34,1.58,0,1],[6300,0,.34,1.58,0]]);
 opacity('flash',[[0,0],[3300,0],[3420,.95],[3530,1],[3680,0],[6300,0]]);
 sprite('paw',[[0,0,0,.70,0],[3490,0,0,.70,0,-8],[3650,0,0,1.12,1,2],[3830,0,0,1,1,0],[4190,0,0,1,1,0],[4440,0,0,1.10,0,0],[6300,0,0,1.1,0]]);
 sprite('star',[[0,-.30,-.22,.5,0,-20],[1000,-.30,-.22,.5,0,-20],[1270,-.32,-.25,1,1,0],[1630,-.34,-.28,.7,0,18],[6300,0,0,1,0]]);
 sprite('sparkle',[[0,.30,-.20,.4,0],[2110,.30,-.20,.4,0],[2430,.29,-.23,1,1],[2810,.30,-.26,.6,0],[6300,0,0,1,0]]);
 sprite('soft',[[0,-.29,.07,.5,0],[2270,-.29,.07,.5,0],[2500,-.29,.02,1.2,.9],[2800,-.29,-.01,.6,0],[6300,0,0,1,0]]);
 sprite('accent',[[0,.38,-.04,.7,0],[430,.38,-.04,.7,0],[560,.38,-.07,.95,1],[740,.39,-.10,.9,0],[6300,0,0,1,0]]);
 for(const p of particles){const ex=p.x+Math.cos(p.angle)*p.travel,ey=p.y+Math.sin(p.angle)*p.travel*.60;
 sprite(p.el,[[0,p.x,p.y,.3,0],[4190,p.x,p.y,.3,0],[4380,p.x,p.y,1,.9],[4700,p.x+(ex-p.x)*.38,p.y+(ey-p.y)*.38,1,.8],[5050,ex,ey-.02,.45,0],[6300,ex,ey-.02,.45,0]]);}
 add($('welcome'),[{t:0,opacity:0,transform:'translateY(10px)'},{t:4980,opacity:0,transform:'translateY(10px)'},{t:5300,opacity:1,transform:'translateY(0px)'},{t:5790,opacity:1,transform:'translateY(0px)'},{t:6180,opacity:0,transform:'translateY(-5px)'},{t:6300,opacity:0,transform:'translateY(-5px)'}]);
 opacity('veil',[[0,1],[5950,1],[6300,0]]);
 render(time);
}

function render(t){time=Math.max(0,Math.min(DURATION,Number.isFinite(t)?t:0));for(const a of animations)a.currentTime=time;root.dataset.time=String(Math.round(time));}
function tick(now){if(done)return;if(last)render(time+now-last);last=now;if(time>=DURATION){finish('complete');return}raf=requestAnimationFrame(tick);}
observer=new ResizeObserver(()=>{if(!ready||done)return;cancelAnimationFrame(resize);resize=requestAnimationFrame(()=>{try{build()}catch(e){console.warn('开屏尺寸调整失败',e);finish('error')}})});observer.observe(stage);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!done)finish('background')});
if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish('reduced-motion');return}
if(typeof stage.animate!=='function'){finish('unsupported');return}
const imgs=[...stage.querySelectorAll('img')];
Promise.all(imgs.map(im=>new Promise((resolve,reject)=>{if(im.complete){im.naturalWidth?resolve():reject(new Error('PNG unavailable'));return}im.onload=resolve;im.onerror=()=>reject(new Error('PNG unavailable'))}))).then(()=>{if(done)return;ready=true;build();siblings.forEach(n=>n.inert=true);raf=requestAnimationFrame(tick)}).catch(e=>{console.warn('开屏素材未能加载，直接进入桌面',e);finish('asset-error')});
}catch(e){console.warn('开屏未能启动，直接进入桌面',e);finish('error')}
})();
