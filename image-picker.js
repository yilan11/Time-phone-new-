// 图片选择：给每个图片上传框加「拍照」和「相册 / 文件」两个按钮。
// 拍照直接打开相机；相册 / 文件打开手机的照片和文件选择器。
// 选好的图片会交回原来的上传框，原有的读取、压缩和保存逻辑不变。
(()=>{
 const done=new WeakSet();
 function hand(target,file){
  try{const dt=new DataTransfer();dt.items.add(file);target.files=dt.files;}catch{return;}
  target.dispatchEvent(new Event('input',{bubbles:true}));
  target.dispatchEvent(new Event('change',{bubbles:true}));
 }
 function picker(capture){
  const p=document.createElement('input');p.type='file';p.accept='image/*';p.hidden=true;p.dataset.noPicker='';
  if(capture)p.setAttribute('capture','environment');
  return p;
 }
 function enhance(input){
  if(done.has(input)||input.dataset.noPicker!==undefined)return;
  const accept=(input.getAttribute('accept')||'');
  if(!/image/.test(accept)||/\.json|\.docx/.test(accept))return;
  done.add(input);
  input.setAttribute('accept','image/*');
  const bar=document.createElement('span');bar.className='snow-pick';
  const cam=document.createElement('button'),lib=document.createElement('button');
  cam.type=lib.type='button';cam.textContent='📷 拍照';lib.textContent='🖼 相册 / 文件';
  const pc=picker(true),pl=picker(false);
  for(const [btn,p] of [[cam,pc],[lib,pl]]){
   btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!input.disabled)p.click();});
   p.addEventListener('change',()=>{const f=p.files&&p.files[0];if(f)hand(input,f);p.value='';});
  }
  bar.append(cam,lib,pc,pl);
  input.classList.add('snow-pick-original');
  // 原上传框在 label 里时，按钮放在 label 后面，避免点按钮又触发 label。
  const host=input.closest('label');
  if(host)host.after(bar);else input.after(bar);
  // 原上传框被禁用时，按钮也跟着禁用。
  const sync=()=>{cam.disabled=lib.disabled=input.disabled;};sync();
  new MutationObserver(sync).observe(input,{attributes:true,attributeFilter:['disabled']});
 }
 function scan(root){
  if(root.matches?.('input[type=file]'))enhance(root);
  root.querySelectorAll?.('input[type=file]').forEach(enhance);
 }
 const start=()=>{scan(document.body);new MutationObserver(list=>{for(const m of list)m.addedNodes.forEach(n=>n.nodeType===1&&scan(n));}).observe(document.body,{childList:true,subtree:true});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
