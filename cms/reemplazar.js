import {appearanceFields} from './apariencia.js';
export function replaceAsset(state,catalog,dynamic,oldUrl,newUrl){
  if(oldUrl===newUrl)return 0;
  let count=0;
  function visitFields(fields,target,base={}){
    const replacedPrimary=new Set(fields.filter(f=>['src','href'].includes(f.attr)&&(target[f.id]??base[f.id]??f.value)===oldUrl).map(f=>f.node));
    for(const f of fields){
      const val=target[f.id]??base[f.id]??f.value;
      if(['image','video'].includes(f.type)&&val===oldUrl){target[f.id]=newUrl;count++;}
      if(f.type==='srcset'&&typeof val==='string'){
        const parts=val.split(',').map(x=>x.trim().split(/\s+/));
        if(replacedPrimary.has(f.node)){target[f.id]='';count++;}
        else if(parts.some(([url])=>url===oldUrl)){
          target[f.id]=parts.map(([url,...size])=>[url===oldUrl?newUrl:url,...size].join(' ')).join(', ');count++;
        }
      }
    }
  }
  function walk(obj){
    if(!obj||typeof obj!=='object')return;
    for(const [k,v] of Object.entries(obj)){
      if(['src','poster','imagen'].includes(k)&&v===oldUrl){obj[k]=newUrl;count++;}
      else if(v&&typeof v==='object')walk(v);
    }
  }
  const global=state.template.values;
  for(const p of catalog.pages)for(const s of p.sections){
    visitFields(s.fields,global);
    for(const c of s.collections){
      const rows=state.template.collections[c.id]||[];
      for(const row of rows){const item=c.items.find(i=>i.id===row.source);if(item)visitFields(item.fields,row.values??={},global);}
      for(const item of c.items)visitFields(item.fields,global);
    }
  }
  state.dynamic??=structuredClone(dynamic);walk(state.dynamic);walk(state.pages);walk(state.extras);
  state.appearance??={};for(const f of appearanceFields)if(f.type==='image'&&(state.appearance[f.id]??f.value)===oldUrl){state.appearance[f.id]=newUrl;count++;}
  return count;
}
