import {textAtPoint} from './texto-visual.js';
import {destination,orderedChildren} from './disposicion.js';
import {labelOf,outline,unitSelector} from './estructura.js';

const movableCard='[data-layout-type="row"],#heroVisual[data-x-layout]';
const siteControl='#avisoOk,#menuBtn,#galleryToggle';
const labels={before:'Antes de ',after:'Después de ',inside:'Dentro de '};
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
const visible=node=>node?.getClientRects().length>0;
const near=(node,selector)=>node?.closest?.(selector);

function canvasItem(element){
  return near(element,movableCard)||near(element,unitSelector);
}

function rectDistance(r,x,y){
  return Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));
}

export function directDrag({host,ui,move,editText,canEdit,changeImage,canChangeImage,canMove}){
  let selected=null,hit=null,textPart=null,pressed=null,drag=null,typing=false;
  let choosing=false,chosen=null,drop=null,frame=0,swallowClick=false;
  const tree=outline(ui.list,node=>{
    if(choosing)chooseTarget(node,true);
    else {pick(node);showOnPage(node);}
  });
  tree.refresh();

  function siblings(node){
    if(!node)return [];
    return orderedChildren(node.parentElement).filter(other=>visible(other)&&(other===node||destination(node,other,'before')));
  }

  function position(){
    if(!visible(selected)||typing||drag){ui.box.hidden=ui.handle.hidden=true;return;}
    const r=selected.getBoundingClientRect(),top=ui.bar.getBoundingClientRect().bottom;
    const left=Math.max(r.left,ui.wide.matches&&!ui.dock.hidden?ui.dock.getBoundingClientRect().right:0);
    const right=Math.min(r.right,document.documentElement.clientWidth);
    const bottom=ui.wide.matches||ui.dock.hidden?innerHeight:ui.dock.getBoundingClientRect().top;
    ui.box.hidden=right<=left||r.bottom<=top||r.top>=bottom;
    ui.handle.hidden=ui.box.hidden||choosing;
    if(ui.box.hidden)return;
    const clippedTop=Math.max(top,r.top);
    Object.assign(ui.box.style,{left:left+'px',top:clippedTop+'px',width:right-left+'px',height:Math.min(r.bottom,bottom)-clippedTop+'px'});
    if(choosing)return;
    ui.handle.style.left=clamp(left,2,Math.max(2,document.documentElement.clientWidth-ui.handle.offsetWidth-2))+'px';
    const above=r.top-ui.handle.offsetHeight;
    ui.handle.style.top=clamp(above>=top?above:clippedTop,top,Math.max(top,bottom-ui.handle.offsetHeight))+'px';
  }

  function pick(node,element=node,part=null){
    selected=node;hit=element;textPart=part;tree.select(node);
    ui.controls.hidden=!node;
    ui.caption.textContent=node?labelOf(node).name:'Selecciona un bloque en la página';
    ui.tag.textContent=node?labelOf(node).kind:'';
    if(node){
      const options=siblings(node),index=options.indexOf(node);
      ui.up.disabled=index<=0;ui.down.disabled=index<0||index>=options.length-1;
      ui.text.hidden=!canEdit(element,node,part);
      ui.image.hidden=!canChangeImage(element,node);
    }
    position();
  }

  function showOnPage(node){
    if(!visible(node))return;
    const r=node.getBoundingClientRect();
    const fixedTop=Math.max(ui.bar.offsetHeight,...[...document.querySelectorAll('#siteHeader,.legal-header')].map(n=>n.getBoundingClientRect().bottom));
    const bottom=ui.wide.matches||ui.dock.hidden?innerHeight:ui.dock.getBoundingClientRect().top;
    if(r.bottom>fixedTop+12&&r.top<bottom-12)return;
    window.scrollBy({top:r.top-fixedTop-20,behavior:'instant'});
  }

  function updateMovement(){
    ui.target.hidden=!choosing;
    ui.controls.hidden=choosing||!selected;
    ui.moveTo.setAttribute('aria-pressed',String(choosing));
    if(!choosing)return;
    ui.instruction.textContent=chosen?'Destino · '+labelOf(chosen).name:'Selecciona el destino en la lista o sobre la página.';
    for(const side of ['before','after','inside']){
      ui[side].hidden=!chosen||!destination(selected,chosen,side);
    }
  }

  function clearDestination(){
    choosing=false;chosen=null;updateMovement();showDrop(null);
  }

  function chooseTarget(node,fromList){
    if(!node||!['before','after','inside'].some(side=>destination(selected,node,side))){
      ui.status.textContent='Elige un bloque compatible como destino.';
      return;
    }
    chosen=node;updateMovement();
    if(!ui.wide.matches)ui.toggleDock(true);
    if(fromList)showOnPage(node);
    const side=['before','after','inside'].find(s=>destination(selected,node,s));
    showDrop(dropOnNode(node,side));
  }

  ui.moveTo.onclick=()=>{
    if(!selected||!canMove())return;
    choosing=true;chosen=null;updateMovement();position();
    ui.status.textContent='Selecciona dónde colocar el bloque.';
    if(!ui.wide.matches)ui.toggleDock(false);
  };
  ui.cancelMove.onclick=()=>{clearDestination();position();ui.status.textContent='Movimiento cancelado';};
  for(const side of ['before','after','inside']){
    ui[side].onclick=()=>{
      const moved=chosen&&move(selected,chosen,side);
      clearDestination();
      if(moved)tree.refresh(true);
      else ui.status.textContent='El bloque ya está en esa posición.';
      pick(selected,hit,textPart);
    };
    ui[side].onpointerenter=ui[side].onfocus=()=>{if(chosen)showDrop(dropOnNode(chosen,side));};
  }

  ui.text.onclick=()=>{if(selected)editText(hit,selected,textPart);};
  ui.image.onclick=()=>{if(selected)changeImage(hit,selected);};
  function step(delta){
    if(!selected)return;
    const options=siblings(selected),target=options[options.indexOf(selected)+delta];
    if(target&&move(selected,target,delta<0?'before':'after')){tree.refresh(true);pick(selected,hit,textPart);}
  }
  ui.up.onclick=()=>step(-1);ui.down.onclick=()=>step(1);
  ui.grip.onkeydown=e=>{
    if(!['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.key))return;
    e.preventDefault();step(e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:1);
  };
  ui.grip.onclick=()=>{
    if(swallowClick)return;
    ui.toggleDock(true);tree.refresh(true);
  };
  ui.treeToggle.addEventListener('click',()=>{tree.refresh(true);position();});

  const pageEvent=e=>!e.composedPath().includes(host);
  document.addEventListener('click',e=>{
    if(!pageEvent(e))return;
    if(typing&&near(e.target,'[data-x-writing]')){e.stopImmediatePropagation();return;}
    if(!swallowClick&&near(e.target,siteControl))return;
    e.preventDefault();e.stopImmediatePropagation();
    if(swallowClick)return;
    const node=canvasItem(e.target);
    if(choosing){chooseTarget(node,false);return;}
    pick(node,e.target,textAtPoint(e));
  },true);
  document.addEventListener('dblclick',e=>{
    if(!pageEvent(e)||typing||choosing)return;
    const node=canvasItem(e.target);
    if(node){e.preventDefault();e.stopImmediatePropagation();editText(e.target,node,textAtPoint(e));}
  },true);
  for(const event of ['submit','auxclick','dragstart']){
    document.addEventListener(event,e=>{if(pageEvent(e)&&!typing){e.preventDefault();e.stopImmediatePropagation();}},true);
  }

  function dropOnNode(node,side,horizontal=false){
    return {node,side,horizontal,row:null};
  }

  function canvasDrop(x,y){
    const over=document.elementFromPoint(x,y),source=drag.node,parent=source.parentElement;
    if(!over||over===host||y<ui.bar.offsetHeight||source.contains(over))return null;
    let hovered=over;
    while(hovered&&hovered.parentElement!==parent)hovered=hovered.parentElement;
    let entry=drag.peers.find(item=>item.node===hovered);
    if(!entry&&parent.contains(over)){
      // El relleno de una cuadrícula solo admite una inserción cerca de sus bloques.
      let nearest=26;
      for(const item of drag.peers){
        const distance=rectDistance(item.node.getBoundingClientRect(),x,y);
        if(distance<nearest){nearest=distance;entry=item;}
      }
    }
    if(!entry||entry.node===source)return null;
    const r=entry.node.getBoundingClientRect(),from=source.getBoundingClientRect();
    const xOverlap=Math.min(r.right,from.right)-Math.max(r.left,from.left);
    const yOverlap=Math.min(r.bottom,from.bottom)-Math.max(r.top,from.top);
    const horizontal=yOverlap>3&&(xOverlap<3||drag.horizontal);
    const position=horizontal?(x-r.left)/r.width:(y-r.top)/r.height;
    // En el centro, soltar sobre el vecino lo intercambia. En los bordes manda el sitio señalado.
    const side=position<.35?'before':position>.65?'after':entry.index>drag.index?'after':'before';
    return dropOnNode(entry.node,side,horizontal);
  }

  function treeDrop(x,y){
    const hit=host.shadowRoot.elementFromPoint(x,y);
    const row=near(hit,'.outline-row'),node=tree.nodeFor(row);
    const entry=drag.peers.find(item=>item.node===node);
    if(!entry||node===drag.node)return null;
    const r=row.getBoundingClientRect();
    return {node,row,side:y<(r.top+r.bottom)/2?'before':'after',horizontal:false};
  }

  function findDrop(x,y){
    const target=treeDrop(x,y)||canvasDrop(x,y);
    if(!target)return null;
    const targetIndex=drag.peers.find(item=>item.node===target.node).index;
    target.same=target.side==='after'?targetIndex===drag.index-1:targetIndex===drag.index+1;
    return target;
  }

  function showDrop(next){
    drop?.row?.removeAttribute('data-drop');
    drop=next;ui.line.hidden=!next||next.same||!visible(next.node);
    if(!next)return;
    if(next.row&&!next.same)next.row.dataset.drop=next.side;
    if(ui.line.hidden)return;
    const r=next.node.getBoundingClientRect();
    const {side,horizontal}=next,before=side==='before',inside=side==='inside';
    const minX=ui.wide.matches&&!ui.dock.hidden?ui.dock.getBoundingClientRect().right:0;
    const left=Math.max(minX,r.left),top=Math.max(ui.bar.offsetHeight,r.top);
    const right=Math.min(document.documentElement.clientWidth,r.right),bottom=Math.min(innerHeight,r.bottom);
    if(right<=left||bottom<=top){ui.line.hidden=true;return;}
    ui.line.className='line'+(inside?' inside':horizontal?' vertical':'');
    Object.assign(ui.line.style,{
      left:(horizontal?clamp((before?r.left:r.right)-2,minX,right-3):left)+'px',
      top:(inside||horizontal?top:clamp((before?r.top:r.bottom)-2,ui.bar.offsetHeight,innerHeight-4))+'px',
      width:(horizontal?4:right-left)+'px',height:(inside||horizontal?bottom-top:4)+'px'
    });
  }

  function dragAt(){
    const next=findDrop(drag.x,drag.y);showDrop(next);
    ui.ghost.textContent=next?.same?'Posición actual':next?labels[next.side]+labelOf(next.node).name:labelOf(drag.node).name;
    ui.ghost.classList.toggle('valid',!!next&&!next.same);
    ui.ghost.style.left=clamp(drag.x+16,6,Math.max(6,innerWidth-ui.ghost.offsetWidth-6))+'px';
    ui.ghost.style.top=clamp(drag.y+17,ui.bar.offsetHeight+4,innerHeight-ui.ghost.offsetHeight-4)+'px';
  }

  function clearGesture(){
    const current=pressed||drag;
    pressed=drag=null;cancelAnimationFrame(frame);frame=0;
    if(current){
      if(current.capture.hasPointerCapture(current.id))current.capture.releasePointerCapture(current.id);
      current.node.removeAttribute('data-x-grabbed');ui.ghost.hidden=true;showDrop(null);
    }
    position();
  }
  function cancel(){clearGesture();clearDestination();position();}

  function edgeSpeed(y,top,bottom){
    const band=38;
    if(y>=top&&y<top+band)return -(top+band-y)/band;
    if(y<=bottom&&y>bottom-band)return (y-bottom+band)/band;
    return 0;
  }
  function scrollTarget(){
    const r=ui.list.getBoundingClientRect();
    if(!ui.dock.hidden&&drag.x>=r.left&&drag.x<=r.right&&drag.y>=r.top&&drag.y<=r.bottom){
      return {element:ui.list,speed:edgeSpeed(drag.y,r.top,r.bottom)};
    }
    const top=ui.bar.offsetHeight;
    return {element:window,speed:edgeSpeed(drag.y,top,innerHeight)};
  }
  function scrollTick(now){
    if(!drag)return;
    const {element,speed}=scrollTarget();
    if(element!==drag.scroller||Math.sign(speed)!==drag.direction){
      drag.scroller=element;drag.direction=Math.sign(speed);drag.edgeSince=now;
    }
    if(speed&&now-drag.edgeSince>420){
      element.scrollBy({top:Math.sign(speed)*Math.max(1,Math.abs(speed)*Math.min(24,now-drag.last)*.26),behavior:'instant'});
      dragAt();
    }
    drag.last=now;frame=requestAnimationFrame(scrollTick);
  }

  function registerPress(e,node,capture,element=node){
    if(!node||!canMove()||typing||choosing||!e.isPrimary||e.button!==0)return;
    pressed={node,capture,element,id:e.pointerId,x:e.clientX,y:e.clientY};
    if(capture!==host)e.preventDefault();
  }

  ui.grip.onpointerdown=e=>registerPress(e,selected,ui.grip,hit);
  ui.list.addEventListener('pointerdown',e=>{
    const grip=near(e.target,'[data-grip]');
    if(grip)registerPress(e,tree.nodeFor(near(grip,'.outline-row')),grip);
  });
  document.addEventListener('pointerdown',e=>{
    if(!pageEvent(e)||e.pointerType!=='mouse'||near(e.target,siteControl))return;
    const node=selected?.contains(e.target)?selected:canvasItem(e.target);
    registerPress(e,node,host,e.target);
  },true);
  document.addEventListener('pointermove',e=>{
    const current=drag||pressed;
    if(!current||current.id!==e.pointerId)return;
    if(!e.buttons){clearGesture();return;}
    if(!drag){
      if(Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)<7)return;
      const source=pressed,options=siblings(source.node);
      drag={...source,peers:options.map((node,index)=>({node,index})),index:options.indexOf(source.node),
        horizontal:getComputedStyle(source.node.parentElement).display==='flex'&&getComputedStyle(source.node.parentElement).flexDirection==='row',
        edgeSince:performance.now(),last:performance.now()};
      pressed=null;drag.capture.setPointerCapture(e.pointerId);
      window.getSelection()?.removeAllRanges();source.node.dataset.xGrabbed='';
      selected=source.node;hit=source.element;textPart=null;
      ui.ghost.hidden=false;ui.box.hidden=ui.handle.hidden=true;
      frame=requestAnimationFrame(scrollTick);
    }
    e.preventDefault();drag.x=e.clientX;drag.y=e.clientY;dragAt();
  },{capture:true,passive:false});
  document.addEventListener('pointerup',e=>{
    if((drag||pressed)?.id!==e.pointerId)return;
    if(!drag){clearGesture();return;}
    const {node,element}=drag,target=findDrop(e.clientX,e.clientY);
    swallowClick=true;setTimeout(()=>{swallowClick=false;},0);
    clearGesture();
    if(target){if(!target.same&&move(node,target.node,target.side))tree.refresh(true);else ui.status.textContent='El bloque ya está en esa posición.';}
    else ui.status.textContent='Suelta el bloque junto a otro del mismo grupo.';
    pick(node,element);
  },true);
  document.addEventListener('pointercancel',e=>{if((drag||pressed)?.id===e.pointerId)clearGesture();},true);
  document.addEventListener('lostpointercapture',e=>{if(drag?.id===e.pointerId)clearGesture();},true);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!typing&&!host.shadowRoot.querySelector('dialog[open]')){
      if(choosing||drag||pressed)cancel();else pick(null);
    }
  });
  window.addEventListener('blur',clearGesture);
  window.addEventListener('scroll',()=>{if(drag)dragAt();else{position();if(chosen&&drop)showDrop(drop);}}, {passive:true,capture:true});
  window.addEventListener('resize',position);
  new ResizeObserver(position).observe(ui.dock);
  pick(null);
  return {select:node=>pick(node),refresh:()=>{tree.refresh();pick(selected,hit,textPart);},cancel,writing(active){typing=active;position();}};
}
