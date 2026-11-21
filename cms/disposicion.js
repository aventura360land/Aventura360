// Las claves se calculan sobre la plantilla, antes de trasladar ningún nodo.
// Cada fila y cada bloque tiene su propio espacio de claves, incluso al duplicarse.
const keyAttr='data-x-layout';
const unitSelector='['+keyAttr+']';
const widgets='form,.map-layout,#reelFrame,.marquee-track,.xr-grid > div,.gallery-more,.toc';
const atomic=widgets+',a,button,figure,picture,video,.xc-block,h1,h2,h3,h4,p,li';
const elements='div,aside,article,nav,section,figure,picture,video,img,h1,h2,h3,h4,p,ul,ol,li,a,button,span,strong,small,form';
const kinds={section:'Sección',row:'Elemento',group:'Grupo',h1:'Título',h2:'Título',h3:'Subtítulo',h4:'Subtítulo',p:'Párrafo',a:'Enlace',button:'Botón',img:'Imagen',figure:'Imagen',picture:'Imagen',video:'Video',form:'Formulario',ul:'Lista',ol:'Lista',li:'Elemento de lista'};
const alignments=['left','center','right'];
export const spacings={'compacto':'0','corto':'0.75rem','medio':'1.5rem','amplio':'3rem'};
function short(value){return (value||'').replace(/\s+/g,' ').trim().slice(0,66);}
function encode(value){return encodeURIComponent(value);}
export function pageLayout(state,page,write=false){
  if(!page)return;
  if(!page.sections)return write?(page.layout??={}):page.layout;
  if(write)return (state.template.layout??={})[page.id]??={};
  return state.template.layout?.[page.id];
}
export function layoutUnits(doc){return [...doc.querySelectorAll(unitSelector)];}
export function layoutKey(node){return node?.getAttribute(keyAttr);}
const reversedGroups='.experience-story.air,.group-stay-card';
export function orderedChildren(parent){
  const nodes=[...parent.children];
  const view=parent.ownerDocument.defaultView;
  if(!view||!parent.matches(reversedGroups)||parent.hasAttribute('data-layout-ordered'))return nodes;
  const order=new Map(nodes.map(n=>[n,Number(view.getComputedStyle(n).order)]));
  return nodes.sort((a,b)=>order.get(a)-order.get(b));
}
export function describe(node){
  if(!node)return '';
  const type=node.dataset.layoutType,tag=node.localName;
  const kind=kinds[type]||kinds[tag]||(node.matches('.xc-block')?'Bloque':'Texto');
  const name=node.dataset.layoutName||node.getAttribute('aria-label')||node.getAttribute('alt')||
    node.querySelector('h1,h2,h3,h4')?.textContent||node.querySelector('img[alt]')?.alt||node.textContent;
  return short(name)?kind+' · '+short(name):kind;
}
function register(doc,page){
  const nodes=new Map();
  const sectionNames=new Map((page?.sections||[]).map(s=>[s.id,s.label]));
  const index=new WeakMap();
  function visit(node,parentKey,scope){
    const tag=node.localName;
    if(!tag||node.namespaceURI!=='http://www.w3.org/1999/xhtml'||node.matches('script,style,noscript,template,dialog,source,track,input,textarea,fieldset,select'))return;
    let key;
    const data=node.dataset,item=data.xItem,collection=data.xCollection,section=data.xSection;
    const extra=node.matches('.xc-section');
    const block=data.xBlock;
    if(section)key='s:'+encode(section);
    else if(extra)key='e:'+encode(node.id);
    else if(block)key='b:'+(page.sections?encode(data.xOwner):'page')+'/'+encode(block);
    else if(item)key='r:'+encode(node.parentElement.dataset.xCollection||'')+'/'+encode(item);
    else if(collection)key='c:'+encode(collection);
    else if(data.xNode)key=scope+'/n:'+encode(data.xNode);
    else if(node.id)key=scope+'/id:'+encode(node.id);
    else{
      // Los hermanos añadidos por el CMS no cambian la identidad de los originales.
      let counts=index.get(node.parentElement);
      if(!counts){counts=new Map();index.set(node.parentElement,counts);}
      const i=(counts.get(tag)||0)+1;counts.set(tag,i);key=parentKey+'/'+tag+i;
    }
    if(section||item||extra||collection)scope=key;
    const shell=node.matches('body > main,body > header,body > footer,#page-content,.legal-body,.xc-wrap')||
      node.classList.contains('wrap')&&!collection;
    const group=node.matches('div,article,aside,section,nav');
    const isUnit=!shell&&(section||extra||block||collection||item||node.matches(elements));
    if(isUnit){
      nodes.set(key,node);node.setAttribute(keyAttr,key);
      data.layoutType=section||extra?'section':item?'row':group&&!block?'group':tag;
      if(section)data.layoutName=sectionNames.get(section)||section;
      if(extra)data.layoutName=node.querySelector('.xc-wrap > h2')?.textContent||'Sección de bloques';
      if(block)data.layoutName=node.querySelector('h3,figcaption,.xc-button')?.textContent||node.querySelector('img')?.alt||node.textContent||'Bloque de contenido';
      if(group&&!collection&&!node.matches(widgets)&&!block&&!item)data.layoutContainer='1';
    }
    if(node.matches(atomic)||block)return;
    if(!collection&&(shell||group))node.dataset.xLayoutSlot=key;
    for(const child of node.children)visit(child,key,scope);
  }
  for(const root of doc.querySelectorAll('body > main,body > header,body > footer'))visit(root,'',root.tagName.toLowerCase());
  return nodes;
}
function originZone(node){
  const collection=node.closest('[data-x-item]');
  if(collection&&collection!==node)return layoutKey(collection);
  return node.closest('main,body > header,body > footer')?.tagName;
}
export function destination(source,target,side){
  if(!layoutKey(source)||!layoutKey(target)||source===target||source.contains(target)||!['before','after','inside'].includes(side))return null;
  const type=source.dataset.layoutType,targetType=target.dataset.layoutType;
  if(type==='section'){
    if(side==='inside'||targetType!=='section')return null;
    if(source.hasAttribute('data-x-section')&&source.parentElement!==target.parentElement)return null;
  }else if(type==='row'||source.matches('li,[role=listitem]')){
    if(side==='inside'||source.parentElement!==target.parentElement||type!==targetType||source.tagName!==target.tagName)return null;
  }else{
    if(originZone(source)!==originZone(target))return null;
    if(side==='inside'){
      if(!target.dataset.layoutContainer)return null;
    }else if(targetType==='section'||targetType==='row'||target.matches('li,[role=listitem]'))return null;
  }
  const parent=side==='inside'?(target.matches('[data-x-section],.xc-section')?target.querySelector(':scope > .wrap,:scope > .xc-wrap')||target:target):target.parentElement;
  if(!parent||parent.matches('ul,ol,[data-x-collection]')&&type!=='row'&&!source.matches('li'))return null;
  if(source===parent||source.contains(parent))return null;
  const before=side==='inside'?null:side==='before'?target:target.nextSibling;
  return {parent,before};
}
export function place(source,target,side,replay=false){
  const where=destination(source,target,side);
  if(!where)return false;
  const {parent,before}=where;
  if(parent===source.parentElement&&!(replay&&parent.matches(reversedGroups))){
    const siblings=orderedChildren(parent),i=siblings.indexOf(source);
    if(side==='before'&&siblings[i+1]===target||side==='after'&&siblings[i-1]===target||
      side==='inside'&&i===siblings.length-1)return false;
  }
  parent.insertBefore(source,before);
  if(parent.matches(reversedGroups))parent.dataset.layoutOrdered='';
  if(source.dataset.layoutType==='section'&&parent.matches('main')&&parent.querySelector(':scope > #inicio')){
    [...parent.children].forEach((child,i)=>child.style.order=String(i+1));
  }
  return true;
}
export function applyStyle(node,style={}){
  const css=node.style,attr='data-layout-hidden';
  node.toggleAttribute(attr,style.hidden===true);
  if(alignments.includes(style.align))node.dataset.layoutAlign=style.align;else delete node.dataset.layoutAlign;
  node.toggleAttribute('data-layout-spaced',Object.hasOwn(spacings,style.space));
  for(const [key,property,allowed] of [['align','text-align',alignments],['space','margin-block-start',Object.keys(spacings)]]){
    const original='layoutOriginal'+key,priority=original+'Priority';
    if(allowed.includes(style[key])){
      if(!Object.hasOwn(node.dataset,original)){node.dataset[original]=css.getPropertyValue(property);node.dataset[priority]=css.getPropertyPriority(property);}
      css.setProperty(property,key==='align'?style.align:spacings[style.space],'important');
    }else if(Object.hasOwn(node.dataset,original)){
      css.setProperty(property,node.dataset[original],node.dataset[priority]);
      delete node.dataset[original];delete node.dataset[priority];
    }
  }
}
export function mountLayout(doc,page,layout){
  const nodes=register(doc,page);
  if(Array.isArray(layout?.moves)){
    const slots=new Map([...doc.querySelectorAll('[data-x-layout-slot]')].map(n=>[n.dataset.xLayoutSlot,n]));
    for(const move of layout.moves){
      if(!move)continue;
      const source=nodes.get(move.from),target=nodes.get(move.to);
      if(!source)continue;
      if(target){place(source,target,move.side,true);continue;}
      // Si se eliminó el destino, conserva la posición usando sus vecinos o su contenedor.
      const slot=slots.get(move.slot);
      if(!slot||source.contains(slot)||originZone(source)!==originZone(slot))continue;
      const next=nodes.get(move.next),prev=nodes.get(move.prev);
      if(next?.parentElement===slot)place(source,next,'before');
      else if(prev?.parentElement===slot)place(source,prev,'after');
      else if(!source.matches('[data-x-item],li,[role=listitem],[data-layout-type=section]'))slot.append(source);
    }
  }
  if(layout?.styles)for(const [key,style] of Object.entries(layout.styles))if(nodes.has(key)&&style)applyStyle(nodes.get(key),style);
  const css=doc.createElement('style');css.textContent=`
    [data-layout-hidden]{display:none!important}
    [data-layout-ordered] > *{order:0!important}
    :is(span,strong,small)[data-layout-spaced]{display:inline-block}
    :is(img,figure,picture,video,button,a,span,strong,small)[data-layout-align]{
      display:block;width:fit-content;max-width:100%;box-sizing:border-box;
    }
    :is(img,figure,picture,video,button,a,span,strong,small)[data-layout-align=left]{margin-inline:0 auto}
    :is(img,figure,picture,video,button,a,span,strong,small)[data-layout-align=center]{margin-inline:auto}
    :is(img,figure,picture,video,button,a,span,strong,small)[data-layout-align=right]{margin-inline:auto 0}
  `;doc.head.append(css);
}

export function recordMove(state,page,a,b,position){
  // Las filas siguen compartiendo el mismo orden con el editor de colecciones.
  if(a.dataset.layoutType==='row'&&a.parentElement===b.parentElement){
    const id=a.parentElement.dataset.xCollection;
    const collection=page.sections?.flatMap(s=>s.collections).find(c=>c.id===id);
    if(collection){
      const rows=state.template.collections[id]??=collection.items.map(i=>({id:i.id,source:i.id,values:{}}));
      const ordering=new Map([...a.parentElement.children].map((child,i)=>[child.dataset.xItem,i]));
      rows.sort((x,y)=>ordering.get(x.id)-ordering.get(y.id));return;
    }
  }
  if(a.dataset.layoutType==='section'&&page.sections){
    const parent=a.parentElement;
    const sections=[...parent.children].filter(n=>n.hasAttribute('data-x-section'));
    if(sections.length){
      const visibility=new Map((state.template.sections[page.id]||[]).map(s=>[s.id,s.visible]));
      state.template.sections[page.id]=sections.map(n=>({id:n.dataset.xSection,visible:visibility.get(n.dataset.xSection)!==false}));
    }
    const extras=state.extras,byId=new Map(extras.map(x=>['seccion-'+x.id,x]));
    let preceding='';const ordered=[];
    for(const n of parent.children){
      if(n.hasAttribute('data-x-section')){preceding=n.dataset.xSection;continue;}
      const extra=byId.get(n.id);if(!extra)continue;
      extra.after=preceding;
      if(!preceding&&sections.length)extra.beforeFirst=true;else delete extra.beforeFirst;
      ordered.push(extra);
    }
    const set=new Set(ordered);let index=0;
    state.extras=extras.map(x=>set.has(x)?ordered[index++]:x);
    return;
  }
  const layout=pageLayout(state,page,true);
  const move={from:layoutKey(a),to:layoutKey(b),side:position};
  const slot=a.parentElement.dataset.xLayoutSlot;
  if(slot){
    move.slot=slot;
    const previous=layoutKey(a.previousElementSibling),next=layoutKey(a.nextElementSibling);
    if(previous)move.prev=previous;if(next)move.next=next;
  }
  (layout.moves??=[]).push(move);
}
