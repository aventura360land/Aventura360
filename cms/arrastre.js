import {textAtPoint} from './texto-visual.js';
import {describe,destination,orderedChildren} from './disposicion.js';

const unit='[data-x-layout]',section='[data-layout-type="section"]';
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
const near=(node,selector)=>node?.closest?.(selector);
const visible=node=>node.getClientRects().length>0;

// El fondo, la foto y el título de una tarjeta comparten el mismo agarre.
function itemAt(element,level){
  if(level===section)return near(element,section);
  const node=near(element,unit);
  if(!node||node.matches(section))return null;
  return near(element,'[data-layout-type="row"],#heroVisual[data-x-layout]')||node;
}
function childAt(parent,under){
  let n=under;
  while(n&&n.parentElement!==parent)n=n.parentElement;
  return n;
}
function distance(r,x,y){
  return Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));
}

export function directDrag({host,ui,move,editText,canEdit,changeImage,canChangeImage}){
  const {bar,box,tools,caption,grip,line,tip,ghost,up,down,parent,child,text,image,blocks,sections}=ui;
  let selected=null,hit=null,textPart=null,level=unit,pressed=null,drag=null,typing=false;
  let swallowClick=false,frame=0;

  function peers(){
    if(!selected)return [];
    return orderedChildren(selected.parentElement).filter(n=>visible(n)&&(n===selected||destination(selected,n,'before')));
  }
  function inner(){
    const n=near(hit,unit);
    return n!==selected&&selected?.contains(n)&&!selected.matches('#heroVisual')?n:null;
  }
  function pick(node,element=node,part=null){
    selected=node;hit=element;textPart=part;
    box.hidden=tools.hidden=!node;
    if(!node)return;
    const name=describe(node);
    caption.textContent=name;caption.title=name;
    tools.setAttribute('aria-label','Acciones de '+name);
    const siblings=peers(),i=siblings.indexOf(node);
    up.disabled=i<=0;down.disabled=i<0||i===siblings.length-1;
    parent.hidden=!near(node.parentElement,unit)||level===section;
    child.hidden=level===section||!inner();
    text.hidden=level===section||!canEdit(element,node,part);
    image.hidden=level===section||!canChangeImage(element,node);
    position();
  }
  function position(){
    if(!selected||typing||drag)return;
    const r=selected.getBoundingClientRect(),top=bar.getBoundingClientRect().bottom;
    box.hidden=tools.hidden=r.bottom<=top||r.top>=innerHeight||!r.width||!r.height;
    if(box.hidden)return;
    Object.assign(box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    const above=r.top-tools.offsetHeight;
    tools.style.top=clamp(above>=top?above:r.top,top,innerHeight-tools.offsetHeight)+'px';
    tools.style.left=clamp(r.left,4,document.documentElement.clientWidth-tools.offsetWidth-4)+'px';
  }
  function setMode(value){
    cancel();level=value;pick(null);
    blocks.setAttribute('aria-pressed',String(value===unit));
    sections.setAttribute('aria-pressed',String(value===section));
  }
  blocks.onclick=()=>setMode(unit);sections.onclick=()=>setMode(section);
  parent.onclick=()=>pick(near(selected?.parentElement,unit),hit,textPart);
  child.onclick=()=>{const n=inner();if(n)pick(n,hit,textPart);};
  text.onclick=()=>{if(selected)editText(hit,selected,textPart);};
  image.onclick=()=>{if(selected)changeImage(hit,selected);};
  function step(delta){
    const siblings=peers(),other=siblings[siblings.indexOf(selected)+delta];
    if(other&&move(selected,other,delta<0?'before':'after'))pick(selected,hit,textPart);
  }
  up.onclick=()=>step(-1);down.onclick=()=>step(1);
  grip.onkeydown=e=>{
    if(['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.key)){
      e.preventDefault();step(e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:1);
    }
  };
  const pageEvent=e=>!e.composedPath().includes(host);
  const siteControl=element=>near(element,'#avisoOk,#menuBtn,#galleryToggle');
  document.addEventListener('click',e=>{
    if(!pageEvent(e))return;
    if(typing&&near(e.target,'[data-x-writing]')){e.stopImmediatePropagation();return;}
    if(!swallowClick&&siteControl(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(!swallowClick)pick(itemAt(e.target,level),e.target,textAtPoint(e));
  },true);
  document.addEventListener('dblclick',e=>{
    if(!pageEvent(e)||typing||level===section)return;
    const n=itemAt(e.target,level);
    if(n){e.preventDefault();e.stopImmediatePropagation();editText(e.target,n,textAtPoint(e));}
  },true);
  for(const name of ['submit','auxclick','dragstart']){
    document.addEventListener(name,e=>{if(pageEvent(e)&&!typing){e.preventDefault();e.stopImmediatePropagation();}},true);
  }

  // Busca primero el hermano bajo el puntero, incluso si la foto o el título lo cubren.
  // En los huecos de una cuadrícula se usa el borde de la tarjeta visible más próxima.
  function edge(node,x,y){
    const r=node.getBoundingClientRect();
    const s=drag.node.getBoundingClientRect();
    const sameColumn=node.parentElement===drag.node.parentElement&&
      Math.min(r.right,s.right)>Math.max(r.left,s.left)+1&&(s.bottom<=r.top+2||s.top>=r.bottom-2);
    const neighbors=orderedChildren(node.parentElement).filter(n=>n!==node&&n.matches(unit)&&visible(n));
    const across=!sameColumn&&!node.matches(section)&&neighbors.some(n=>{
      const b=n.getBoundingClientRect();
      return Math.min(r.bottom,b.bottom)>Math.max(r.top,b.top)+1&&(b.left>=r.right-2||b.right<=r.left+2);
    });
    const horizontal=across&&y>=r.top&&y<=r.bottom;
    const first=horizontal?x<(r.left+r.right)/2:y<(Math.max(r.top,bar.offsetHeight)+Math.min(r.bottom,innerHeight))/2;
    return {node,r,across:horizontal,side:first?'before':'after'};
  }
  function landing(x,y){
    if(y<=bar.getBoundingClientRect().bottom)return null;
    const under=document.elementFromPoint(x,y),source=drag.node,holder=source.parentElement;
    if(!under||source.contains(under)||under===host)return null;
    if(holder.contains(under)){
      const sibling=childAt(holder,under);
      if(sibling&&destination(source,sibling,'before'))return edge(sibling,x,y);
      if(under===holder){
        let closest=null,min=Infinity;
        for(const n of peers()){
          const d=distance(n.getBoundingClientRect(),x,y);
          if(d<min){min=d;closest=n;}
        }
        return closest&&closest!==source?edge(closest,x,y):null;
      }
    }
    // Un destino externo conserva sus propios bloques, salvo al soltar directamente en un contenedor.
    const selector=source.matches(section)?section:unit;
    for(let n=near(under,selector);n;n=near(n.parentElement,selector)){
      if(n===source||source.contains(n))return null;
      if(under===n&&destination(source,n,'inside')){
        const r=n.getBoundingClientRect();
        if(y>r.top+16&&y<r.bottom-16)return {node:n,side:'inside',r,across:false};
      }
      if(destination(source,n,'before'))return edge(n,x,y);
    }
    return null;
  }
  function indicator(){
    ghost.style.left=clamp(drag.x+14,4,innerWidth-ghost.offsetWidth-4)+'px';
    ghost.style.top=clamp(drag.y+16,bar.offsetHeight,innerHeight-ghost.offsetHeight-4)+'px';
    const target=landing(drag.x,drag.y);
    line.hidden=!target;
    if(!target){tip.textContent='Busca un lugar para soltar';return null;}
    const {node,side,r,across}=target;
    tip.textContent=(side==='before'?'Antes de ':side==='after'?'Después de ':'Dentro de ')+describe(node);
    line.classList.toggle('inside',side==='inside');
    const edge=side==='before'?r.top:r.bottom,x=side==='before'?r.left:r.right;
    const top=bar.getBoundingClientRect().bottom;
    Object.assign(line.style,side==='inside'?{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}:
      across?{left:clamp(x-2,1,innerWidth-5)+'px',top:r.top+'px',width:'4px',height:r.height+'px'}:
      {left:r.left+'px',top:clamp(edge-2,top+1,innerHeight-5)+'px',width:r.width+'px',height:'4px'});
    return target;
  }
  function scrollEdge(y){
    const top=bar.getBoundingClientRect().bottom;
    return y<top+24?-1:y>innerHeight-24?1:0;
  }
  function autoScroll(now){
    if(!drag||!drag.direction)return;
    if(now-drag.entered>=550){
      const dy=drag.direction*Math.min(12,(now-drag.last)*.35);
      window.scrollBy({top:dy,behavior:'instant'});indicator();
    }
    drag.last=now;frame=requestAnimationFrame(autoScroll);
  }
  function updateEdge(){
    const direction=scrollEdge(drag.y);
    if(direction===drag.edge)return;
    cancelAnimationFrame(frame);drag.edge=direction;drag.direction=direction;
    if(direction){
      drag.last=drag.entered=performance.now();frame=requestAnimationFrame(autoScroll);
    }
  }
  function cancel(){
    const current=drag||pressed;
    pressed=null;drag=null;cancelAnimationFrame(frame);
    if(!current)return;
    if(grip.hasPointerCapture(current.id))grip.releasePointerCapture(current.id);
    line.hidden=tip.hidden=ghost.hidden=true;tools.classList.remove('dragging');
    current.node.removeAttribute('data-x-grabbed');position();
  }
  function start(e){
    const source=pressed;pressed=null;
    pick(source.node,source.hit);
    drag={...source,x:e.clientX,y:e.clientY,edge:scrollEdge(source.y),direction:0};
    grip.setPointerCapture(e.pointerId);
    window.getSelection()?.removeAllRanges();
    ghost.textContent=describe(source.node);ghost.hidden=false;
    source.node.dataset.xGrabbed='';box.hidden=true;tools.classList.add('dragging');tip.hidden=false;
  }
  grip.onpointerdown=e=>{
    if(e.button!==0||!e.isPrimary||!selected||typing)return;
    e.preventDefault();
    pressed={node:selected,hit,x:e.clientX,y:e.clientY,id:e.pointerId};grip.setPointerCapture(e.pointerId);
  };
  document.addEventListener('pointerdown',e=>{
    if(!pageEvent(e)||typing||!e.isPrimary||e.pointerType!=='mouse'||e.button!==0||siteControl(e.target))return;
    const item=itemAt(e.target,level);
    const node=item?.contains(selected)&&selected?.contains(e.target)?selected:item;
    if(node)pressed={node,hit:e.target,x:e.clientX,y:e.clientY,id:e.pointerId};
  },true);
  document.addEventListener('pointermove',e=>{
    const current=drag||pressed;
    if(!current||current.id!==e.pointerId)return;
    if(!e.buttons){cancel();return;}
    if(!drag){
      if(Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<7)return;
      start(e);
    }
    e.preventDefault();drag.x=e.clientX;drag.y=e.clientY;updateEdge();indicator();
  },{capture:true,passive:false});
  document.addEventListener('pointerup',e=>{
    if((drag||pressed)?.id!==e.pointerId)return;
    if(!drag){cancel();return;}
    const {node,hit:element}=drag,target=landing(e.clientX,e.clientY);
    const overSource=node.contains(document.elementFromPoint(e.clientX,e.clientY));
    swallowClick=true;setTimeout(()=>{swallowClick=false;},0);
    cancel();
    if(target)move(node,target.node,target.side);
    else if(!overSource)ui.status.textContent=node.dataset.layoutType==='row'
      ?'Suelta el elemento junto a otro de la misma colección.'
      :'Suelta el bloque donde aparezca la línea azul.';
    pick(node,element);
  },true);
  document.addEventListener('pointercancel',e=>{if((drag||pressed)?.id===e.pointerId)cancel();},true);
  grip.onlostpointercapture=e=>{if((drag||pressed)?.id===e.pointerId)cancel();};
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!typing){if(drag||pressed)cancel();else pick(null);}
  });
  window.addEventListener('blur',cancel);
  window.addEventListener('scroll',()=>drag?indicator():position(),{passive:true,capture:true});
  window.addEventListener('resize',position);
  return {select:node=>pick(node),writing(active){typing=active;if(active)box.hidden=tools.hidden=true;else position();}};
}
