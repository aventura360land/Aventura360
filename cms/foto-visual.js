import {safeUrl} from './plantilla.js';

export function visualImage(page,getState){
  const fields=new Map();
  function index(f,c){
    if(!['src','srcset','data-fallback','data-full'].includes(f.attr))return;
    const list=fields.get(f.node)||[];list.push({f,c});fields.set(f.node,list);
  }
  for(const s of page.sections||[]){
    s.fields.forEach(f=>index(f,null));
    for(const c of s.collections)for(const row of c.items)row.fields.forEach(f=>index(f,c));
  }
  function save(entry,rowId,value){
    const {f,c}=entry,t=getState().template;
    if(!c||!rowId){t.values[f.id]=value;return;}
    const rows=t.collections[c.id]??=c.items.map(i=>({id:i.id,source:i.id,values:{}}));
    const row=rows.find(r=>r.id===rowId);if(row)(row.values??={})[f.id]=value;
  }
  return (hit,node)=>{
    if(!node||node.matches('[data-layout-type=section],form,.map-layout,#reelFrame'))return null;
    const img=hit?.matches('img')?hit:node.matches('img')?node:node.querySelector('img');
    if(!img||!node.contains(img))return null;
    const block=img.closest('[data-x-block]'),list=fields.get(img.dataset.xNode)||[];
    let update;
    const full=img.closest('[data-full]');
    if(list.some(e=>e.f.attr==='src')){
      const rowId=img.closest('[data-x-item]')?.dataset.xItem;
      update=url=>{
        for(const e of list)save(e,rowId,['src','data-full'].includes(e.f.attr)?url:'');
        for(const e of fields.get(full?.dataset.xNode)||[])if(e.f.attr==='data-full')save(e,rowId,url);
      };
    }else if(block){
      const photoIndex=[...block.querySelectorAll('img')].indexOf(img);
      update=url=>{
        const owner=[...getState().pages,...getState().extras].find(o=>o.id===block.dataset.xOwner);
        const b=owner?.blocks.find(b=>b.blockId===block.dataset.xBlock);if(!b)return;
        if(b.type==='galeria')b.fotos.filter(f=>safeUrl(f.src,'image'))[photoIndex].src=url;
        else if(b.type==='paquete')b.imagen=url;else b.src=url;
      };
    }else return null;
    return {img,full,update};
  };
}
