/* 独立 HTML 试点：只读写本应用存储，不访问父页面或全局导航。 */
(()=>{
'use strict';
const KEY='snowfall-app-notes-demo-v1';
const form=document.getElementById('notes-form');
const title=document.getElementById('notes-title');
const body=document.getElementById('notes-body');
const status=document.getElementById('notes-status');
const count=document.getElementById('notes-count');
let readable=true,dirty=false;
function message(text,error=false){status.textContent=text;status.dataset.error=String(error);}
function updateCount(){count.textContent=Array.from(body.value).length+' 字';}
function savedMessage(time){message('已保存在本机 · '+new Date(time).toLocaleString('zh-CN'));}
try{
  const raw=localStorage.getItem(KEY);
  if(raw!==null){
    const data=JSON.parse(raw);
    if(!data||data.version!==1||typeof data.title!=='string'||typeof data.body!=='string'||data.title.length>120||data.body.length>50000||!Number.isFinite(data.updatedAt)||data.updatedAt<=0)throw Error('invalid notes');
    title.value=data.title;body.value=data.body;savedMessage(data.updatedAt);
  }else message('还没有备忘录，写下内容就会自动保存。');
}catch(error){
  readable=false;
  message('原记录无法读取，已停止写入以保护旧数据。可以临时编辑，但请先复制内容到其他地方备份；本页不会覆盖原记录。',true);
}
function save(){
  if(!readable){message('未保存：原记录读取异常，已保护原数据。请复制当前文字到其他地方备份。',true);return false;}
  const now=Date.now();
  try{
    localStorage.setItem(KEY,JSON.stringify({version:1,title:title.value,body:body.value,updatedAt:now}));
    dirty=false;savedMessage(now);return true;
  }catch(error){message('保存失败：本机存储不可用或已满。当前文字仍在页面中，请先复制备份，不要关闭或刷新。',true);return false;}
}
form.addEventListener('input',()=>{dirty=true;updateCount();save();});
form.addEventListener('submit',event=>{event.preventDefault();save();});
window.addEventListener('pagehide',()=>{if(dirty)save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)save();});
updateCount();
})();
