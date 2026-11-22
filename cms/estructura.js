import {describe,layoutKey,orderedChildren} from './disposicion.js';

export const unitSelector='[data-x-layout]';
const glyphs={section:'▤',row:'▣',group:'▦',h1:'T',h2:'T',h3:'T',h4:'T',p:'¶',img:'▧',figure:'▧',picture:'▧',video:'▷',button:'↗',a:'↗',form:'▤'};

export function labelOf(node){
  if(node.id==='heroVisual')return {kind:'Imagen',name:node.querySelector('img')?.alt||'Imagen de portada'};
  const raw=describe(node),separator=raw.indexOf(' · ');
  const kind=separator===-1?raw:raw.slice(0,separator);
  if(node.matches('.gallery-item,.group-stay-photo')){
    return {kind:'Foto',name:node.querySelector('img[alt]')?.alt||raw};
  }
  const type=node.matches('.service-card')?'Tarjeta':node.querySelector(':scope > .xc-package')?'Paquete':kind;
  const collectionNames={servicesGrid:'Tarjetas de experiencias',galleryGrid:'Fotos de la galería'};
  return {kind:type,name:collectionNames[node.id]||(separator===-1?type:raw.slice(separator+3))};
}

function element(tag,cls,text){
  const node=document.createElement(tag);node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
}

export function outline(list,onSelect){
  const nodesByKey=new Map(),rows=new Map(),parents=new Map(),expanded=new Set(),outerGroups=new Map();
  let selection=null;
  function reveal(){
    const row=rows.get(selection);
    if(!row||!list.clientHeight||!row.getClientRects().length)return;
    const from=list.getBoundingClientRect(),to=row.getBoundingClientRect();
    if(to.top<from.top+4)list.scrollTop+=to.top-from.top-4;
    else if(to.bottom>from.bottom-4)list.scrollTop+=to.bottom-from.bottom+4;
  }
  new ResizeObserver(reveal).observe(list);
  function render(keepVisible=false){
    const scroll=list.scrollTop;
    nodesByKey.clear();rows.clear();parents.clear();
    function visit(node,parent,depth,holder){
      if(node.matches('script,style,dialog,template,noscript')||node.hidden||node.hasAttribute('data-layout-hidden'))return;
      const key=layoutKey(node);
      if(!key){
        for(const child of orderedChildren(node))visit(child,parent,depth,holder);
        return;
      }
      const item=element('div','outline-item'),row=element('div','outline-row'),children=element('div','outline-children');
      const {kind,name}=labelOf(node);
      nodesByKey.set(key,node);rows.set(node,row);parents.set(node,parent);
      row.dataset.key=key;row.style.setProperty('--depth',Math.min(depth,5));
      const expand=element('button','expand','›');expand.type='button';
      const select=element('button','outline-select');select.type='button';
      const icon=element('span','outline-icon',glyphs[node.dataset.layoutType]||'□');icon.setAttribute('aria-hidden','true');
      const caption=element('span','outline-name',name);
      select.title=kind+' · '+name;select.append(icon,caption);
      select.onclick=()=>onSelect(node);
      const grip=element('span','outline-grip','⠿');grip.dataset.grip='';grip.setAttribute('aria-hidden','true');
      row.append(expand,select,grip);item.append(row,children);holder.append(item);
      for(const child of orderedChildren(node))visit(child,node,depth+1,children);
      expand.disabled=!children.childElementCount;
      const sync=()=>{
        const open=expanded.has(node);children.hidden=!open;
        expand.setAttribute('aria-expanded',String(open));
        expand.setAttribute('aria-label',(open?'Contraer ':'Expandir ')+name);
      };
      expand.onclick=()=>{if(!expanded.delete(node))expanded.add(node);sync();};
      sync();
      if(node===selection){row.dataset.selected='';select.setAttribute('aria-current','true');}
    }
    const fragment=document.createDocumentFragment();
    const main=document.querySelector('body > main');
    if(main)visit(main,null,0,fragment);
    for(const [tag,label] of [['header','Cabecera'],['footer','Pie de página']]){
      const root=document.querySelector('body > '+tag);
      if(!root)continue;
      const group=element('details','outline-group'),summary=element('summary','outline-summary',label);
      group.append(summary);visit(root,null,1,group);
      if(group.childElementCount===1)continue;
      group.open=outerGroups.get(tag)||root.contains(selection);
      group.ontoggle=()=>outerGroups.set(tag,group.open);
      fragment.append(group);
    }
    if(selection){
      for(let n=parents.get(selection);n;n=parents.get(n)){
        expanded.add(n);const row=rows.get(n);
        row.firstElementChild.setAttribute('aria-expanded','true');
        row.firstElementChild.setAttribute('aria-label','Contraer '+labelOf(n).name);
        row.nextElementSibling.hidden=false;
      }
    }
    list.replaceChildren(fragment);list.scrollTop=scroll;
    if(keepVisible)reveal();
  }
  return {
    refresh:render,
    select(node){
      selection=node;
      if(node&&rows.has(node)&&!rows.get(node).getClientRects().length&&!list.closest('[hidden]'))render(true);
      else{
        list.querySelector('[data-selected]')?.removeAttribute('data-selected');
        list.querySelector('[aria-current]')?.removeAttribute('aria-current');
        const row=rows.get(node);
        if(row){row.dataset.selected='';row.querySelector('.outline-select').setAttribute('aria-current','true');reveal();}
      }
    },
    nodeFor:row=>nodesByKey.get(row?.dataset.key)
  };
}
