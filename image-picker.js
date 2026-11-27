// 图片选择：给每个图片上传框加「拍照」和「相册 / 文件」两个按钮。
// 两个按钮都直接打开原来的上传框（不再另建上传框、不转交文件），
// 所以原有的读取、压缩、保存逻辑完全不变，兼容性也最好。
(()=>{
 const done=new WeakSet();
 function enhance(input){
  if(done.has(input)||input.dataset.noPicker!==undefined)return;
  const accept=input.getAttribute('accept')||'';
  if(!/image/.test(accept)||/\.json|\.docx/.test(accept))return;
  done.add(input);
  input.setAttribute('accept','image/*');
  const bar=document.createElement('span');bar.className='snow-pick';
  const cam=document.createElement('button'),lib=document.createElement('button');
  cam.type=lib.type='button';cam.textContent='📷 拍照';lib.textContent='🖼 相册 / 文件';
  const open=camera=>e=>{
   e.preventDefault();e.stopPropagation();if(input.disabled)return;
   if(camera)input.setAttribute('capture','environment');else input.removeAttribute('capture');
   input.click();
   // 打开后恢复成普通上传框，下次点「相册 / 文件」不会直接开相机。
   if(camera)setTimeout(()=>input.removeAttribute('capture'),1500);
  };
  cam.addEventListener('click',open(true));lib.addEventListener('click',open(false));
  bar.append(cam,lib);
  input.classList.add('snow-pick-original');
  const host=input.closest('label');
  if(host)host.after(bar);else input.after(bar);
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
