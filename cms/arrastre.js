import {describe,destination} from './disposicion.js';

const unit='[data-x-layout]',section='[data-layout-type="section"]';
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
const near=(node,rule)=>node?.closest?.(rule);

// Pointer Events conserva el agarre al pasar del botón al documento, también con el dedo.
export function directDrag({host,ui,move,editText,canEdit,changeImage,canChangeImage}){
  const {bar,box,tools,caption,grip,line,tip,ghost,up,down,parent,text,image,blocks,sections}=ui;
  let selected=null,hit=null,level=unit,pinned=false,drag=null,target=null,frame=0,typing=false;
  let pressed=null,swallowClick=false;
  function peers(){
    return [...(selected?.parentElement?.children||[])].filter(n=>n===selected||destination(selected,n,'before'));
  }
  function pick(node,element=node,lock=false){
    selected=node;hit=element;pinned=lock;
    box.hidden=tools.hidden=!node;
    if(!node)return;
    caption.textContent=describe(node).split(' · ')[0];
    tools.setAttribute('aria-label','Acciones de '+describe(node));
    const siblings=peers(),i=siblings.indexOf(node);
    up.disabled=i<=0;down.disabled=i<0||i===siblings.length-1;
    parent.hidden=!near(node.parentElement,unit)||level===section;
    text.hidden=level===section||!canEdit(element,node);
    image.hidden=level===section||!canChangeImage(element,node);
    position();
  }
  function position(){
    if(!selected||typing||drag)return;
    const r=selected.getBoundingClientRect(),top=bar.getBoundingClientRect().bottom;
    const visible=r.bottom>top&&r.top<innerHeight&&r.width>0&&r.height>0;
    box.hidden=tools.hidden=!visible;if(!visible)return;
    Object.assign(box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
    const y=r.top-tools.offsetHeight;
    tools.style.top=clamp(y>=top?y:Math.max(r.top,top),top,innerHeight-tools.offsetHeight)+'px';
    tools.style.left=clamp(r.left,4,innerWidth-tools.offsetWidth-4)+'px';
  }
  function setMode(value){
    level=value;pick(null);blocks.setAttribute('aria-pressed',String(value===unit));sections.setAttribute('aria-pressed',String(value===section));
  }
  blocks.onclick=()=>setMode(unit);sections.onclick=()=>setMode(section);
  parent.onclick=()=>pick(near(selected?.parentElement,unit),undefined,true);
  text.onclick=()=>{if(selected)editText(hit,selected);};
  image.onclick=()=>{if(selected)changeImage(hit,selected);};
  function step(delta){
    const siblings=peers(),other=siblings[siblings.indexOf(selected)+delta];
    if(other&&move(selected,other,delta<0?'before':'after')){
      selected.scrollIntoView({block:'nearest',inline:'nearest'});pick(selected,hit,true);
    }
  }
  up.onclick=()=>step(-1);down.onclick=()=>step(1);
  grip.onkeydown=e=>{
    if(['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.key)){
      e.preventDefault();step(e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:1);
    }
  };
  function pageEvent(e){return !e.composedPath().includes(host);}
  document.addEventListener('pointermove',e=>{
    if(!pageEvent(e)||pinned||typing||drag||e.pointerType==='touch'||e.buttons)return;
    const n=near(e.target,level);
    if(n&&n!==selected)pick(n,e.target);
    else if(n&&hit!==e.target){hit=e.target;text.hidden=level===section||!canEdit(hit,n);image.hidden=level===section||!canChangeImage(hit,n);}
  },true);
  document.addEventListener('click',e=>{
    if(!pageEvent(e))return;
    if(typing&&near(e.target,'[data-x-writing]')){e.stopImmediatePropagation();return;}
    if(!swallowClick&&near(e.target,'#avisoOk,#menuBtn,#galleryToggle'))return;
    if(swallowClick){e.preventDefault();e.stopImmediatePropagation();swallowClick=false;return;}
    e.preventDefault();e.stopImmediatePropagation();
    const n=near(e.target,level);pick(n,e.target,!!n);
  },true);
  document.addEventListener('dblclick',e=>{
    if(!pageEvent(e)||typing||level===section)return;
    const n=near(e.target,level);
    if(n){e.preventDefault();e.stopImmediatePropagation();editText(e.target,n);}
  },true);
  document.addEventListener('submit',e=>{if(pageEvent(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
  // Bloquea la apertura de enlaces (incluido el clic de rueda) mientras se edita.
  document.addEventListener('auxclick',e=>{if(pageEvent(e)){e.preventDefault();e.stopImmediatePropagation();}},true);
  function landing(x,y){
    if(y<=bar.getBoundingClientRect().bottom)return null;
    const under=document.elementFromPoint(x,y);
    let n=near(under,selected.matches(section)?section:unit);
    while(n){
      if(n===selected||selected.contains(n))return null;
      const r=n.getBoundingClientRect();
      const s=n.nextElementSibling||n.previousElementSibling,neighbor=s?.getBoundingClientRect();
      const across=!n.matches(section)&&neighbor&&Math.min(r.bottom,neighbor.bottom)>Math.max(r.top,neighbor.top)&&
        (neighbor.left>=r.right-2||neighbor.right<=r.left+2);
      const first=across?x<(r.left+r.right)/2:y<(Math.max(r.top,bar.offsetHeight)+Math.min(r.bottom,innerHeight))/2;
      let side=first?'before':'after';
      const interior=under===n&&y>r.top+Math.min(r.height*.25,32)&&y<r.bottom-Math.min(r.height*.25,32);
      if(interior&&destination(selected,n,'inside'))return {node:n,side:'inside',r,across:false};
      if(destination(selected,n,side))return {node:n,side,r,across};
      if(destination(selected,n,'inside'))return {node:n,side:'inside',r,across:false};
      n=near(n.parentElement,selected.matches(section)?section:unit);
    }
    return null;
  }
  function indicator(){
    ghost.style.left=clamp(drag.x+14,4,innerWidth-ghost.offsetWidth-4)+'px';
    ghost.style.top=clamp(drag.y+16,bar.offsetHeight,innerHeight-ghost.offsetHeight-4)+'px';
    target=landing(drag.x,drag.y);line.hidden=!target;
    if(!target){tip.textContent='Busca un lugar para soltar';return;}
    const {node,side,r,across}=target;
    tip.textContent=(side==='before'?'Antes de ':side==='after'?'Después de ':'Dentro de ')+describe(node);
    line.classList.toggle('inside',side==='inside');
    const edge=side==='before'?r.top:r.bottom,x=side==='before'?r.left:r.right;
    const top=bar.getBoundingClientRect().bottom;
    Object.assign(line.style,side==='inside'?{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}:
      across?{left:clamp(x-2,1,innerWidth-5)+'px',top:r.top+'px',width:'4px',height:r.height+'px'}:
      {left:r.left+'px',top:clamp(edge-2,top+1,innerHeight-5)+'px',width:r.width+'px',height:'4px'});
  }
  function tick(){
    if(!drag)return;
    const barEnd=bar.getBoundingClientRect().bottom;
    let dy=0;
    if(drag.y<barEnd+65)dy=-Math.ceil(clamp((barEnd+65-drag.y)/3,0,24));
    if(drag.y>innerHeight-75)dy=Math.ceil(clamp((drag.y-innerHeight+75)/3,0,24));
    if(dy)window.scrollBy({top:dy,behavior:'instant'});
    indicator();frame=requestAnimationFrame(tick);
  }
  function cancel(){
    if(!drag)return;
    const id=drag.id;drag=null;pressed=null;cancelAnimationFrame(frame);target=null;
    if(grip.hasPointerCapture(id))grip.releasePointerCapture(id);
    line.hidden=tip.hidden=ghost.hidden=true;tools.classList.remove('dragging');
    selected?.removeAttribute('data-x-grabbed');position();
  }
  function start(e){
    if(!selected||typing||drag)return;
    e.preventDefault();pinned=true;window.getSelection()?.removeAllRanges();
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};grip.setPointerCapture(e.pointerId);
    ghost.replaceChildren();
    const photo=selected.matches('img')?selected:selected.matches('picture,figure,.xc-block')?selected.querySelector('img'):null;
    if(photo){const thumb=document.createElement('img');thumb.src=photo.currentSrc||photo.src;thumb.alt='';ghost.append(thumb);}
    ghost.append(describe(selected));ghost.hidden=false;
    selected.dataset.xGrabbed='';box.hidden=true;tools.classList.add('dragging');tip.hidden=false;
    tick();
  }
  grip.onpointerdown=e=>{if(e.button===0)start(e);};
  document.addEventListener('pointerdown',e=>{
    if(!pageEvent(e)||typing||e.pointerType!=='mouse'||e.button!==0)return;
    const n=near(e.target,level);if(n)pressed={node:n,hit:e.target,x:e.clientX,y:e.clientY,id:e.pointerId};
  },true);
  document.addEventListener('pointermove',e=>{
    if(!pressed||drag||!e.buttons||pressed.id!==e.pointerId)return;
    if(Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<6)return;
    pick(pressed.node,pressed.hit,true);start(e);pressed=null;
  },true);
  document.addEventListener('dragstart',e=>{if(pageEvent(e)&&!typing)e.preventDefault();},true);
  document.addEventListener('pointerup',()=>{pressed=null;},true);
  document.addEventListener('pointercancel',()=>{pressed=null;},true);
  grip.onpointermove=e=>{if(drag&&drag.id===e.pointerId){drag.x=e.clientX;drag.y=e.clientY;}};
  grip.onpointerup=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    drag.x=e.clientX;drag.y=e.clientY;indicator();const chosen=target;
    cancel();swallowClick=true;setTimeout(()=>{swallowClick=false;},0);if(chosen)move(selected,chosen.node,chosen.side);
    pick(selected,hit,true);
  };
  grip.onpointercancel=cancel;grip.onlostpointercapture=cancel;
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!typing){if(drag)cancel();else pick(null);}
  });
  window.addEventListener('blur',cancel);
  window.addEventListener('scroll',position,{passive:true,capture:true});window.addEventListener('resize',position);
  return {select:node=>pick(node,node,true),writing(active){typing=active;if(active)box.hidden=tools.hidden=true;else position();}};
}
