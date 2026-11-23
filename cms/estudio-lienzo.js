import {destination,layoutKey,layoutUnits,orderedChildren} from './disposicion.js';
import {normalizeGeometry} from './geometria.js';

const unit='[data-x-layout]';
const clamp=(n,min,max)=>Math.max(min,Math.min(n,Math.max(min,max)));
const rectDistance=(r,x,y)=>Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom));
const sideNames={before:'Antes de ',after:'Después de ',inside:'Dentro de '};
const isVisible=node=>node?.getClientRects().length>0;
const rowSelector='[data-layout-type="row"],#heroVisual[data-x-layout]';
const itemOf=element=>element?.closest?.(rowSelector)||element?.closest?.(unit)||null;

export function canvasUI(ui,actions){
  let doc,selected,indicator,gesture,frameRequest=0,suppressClick=false,hovered=null;
  const {frame,paper,selection,grip,gripCaption,drop,dragLabel,tree,bar,up,down,addBelow,handles}=ui;
  const tools=Object.fromEntries([...handles.children].map(tool=>[tool.dataset.geometryAxis,tool]));

  function setHover(node){
    if(hovered===node)return;
    hovered?.removeAttribute('data-x-hover');
    hovered=node;hovered?.setAttribute('data-x-hover','');
  }

  function size(box,left,top,width,height){
    Object.assign(box.style,{left:left+'px',top:top+'px',width:width+'px',height:height+'px'});
  }

  const scale=()=>frame.getBoundingClientRect().width/frame.clientWidth||1;
  function fit(){
    const mode=paper.parentElement.dataset.screen,base={desktop:1280,tablet:768,phone:390}[mode];
    const factor=Math.min(1,paper.clientWidth/base);
    if(!factor)return;
    frame.style.width=Math.max(base,paper.clientWidth)+'px';
    frame.style.height=Math.ceil(paper.clientHeight/factor)+'px';
    frame.style.transform='scale('+factor+')';
    draw();
  }

  function draw(){
    selection.hidden=bar.hidden=addBelow.hidden=true;
    const canDraw=!(ui.preview()||!isVisible(selected)||gesture?.active&&!gesture.axis);
    const canAdjust=canDraw&&actions.ready()&&!actions.choosing();
    if(!canAdjust||!ui.precision())handles.hidden=true;
    if(!canDraw)return;
    const area=selected.getBoundingClientRect();
    const ratio=scale();
    const x=Math.max(area.left*ratio,0),y=Math.max(area.top*ratio,0);
    const right=Math.min(area.right*ratio,paper.clientWidth),bottom=Math.min(area.bottom*ratio,paper.clientHeight);
    if(right<=x||bottom<=y){handles.hidden=true;return;}
    selection.hidden=false;size(selection,x,y,right-x,bottom-y);
    if(!canAdjust)return;
    if(ui.precision()){
      handles.hidden=false;
      drawHandles({x,y,right,bottom},area,ratio);
      return;
    }
    const order=siblings(selected),index=order.indexOf(selected);
    up.disabled=index<=0;down.disabled=index<0||index>=order.length-1;
    actions.barState?.(selected);
    bar.hidden=false;gripCaption.textContent=actions.label(selected).kind;
    bar.style.left=clamp(x,1,paper.clientWidth-bar.offsetWidth-1)+'px';
    bar.style.top=clamp(area.top*ratio-bar.offsetHeight>=0?area.top*ratio-bar.offsetHeight:area.top*ratio,0,paper.clientHeight-bar.offsetHeight)+'px';
    addBelow.hidden=false;
    addBelow.style.left=clamp((x+right)/2-addBelow.offsetWidth/2,0,paper.clientWidth-addBelow.offsetWidth)+'px';
    addBelow.style.top=clamp(bottom-addBelow.offsetHeight/2,0,paper.clientHeight-addBelow.offsetHeight)+'px';
  }

  function drawHandles({x,y,right,bottom},area,ratio){
    const move=tools.move;
    move.style.left=clamp(x,0,paper.clientWidth-move.offsetWidth)+'px';
    move.style.top=clamp(y-move.offsetHeight-4,0,paper.clientHeight-move.offsetHeight)+'px';
    const onRight=area.right*ratio<=paper.clientWidth;
    const onBottom=area.bottom*ratio<=paper.clientHeight;
    for(const [tool,left,top,visible] of [
      [tools.width,right,(y+bottom)/2,onRight&&bottom-y>=30],
      [tools.height,(x+right)/2,bottom,onBottom&&right-x>=30],
      [tools.both,right,bottom,onRight&&onBottom]
    ]){
      tool.hidden=!visible;
      tool.style.left=clamp(left-12.5,0,paper.clientWidth-25)+'px';
      tool.style.top=clamp(top-12.5,0,paper.clientHeight-25)+'px';
    }
  }

  function displayMark(mark){
    indicator?.row?.removeAttribute('data-drop');
    indicator=mark;drop.hidden=true;
    if(!mark||mark.same)return;
    if(mark.row)mark.row.dataset.drop=mark.side;
    if(!isVisible(mark.node))return;
    const r=mark.node.getBoundingClientRect(),ratio=scale(),x=Math.max(r.left*ratio,0),y=Math.max(r.top*ratio,0);
    const right=Math.min(r.right*ratio,paper.clientWidth),bottom=Math.min(r.bottom*ratio,paper.clientHeight);
    if(right<=x||bottom<=y)return;
    const {side,horizontal}=mark;
    drop.classList.toggle('inside',side==='inside');drop.hidden=false;
    if(side==='inside')size(drop,x,y,right-x,bottom-y);
    else if(horizontal)size(drop,clamp((side==='before'?r.left:r.right)*ratio-2,0,paper.clientWidth-4),y,4,bottom-y);
    else size(drop,x,clamp((side==='before'?r.top:r.bottom)*ratio-2,0,paper.clientHeight-4),right-x,4);
  }

  function select(node,follow=false){
    selected=node;
    if(hovered&&hovered===node)setHover(null);
    if(follow&&isVisible(node))node.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    draw();
  }

  function siblings(node){
    if(!node?.parentElement)return [];
    return orderedChildren(node.parentElement).filter(n=>isVisible(n)&&(n===node||destination(node,n,'before')));
  }

  function samePosition(node,side){
    const sourceIndex=gesture.items.indexOf(gesture.node),targetIndex=gesture.items.indexOf(node);
    return targetIndex+(side==='after'?1:-1)===sourceIndex;
  }

  // ¿Se puede soltar el bloque arrastrado en ese lado de ese nodo? (la regla la decide destination())
  function allowed(node,side){
    const source=gesture.node;
    if(!node||node===source||source.contains(node))return false;
    if(side==='inside'&&node===source.parentElement)return false;
    return Boolean(destination(source,node,side));
  }
  const isSame=(node,side)=>side!=='inside'&&gesture.items.includes(node)&&samePosition(node,side);

  // ¿Los hermanos de este nodo están en fila (uno al lado del otro)?
  function sideBySide(node){
    const parent=node.parentElement;
    if(!parent)return false;
    const r=node.getBoundingClientRect();
    for(const other of orderedChildren(parent)){
      if(other===node||!other.matches?.(unit)||!isVisible(other))continue;
      const o=other.getBoundingClientRect();
      return Math.min(r.bottom,o.bottom)-Math.max(r.top,o.top)>4&&(o.left>=r.right-3||r.left>=o.right-3);
    }
    return false;
  }

  // Zonas: bordes = antes/después, centro = dentro (si el destino lo admite).
  function pickSide(pos,edge){
    return pos<edge?['before','after','inside']:pos>1-edge?['after','before','inside']
      :['inside',pos<.5?'before':'after',pos<.5?'after':'before'];
  }

  function hitNode(node,x,y){
    const r=node.getBoundingClientRect(),horizontal=sideBySide(node);
    const pos=horizontal?(x-r.left)/(r.width||1):(y-r.top)/(r.height||1);
    for(const side of pickSide(pos,.32)){
      if(allowed(node,side))return {node,side,horizontal,same:isSame(node,side)};
    }
    return null;
  }

  // x,y en coordenadas del documento de la página. Busca el bloque bajo el puntero y, si no admite
  // el bloque arrastrado, sube por sus contenedores hasta encontrar un destino válido.
  function pageTarget(x,y){
    const under=doc.elementFromPoint(x,y);
    if(!under||gesture.node.contains(under))return null;
    let start=itemOf(under);
    if(!start)return null;
    if(under===start){
      // El puntero está en un hueco entre bloques: usa el hijo más cercano.
      let best=40,near=null;
      for(const kid of orderedChildren(start)){
        if(!kid.matches?.(unit)||!isVisible(kid)||kid===gesture.node||gesture.node.contains(kid))continue;
        const distance=rectDistance(kid.getBoundingClientRect(),x,y);
        if(distance<best){best=distance;near=kid;}
      }
      if(near)start=near;
    }
    for(let node=start;node;node=node.parentElement?.closest(unit)){
      const hit=hitNode(node,x,y);
      if(hit)return hit;
    }
    return null;
  }

  function targetAt(e){
    const over=document.elementFromPoint(e.clientX,e.clientY);
    const row=over?.closest('.tree-row');
    if(row&&tree.contains(row)){
      const node=actions.nodes().get(row.dataset.key);
      if(!node||node===gesture.node||gesture.node.contains(node))return null;
      const r=row.getBoundingClientRect(),pos=(e.clientY-r.top)/(r.height||1);
      for(const side of pickSide(pos,.28)){
        if(allowed(node,side))return {node,side,row,same:isSame(node,side)};
      }
      return null;
    }
    if(over!==frame&&!bar.contains(over))return null;
    const br=frame.getBoundingClientRect();
    return pageTarget((e.clientX-br.left)/scale(),(e.clientY-br.top)/scale());
  }

  function update(e){
    const target=targetAt(e);displayMark(target);
    const r=paper.getBoundingClientRect();
    dragLabel.textContent=target?.same?'Posición actual':target?sideNames[target.side]+actions.label(target.node).name:actions.label(gesture.node).name;
    dragLabel.hidden=false;
    dragLabel.style.left=clamp(e.clientX-r.left+13,6,paper.clientWidth-dragLabel.offsetWidth-6)+'px';
    dragLabel.style.top=clamp(e.clientY-r.top+14,6,paper.clientHeight-dragLabel.offsetHeight-6)+'px';
  }

  function autoscroll(t){
    if(!gesture?.active)return;
    const {event}=gesture;
    const sidebar=tree.parentElement,sideRect=sidebar.getBoundingClientRect(),canvasRect=frame.getBoundingClientRect();
    const inSidebar=event.clientX>=sideRect.left&&event.clientX<=sideRect.right&&event.clientY>=sideRect.top&&event.clientY<=sideRect.bottom;
    const area=inSidebar?sideRect:canvasRect,scroller=inSidebar?sidebar:frame.contentWindow;
    const inArea=event.clientX>=area.left&&event.clientX<=area.right;
    const edge=!inArea?0:event.clientY>=area.top&&event.clientY<area.top+30?-1:event.clientY<=area.bottom&&event.clientY>area.bottom-30?1:0;
    if(edge!==gesture.edge||scroller!==gesture.scroller){gesture.edge=edge;gesture.scroller=scroller;gesture.since=t;}
    if(edge&&t-gesture.since>400){scroller.scrollBy({top:edge*5,behavior:'instant'});update(event);}
    frameRequest=requestAnimationFrame(autoscroll);
  }

  function cancel(){
    const active=gesture;gesture=null;cancelAnimationFrame(frameRequest);
    if(active?.axis&&active.active){
      actions.previewGeometry(active.node,active.profile);
      active.node.removeAttribute('data-x-geometry-dragging');
    }
    if(active?.capture.hasPointerCapture(active.id))active.capture.releasePointerCapture(active.id);
    dragLabel.hidden=true;displayMark(null);draw();
  }

  function start(e,node,capture=paper,point=e,axis=null){
    if(gesture||!actions.ready()||actions.choosing()||!node||!e.isPrimary||e.button!==0)return;
    const items=axis?[]:siblings(node);
    if(capture===paper)e.preventDefault();
    gesture={node,id:e.pointerId,capture,x:point.clientX,y:point.clientY,items,axis};
    if(capture===paper)capture.setPointerCapture(e.pointerId);
  }
  grip.onpointerdown=e=>start(e,selected);
  grip.onclick=()=>{if(!gesture)actions.openInspector();};
  grip.onkeydown=e=>{
    const direction={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1}[e.key];
    if(direction){e.preventDefault();actions.step(direction,selected);}
  };
  for(const [axis,tool] of Object.entries(tools)){
    tool.onpointerdown=e=>start(e,selected,paper,e,axis);
    tool.onkeydown=e=>{
      const deltas={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!deltas||!selected||gesture||!actions.prepareGeometry(selected))return;
      e.preventDefault();
      const step=e.shiftKey?10:1,base=geometryBaseline(selected);
      const next=geometryChange(axis,base,deltas[0]*step,deltas[1]*step);
      actions.commitGeometry(selected,next);
    };
  }
  tree.addEventListener('pointerdown',e=>{
    const row=e.target.closest('.tree-grip')?.closest('.tree-row');
    if(row)start(e,actions.nodes().get(row.dataset.key));
  });
  function geometryBaseline(node){
    const area=node.getBoundingClientRect(),profile=actions.readGeometry(node);
    return {profile,width:node.offsetWidth||area.width,height:node.offsetHeight||area.height};
  }

  function geometryChange(axis,base,dx,dy){
    const {profile,width,height}=base;
    const next={...profile};
    if(axis==='move'){
      next.x=(profile.x||0)+dx;next.y=(profile.y||0)+dy;
    }
    if((axis==='both'||axis==='width')&&dx)next.width=width+dx;
    if((axis==='both'||axis==='height')&&dy)next.height=height+dy;
    return normalizeGeometry(next);
  }

  function updateGeometry(e){
    const ratio=gesture.ratio;
    const dx=Math.round((e.clientX-gesture.x)/ratio),dy=Math.round((e.clientY-gesture.y)/ratio);
    const next=geometryChange(gesture.axis,gesture,dx,dy);
    gesture.next=next;
    actions.previewGeometry(gesture.node,next);
    draw();
    const area=gesture.node.getBoundingClientRect(),r=paper.getBoundingClientRect();
    dragLabel.textContent=gesture.axis==='move'
      ?`X ${next.x||0} · Y ${next.y||0} px`
      :`${Math.round(area.width)} × ${Math.round(area.height)} px`;
    dragLabel.hidden=false;
    dragLabel.style.left=clamp(e.clientX-r.left+15,6,paper.clientWidth-dragLabel.offsetWidth-6)+'px';
    dragLabel.style.top=clamp(e.clientY-r.top+16,6,paper.clientHeight-dragLabel.offsetHeight-6)+'px';
  }

  function pointerMove(e,point=e){
    if(gesture?.id!==e.pointerId)return;
    if(!e.buttons){cancel();return;}
    if(!gesture.active){
      if(Math.hypot(point.clientX-gesture.x,point.clientY-gesture.y)<(gesture.axis?2:7))return;
      if(gesture.axis){
        if(!actions.prepareGeometry(gesture.node)){cancel();return;}
        Object.assign(gesture,geometryBaseline(gesture.node),{ratio:scale()});
        gesture.node.setAttribute('data-x-geometry-dragging','');
      }
      gesture.capture.setPointerCapture(e.pointerId);
      gesture.active=true;
      if(!gesture.axis){
        actions.select(gesture.node,false);draw();frameRequest=requestAnimationFrame(autoscroll);
      }
    }
    e.preventDefault();
    if(gesture.axis){updateGeometry(point);return;}
    gesture.event=point;update(point);
  }
  function pointerUp(e,point=e){
    if(gesture?.id!==e.pointerId)return;
    const {node:source,axis,active:wasDragging}=gesture;
    if(wasDragging){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);}
    if(axis){
      if(wasDragging)updateGeometry(point);
      const next=gesture.next;
      cancel();
      if(next)actions.commitGeometry(source,next);
      return;
    }
    const move=wasDragging?targetAt(point):null,overlay=gesture.capture===paper;
    cancel();
    if(move&&!move.same)actions.move(source,move.node,move.side);
    else if(wasDragging)actions.report(move?.same?'El bloque ya está en esa posición.':'Suelta sobre la posición marcada, en la página o en Estructura.');
    else if(overlay&&point.clientX>=frame.getBoundingClientRect().left)actions.openInspector();
  }
  paper.addEventListener('pointermove',e=>pointerMove(e));
  paper.addEventListener('pointerup',e=>pointerUp(e));
  paper.addEventListener('lostpointercapture',()=>{if(gesture)cancel();});
  paper.addEventListener('pointercancel',cancel);
  window.addEventListener('blur',()=>{if(gesture?.capture===paper)cancel();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&gesture)cancel();});
  new ResizeObserver(()=>{fit();if(indicator&&!gesture)displayMark(indicator);}).observe(paper);

  function attach(frameDoc){
    cancel();doc=frameDoc;selected=null;hovered=null;
    const css=doc.createElement('style');
    css.textContent=`
      html{scroll-behavior:auto!important;overflow-anchor:none}
      .reveal{opacity:1!important;transform:none!important;transition:none!important}
      html.xebax-edit :is(.float-wa,#chatLauncher,#aviso,#scrollProgress){display:none!important}
      html.xebax-edit [data-x-layout]{cursor:default;user-select:none}
      html.xebax-edit.xebax-precision [data-x-layout]{cursor:move}
      html.xebax-edit.xebax-precision :is(.btn-primary,.btn-wa,.hero-cabana-link,.service-card,.nautical-card){transform:none!important;transition:none!important}
      html.xebax-edit [data-x-geometry-dragging]{transition:none!important}
      html.xebax-edit [data-studio-writing]{user-select:text;cursor:text}
      html.xebax-edit [data-x-hover]{outline:1px dashed #179768;outline-offset:-1px}
      html.xebax-edit .xc-block:empty{display:grid;min-height:64px;place-items:center;border:1px dashed #789083}
      html.xebax-edit .xc-block:empty::before{content:"Completa este bloque en Ajustes";color:#53675e;font:14px system-ui}
    `;
    doc.head.append(css);
    const item=hit=>ui.precision()&&!actions.choosing()?hit.closest(unit):itemOf(hit);
    const point=e=>{
      const r=frame.getBoundingClientRect(),ratio=scale();
      return {clientX:r.left+e.clientX*ratio,clientY:r.top+e.clientY*ratio};
    };
    const onClick=e=>{
      if(ui.preview())return;
      if(!e.target.closest)return;
      if(e.target.closest('[data-studio-writing]')){e.stopImmediatePropagation();return;}
      e.preventDefault();e.stopImmediatePropagation();
      if(suppressClick)return;
      const unitNode=item(e.target);
      if(!unitNode)return;
      const wasSelected=unitNode===selected;
      actions.onSelect(unitNode,false);
      if(wasSelected&&!ui.precision()&&!actions.choosing())actions.onText(unitNode,e.target,e,true);
    };
    doc.defaultView.addEventListener('click',onClick,true);
    doc.defaultView.addEventListener('pointerdown',e=>{
      if(e.pointerType!=='mouse'||!e.target.closest||e.target.closest('[data-studio-writing]'))return;
      const axis=ui.precision()?'move':null;
      const node=axis&&selected?.contains(e.target)?selected:item(e.target);
      start(e,node,doc.body,point(e),axis);
    },true);
    doc.defaultView.addEventListener('pointermove',e=>pointerMove(e,point(e)),true);
    doc.defaultView.addEventListener('pointerup',e=>pointerUp(e,point(e)),true);
    doc.defaultView.addEventListener('pointercancel',cancel,true);
    doc.defaultView.addEventListener('lostpointercapture',()=>{if(gesture?.capture===doc.body)cancel();},true);
    doc.defaultView.addEventListener('blur',()=>{if(gesture?.capture===doc.body)cancel();});
    doc.defaultView.addEventListener('dragstart',e=>{if(!ui.preview())e.preventDefault();},true);
    doc.defaultView.addEventListener('load',draw,true);
    doc.defaultView.addEventListener('mouseover',e=>{
      if(ui.preview()||gesture?.active||!e.target.closest){setHover(null);return;}
      const node=item(e.target);
      setHover(node&&node!==selected?node:null);
    },true);
    doc.documentElement.addEventListener('mouseleave',()=>setHover(null));
    doc.defaultView.addEventListener('dblclick',e=>{
      if(ui.preview()||ui.precision()||actions.choosing()||e.target.closest?.('[data-studio-writing]'))return;
      const unitNode=item(e.target);
      if(unitNode)actions.onText(unitNode,e.target,e);
    },true);
    doc.defaultView.addEventListener('scroll',()=>{draw();if(indicator&&!gesture)displayMark(indicator);},{passive:true,capture:true});
    doc.defaultView.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&gesture){e.preventDefault();cancel();return;}
      actions.key(e);
    },true);
    doc.defaultView.addEventListener('resize',draw);
    doc.documentElement.classList.toggle('xebax-edit',!ui.preview());
    doc.documentElement.classList.toggle('xebax-precision',ui.precision());
    return new Map(layoutUnits(doc).map(node=>[layoutKey(node),node]));
  }

  return {attach,select,siblings,cancel,draw,fit,mark:displayMark};
}
