// Vincula texto visible con el campo original sin sustituir enlaces, iconos ni controles.
export function visualText(page,getState){
  const fields=new Map();
  for(const section of page.sections||[]){
    function index(spec,collection){
      if(!Number.isInteger(spec.text))return;
      const list=fields.get(spec.node)||[];list.push({spec,collection});fields.set(spec.node,list);
    }
    section.fields.forEach(f=>index(f,null));
    for(const c of section.collections)for(const item of c.items)item.fields.forEach(f=>index(f,c));
  }
  function binding(hit,unit){
    if(!hit||unit.matches('[data-layout-type=section],form,.map-layout,#reelFrame')||hit.closest('form,svg,button[disabled]'))return null;
    const block=hit.closest('[data-x-block]');
    let node=hit.closest('[data-x-node]');
    if(!node||!fields.has(node.dataset.xNode)||!unit.contains(node)){
      node=[unit,...unit.querySelectorAll('[data-x-node]')].find(n=>fields.has(n.dataset.xNode));
    }
    if(!block&&node){
      const texts=[...node.childNodes].filter(t=>t.nodeType===3);
      const field=fields.get(node.dataset.xNode)?.find(f=>texts[f.spec.text]?.data.trim());
      if(field){
        const rowId=node.closest('[data-x-item]')?.dataset.xItem;
        return {part:texts[field.spec.text],write(value){
          const data=getState().template,{spec,collection}=field;
          if(collection&&rowId){
            const rows=data.collections[collection.id]??=collection.items.map(i=>({id:i.id,source:i.id,values:{}}));
            const row=rows.find(r=>r.id===rowId);if(!row)return;(row.values??={})[spec.id]=value;
          }else data.values[spec.id]=value;
        }};
      }
    }
    const area=hit.closest('.xc-section,#page-content');
    if(!area&&!block)return null;
    const leaf=hit.closest('h1,h2,h3,p,figcaption,strong,.xc-button')||unit.querySelector('h1,h2,h3,p,figcaption,strong,.xc-button');
    if(!leaf||leaf.childElementCount||leaf.childNodes.length!==1||leaf.firstChild.nodeType!==3)return null;
    const ownerId=block?.dataset.xOwner||(area?.matches('.xc-section')?area.id.slice(8):page.id);
    const owner=()=>[...getState().pages,...getState().extras].find(o=>o.id===ownerId);
    const model=()=>block?owner()?.blocks.find(b=>b.blockId===block.dataset.xBlock):owner();
    const b=model();if(!b)return null;
    const key=leaf.matches('h1,h2,h3')?'titulo':leaf.matches('figcaption')?'pie':leaf.matches('strong')?'precio':
      leaf.matches('.xc-button')?'etiqueta':!block?'descripcion':b.type==='paquete'?(leaf===block.querySelector('p')&&b.duracion?'duracion':'descripcion'):'texto';
    return typeof b[key]==='string'?{part:leaf.firstChild,write:v=>{model()[key]=v;}}:null;
  }
  return binding;
}
