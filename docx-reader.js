/* 雪落机：在浏览器里读取 .docx（不联网、不用第三方库）。
   window.snowDocx.read(file) → {text, paragraphs:[{text, level}]}，level 为标题级别（1-6，正文为 0）。 */
(function(){
async function inflate(bytes){
  if(typeof DecompressionStream==='undefined')throw new Error('这个浏览器太旧，读不了 docx，请把内容复制成文字粘贴。');
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(buf,wanted){
  const u=new Uint8Array(buf),dv=new DataView(buf);
  let eocd=-1;for(let i=u.length-22;i>=Math.max(0,u.length-70000);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('文件不是有效的 docx（可能是旧版 .doc，请另存为 .docx）。');
  const count=dv.getUint16(eocd+10,true);let p=dv.getUint32(eocd+16,true);const out={};const dec=new TextDecoder();
  for(let n=0;n<count;n++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),elen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
    const name=dec.decode(u.subarray(p+46,p+46+nlen));p+=46+nlen+elen+clen;
    if(!wanted.includes(name))continue;
    const ln=dv.getUint16(off+26,true),le=dv.getUint16(off+28,true);const data=u.subarray(off+30+ln+le,off+30+ln+le+csize);
    out[name]=dec.decode(method===0?data:await inflate(data));
  }
  return out;
}
async function read(file){
  if(file.size>30*1024*1024)throw new Error('文件太大（超过 30MB）。');
  const files=await unzip(await file.arrayBuffer(),['word/document.xml','word/styles.xml']);
  const xml=files['word/document.xml'];if(!xml)throw new Error('docx 里没有找到正文。');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  // 标题样式：styles.xml 里名字含 heading/标题 的样式
  const headingIds={};
  if(files['word/styles.xml']){const st=new DOMParser().parseFromString(files['word/styles.xml'],'application/xml');
    for(const s of st.getElementsByTagNameNS(W,'style')){const id=s.getAttributeNS(W,'styleId')||s.getAttribute('w:styleId');const nm=s.getElementsByTagNameNS(W,'name')[0];const name=(nm&&(nm.getAttributeNS(W,'val')||nm.getAttribute('w:val'))||'').toLowerCase();const m=name.match(/(?:heading|标题)\s*(\d)/);if(id&&m)headingIds[id]=+m[1];else if(id&&(name==='title'||name==='标题'))headingIds[id]=1}}
  const paragraphs=[];
  for(const para of doc.getElementsByTagNameNS(W,'p')){
    let t='';for(const node of para.getElementsByTagNameNS(W,'*')){if(node.localName==='t')t+=node.textContent;else if(node.localName==='tab')t+='\t';else if(node.localName==='br')t+='\n'}
    t=t.replace(/\u00a0/g,' ').trim();if(!t)continue;
    let level=0;const ps=para.getElementsByTagNameNS(W,'pStyle')[0];if(ps){const id=ps.getAttributeNS(W,'val')||ps.getAttribute('w:val');level=headingIds[id]||(/^(heading|标题)?\s*(\d)$/i.test(id||'')?+(id.match(/\d/)[0]):0)}
    const ol=para.getElementsByTagNameNS(W,'outlineLvl')[0];if(!level&&ol){const v=+(ol.getAttributeNS(W,'val')||ol.getAttribute('w:val'));if(v>=0&&v<6)level=v+1}
    paragraphs.push({text:t,level});
  }
  return {paragraphs,text:paragraphs.map(p=>p.text).join('\n')};
}
async function readAny(file){
  const name=(file.name||'').toLowerCase();
  if(name.endsWith('.docx'))return read(file);
  if(name.endsWith('.doc'))throw new Error('旧版 .doc 读不了，请在 WPS / Word 里另存为 .docx。');
  const text=await file.text();return {text,paragraphs:text.split(/\r?\n/).map(t=>t.trim()).filter(Boolean).map(t=>({text:t,level:/^#{1,6}\s/.test(t)?t.match(/^#+/)[0].length:0}))};
}
window.snowDocx={read,readAny};
})();
