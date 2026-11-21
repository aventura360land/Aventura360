import {el,button,select} from './formularios.js';
import {applyStyle,describe,recordMove,destination,layoutKey,layoutUnits,pageLayout,place,spacings} from './disposicion.js';

const selector='[data-x-layout]';
const sides=[['before','Antes del destino'],['after','Después del destino'],['inside','Dentro del destino, al final']];
const modeCss=`
  html.x-layout-mode [data-x-layout],html.x-layout-mode [data-wp-run]{cursor:grab!important}
  html.x-layout-mode [data-wp-run]{user-select:none!important}
  .x-layout-hover{outline:2px dashed #007c66!important;outline-offset:2px}
  .x-layout-picked{outline:3px solid #007c66!important;outline-offset:2px}
  [data-layout-drop="before"]{box-shadow:inset 0 5px #ef862a!important}
  [data-layout-drop="after"]{box-shadow:inset 0 -5px #ef862a!important}
  [data-layout-axis="x"][data-layout-drop="before"]{box-shadow:inset 5px 0 #ef862a!important}
  [data-layout-axis="x"][data-layout-drop="after"]{box-shadow:inset -5px 0 #ef862a!important}
  [data-layout-drop="inside"]{outline:4px dashed #ef862a!important;outline-offset:-4px}
  html.x-layout-mode [contenteditable]{caret-color:transparent}
`;
function label(caption,control){
  const wrap=el('label',undefined,'field');wrap.append(el('span',caption),control);return wrap;
}
function optionList(nodes,empty,value,onChange){
  const menu=select([['',empty]],'',onChange);
  let current,group;
  for(const node of nodes){
    const area=node.closest('[data-x-section],.xc-section,body > header,body > footer,#page-content,.legal-hero,.legal-body');
    if(!group||area!==current){
      group=el('optgroup');current=area;
      group.label=area?.dataset.layoutName||({HEADER:'Cabecera',FOOTER:'Pie de página'})[area?.tagName]||'Página';
      menu.append(group);
    }
    const option=el('option',describe(node)+(node.hasAttribute('data-layout-hidden')?' (oculto)':''));option.value=layoutKey(node);group.append(option);
  }
  menu.value=value||'';return menu;
}
export function layoutEditor({frame,inspector,page,ctx,leave}){
  let enabled=false,level='element',sourceKey='',targetKey='',side='after',picking=false;
  let doc,byKey=new Map(),hover,drop,armed,dragging=false,feedback='';
  const trigger=button('Mover y diseñar',()=>enabled?leave():activate(),'wp-layout-toggle');
  trigger.setAttribute('aria-pressed','false');
  const source=()=>byKey.get(sourceKey),target=()=>byKey.get(targetKey);
  function clearMarks(){
    hover?.classList.remove('x-layout-hover');drop?.removeAttribute('data-layout-drop');drop?.removeAttribute('data-layout-axis');hover=drop=null;
  }
  function updateMode(active){
    enabled=active;trigger.setAttribute('aria-pressed',String(active));clearMarks();
    source()?.classList.toggle('x-layout-picked',active);
    doc?.documentElement.classList.toggle('x-layout-mode',active);
    for(const run of doc?.querySelectorAll('[data-wp-run]')||[])run.contentEditable=active?'false':'plaintext-only';
    disarm();
  }
  function activate(){picking=false;updateMode(true);draw();}
  function close(){picking=false;updateMode(false);}
  function selectSource(node,reveal=false){
    source()?.classList.remove('x-layout-picked');clearMarks();
    sourceKey=layoutKey(node)||'';targetKey='';picking=false;feedback='';
    node?.classList.add('x-layout-picked');
    if(reveal)node?.scrollIntoView({block:'center'});draw();
  }
  function selectTarget(node,reveal=false){
    clearMarks();targetKey=layoutKey(node)||'';picking=false;
    if(node){drop=node;drop.dataset.layoutDrop=side;if(reveal)node.scrollIntoView({block:'center'});}
    draw();
  }
  function at(eventTarget,asTarget=false){
    let node=eventTarget.closest?.(selector);
    if(level==='section')node=eventTarget.closest?.('[data-layout-type="section"]');
    if(asTarget){
      while(node&&!destination(source(),node,side))node=node.parentElement?.closest(selector);
    }
    return node;
  }
  function move(a,b,position){
    if(!place(a,b,position)){feedback='El elemento ya está ahí o ese destino no admite este movimiento.';draw();return;}
    ctx.changeLayout(()=>recordMove(ctx.state,page,a,b,position));selectSource(a,true);feedback='Se movió en el borrador.';draw();
  }
  function style(key,value){
    ctx.changeLayout(()=>{
      const layout=pageLayout(ctx.state,page,true),styles=layout.styles??={};
      const next={...styles[sourceKey]};
      if(value)next[key]=value;else delete next[key];
      if(Object.keys(next).length)styles[sourceKey]=next;else delete styles[sourceKey];
      applyStyle(source(),next);
      if(!Object.keys(styles).length)delete layout.styles;
      if(!Object.keys(layout).length){
        if(page.sections)delete ctx.state.template.layout[page.id];else delete page.layout;
      }
    });
    draw();
  }
  function draw(){
    if(!enabled)return;
    const node=source(),units=layoutUnits(doc||frame.ownerDocument);
    inspector.replaceChildren(el('h2','Mover y diseñar'));
    inspector.append(label('Qué quieres mover',select([['element','Elementos y grupos'],['section','Secciones completas']],level,v=>{
      level=v;selectSource(null);
    })));
    const list=level==='section'?units.filter(n=>n.dataset.layoutType==='section'):units;
    inspector.append(label('Elemento',optionList(list,'Elige en la página o en esta lista',sourceKey,k=>selectSource(byKey.get(k),true))));
    if(!node){
      inspector.append(el('p','Selecciona un elemento en la página. Puedes arrastrarlo o elegir su destino desde este panel.','hint'));return;
    }
    const outer=node.parentElement?.closest(selector);
    const actions=el('div',undefined,'wp-layout-actions');
    if(outer&&level==='element')actions.append(button('Seleccionar grupo superior',()=>selectSource(outer,true)));
    const peers=[...node.parentElement.children].filter(other=>other===node||destination(node,other,'before'));
    const i=peers.indexOf(node);
    const up=button('Subir',()=>move(node,peers[i-1],'before')),down=button('Bajar',()=>move(node,peers[i+1],'after'));
    up.disabled=i<1;down.disabled=i<0||i===peers.length-1;actions.append(up,down);inspector.append(actions);
    inspector.append(label('Posición',select(sides,side,value=>{side=value;selectTarget(null);})));
    const targets=units.filter(n=>destination(node,n,side));
    inspector.append(label('Destino',optionList(targets,'Elige un destino',targetKey,k=>selectTarget(byKey.get(k),true))));
    const choose=button(picking?'Cancelar selección':'Elegir destino en la página',()=>{picking=!picking;clearMarks();draw();});
    const apply=button('Mover aquí',()=>move(node,target(),side),'primary');
    apply.disabled=!destination(node,target(),side);inspector.append(choose,apply);
    if(picking)inspector.append(el('p','Toca el destino en la página y confirma con «Mover aquí».','hint'));
    const status=el('p',feedback,'wp-layout-status');status.setAttribute('role','status');inspector.append(status);
    const values=pageLayout(ctx.state,page)?.styles?.[sourceKey]||{};
    inspector.append(el('h3','Diseño del elemento'),
      label('Alineación',select([['','De la plantilla'],['left','Izquierda'],['center','Centro'],['right','Derecha']],values.align||'',v=>style('align',v))),
      label('Espacio superior',select([['','De la plantilla'],...Object.keys(spacings).map(k=>[k,k[0].toUpperCase()+k.slice(1)])],values.space||'',v=>style('space',v))));
    const hidden=el('input');hidden.type='checkbox';hidden.checked=!!values.hidden;hidden.onchange=()=>style('hidden',hidden.checked);
    inspector.append(label('Ocultar en la página',hidden));
  }
  function dragPosition(event,node){
    if(side==='inside')return {side,axis:'y'};
    const bounds=node.getBoundingClientRect();
    const peer=node.nextElementSibling||node.previousElementSibling;
    const other=peer?.getBoundingClientRect();
    const horizontal=other&&Math.min(bounds.bottom,other.bottom)>Math.max(bounds.top,other.top)
      &&(other.left>=bounds.right-2||other.right<=bounds.left+2);
    const first=horizontal?event.clientX<bounds.left+bounds.width/2:event.clientY<bounds.top+bounds.height/2;
    return {side:first?'before':'after',axis:horizontal?'x':'y'};
  }
  function disarm(){
    if(armed){const prev=armed.getAttribute('data-layout-draggable');if(prev==='')armed.removeAttribute('draggable');else if(prev!==null)armed.setAttribute('draggable',prev);armed.removeAttribute('data-layout-draggable');}
    armed=null;dragging=false;
  }
  function attach(d){
    doc=d;byKey=new Map(layoutUnits(d).map(node=>[layoutKey(node),node]));
    const css=d.createElement('style');css.textContent=modeCss;d.head.append(css);
    d.addEventListener('pointerdown',e=>{
      if(!enabled||picking)return;
      disarm();let candidate=at(e.target);
      if(source()?.contains(e.target)&&level==='element')candidate=source();
      if(!candidate)return;
      armed=candidate;armed.dataset.layoutDraggable=armed.getAttribute('draggable')??'';armed.draggable=true;
    },true);
    d.addEventListener('pointermove',e=>{
      if(!enabled||dragging)return;
      const n=at(e.target,picking);if(n===hover)return;
      hover?.classList.remove('x-layout-hover');hover=n;n?.classList.add('x-layout-hover');
    },true);
    d.addEventListener('click',e=>{
      if(!enabled)return;
      e.preventDefault();e.stopImmediatePropagation();disarm();
      const n=at(e.target,picking);
      if(picking){if(n)selectTarget(n);return;}
      if(n)selectSource(n);
    },true);
    d.addEventListener('dragstart',e=>{
      if(!enabled)return;
      if(!armed||!armed.contains(e.target)){e.preventDefault();return;}
      selectSource(armed);dragging=true;
      e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',sourceKey);
    },true);
    d.addEventListener('dragover',e=>{
      if(!enabled||!dragging)return;
      const n=at(e.target,true);
      if(drop!==n){clearMarks();drop=n;}
      if(n){
        const position=dragPosition(e,n);n.dataset.layoutDrop=position.side;n.dataset.layoutAxis=position.axis;
        e.preventDefault();e.dataTransfer.dropEffect='move';
      }
    },true);
    d.addEventListener('drop',e=>{
      if(!enabled||!dragging)return;
      e.preventDefault();e.stopImmediatePropagation();
      const n=at(e.target,true);if(n)move(source(),n,dragPosition(e,n).side);clearMarks();disarm();
    },true);
    d.addEventListener('dragend',()=>{clearMarks();disarm();},true);
    d.addEventListener('keydown',e=>{
      if(enabled&&e.key==='Escape'){e.preventDefault();if(picking)selectTarget(null);else leave();}
    },true);
    updateMode(enabled);if(enabled)draw();
  }
  return {trigger,attach,close};
}
