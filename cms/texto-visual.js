import {textWithEdit} from './formato.js';

const nodes='[data-x-field],[data-x-node]';
const textChildren=el=>[...el.childNodes].filter(n=>n.nodeType===3);
function customParts(el){
  const walker=el.ownerDocument.createTreeWalker(el,NodeFilter.SHOW_TEXT),parts=[];
  while(walker.nextNode())if(walker.currentNode.data.trim())parts.push(walker.currentNode);
  return parts;
}
// El punto del clic distingue dos tramos del mismo párrafo separados por un enlace.
export function textAtPoint(event){
  const {clientX:x,clientY:y,target}=event,doc=target.ownerDocument;
  if(!doc||!target.closest)return null;
  const pos=doc.caretPositionFromPoint?.(x,y);
  const part=pos?.offsetNode||doc.caretRangeFromPoint?.(x,y)?.startContainer;
  if(part?.nodeType!==3||!target.contains(part)||!part.data.trim())return null;
  const range=doc.createRange();range.selectNodeContents(part);
  return [...range.getClientRects()].some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)?part:null;
}
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
  function choices(el){
    if(el.dataset.xField){
      const block=el.closest('[data-x-block]'),ownerId=block?.dataset.xOwner||el.dataset.xOwner;
      if(!ownerId)return [];
      const key=el.dataset.xField,idx=el.dataset.xIndex;
      return customParts(el).map(part=>({part,write(value,display){
        const state=getState(),owner=[...state.pages,...state.extras].find(o=>o.id===ownerId);
        const data=block?owner.blocks.find(b=>b.blockId===block.dataset.xBlock):owner;
        const updated=textWithEdit(part,display);
        if(idx!==undefined)data[key][Number(idx)]=updated;else data[key]=updated;
      }}));
    }
    const parts=textChildren(el),rowId=el.closest('[data-x-item]')?.dataset.xItem;
    return (fields.get(el.dataset.xNode)||[]).filter(f=>parts[f.spec.text]).map(({spec,collection})=>({
      part:parts[spec.text],write(value){
        const data=getState().template;
        if(!collection||!rowId){data.values[spec.id]=value;return;}
        const rows=data.collections[collection.id]??=collection.items.map(i=>({id:i.id,source:i.id,values:{}}));
        const row=rows.find(r=>r.id===rowId);(row.values??={})[spec.id]=value;
      }
    }));
  }
  return (hit,unit,clicked)=>{
    if(!hit||!unit||unit.matches('[data-layout-type=section],form,.map-layout,#reelFrame')||hit.closest('form,svg,button[disabled]'))return null;
    if(clicked&&hit.contains(clicked)){
      const el=clicked.parentElement.closest(nodes);
      if(el&&unit.contains(el))return choices(el).find(entry=>entry.part===clicked)||null;
    }
    const local=hit.closest(nodes);
    if(local&&unit.contains(local)){
      const options=choices(local).filter(f=>hit.contains(f.part));
      if(options.length)return options.length===1?options[0]:null;
    }
    // Un botón de texto solo elige automáticamente cuando existe un único campo posible.
    const options=[hit,...hit.querySelectorAll(nodes)].flatMap(choices);
    return options.length===1?options[0]:null;
  };
}
