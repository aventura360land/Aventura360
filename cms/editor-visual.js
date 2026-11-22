import {request} from '../resenas/api.js';
import {currentToken} from '../resenas/sesion.js';
import {mergePage} from './paginas.js';
import {destination,place,recordMove} from './disposicion.js';
import {directDrag} from './arrastre.js';
import {mediaLibrary} from './medios.js';
import {visualImage} from './foto-visual.js';
import {safeCssImage} from './plantilla.js';
import {visualText} from './texto-visual.js';
import {validatePublish} from './publicacion.js';

function el(tag,cls,txt){
  const n=document.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;
}
function button(name,txt=name,cls=''){
  const b=el('button',cls,txt);b.type='button';b.setAttribute('aria-label',name);b.title=name;return b;
}
function chrome(page){
  const host=el('div');host.id='xebax-editor-visual';const shadow=host.attachShadow({mode:'open'});
  const css=el('link');css.rel='stylesheet';css.href=new URL('./editor-visual.css',import.meta.url);
  const bar=el('nav','bar');bar.setAttribute('aria-label','Editor de página');
  const start=el('div','bar-start'),end=el('div','bar-end'),history=el('div','history');
  const treeToggle=button('Estructura de la página','☷  Estructura','toggle');
  treeToggle.setAttribute('aria-expanded','true');treeToggle.setAttribute('aria-controls','xebax-structure');
  const pageName=el('strong','page',page.label||page.titulo);
  const undo=button('Deshacer','↶'),redo=button('Rehacer','↷');history.append(undo,redo);
  const status=el('span','status','Sin cambios pendientes');status.setAttribute('role','status');
  const save=button('Guardar borrador','Guardar borrador','secondary');
  const publish=button('Publicar esta página','Publicar','primary'),exit=button('Salir de edición','Salir');
  const panel=button('Ajustes de la página','Ajustes de página');
  start.append(treeToggle,pageName,history);end.append(save,publish,exit);bar.append(start,status,end);

  const dock=el('aside','dock');dock.id='xebax-structure';dock.setAttribute('aria-label','Estructura de la página');
  const dockHead=el('div','dock-head'),fold=button('Cerrar estructura','×','fold');
  dockHead.append(el('h2','','Estructura'),fold);
  const list=el('div','outline');list.setAttribute('aria-label','Secciones y bloques');
  const section=el('div','inspector'),caption=el('strong','selection','Ningún bloque seleccionado');
  const controls=el('div','selection-actions');
  const up=button('Mover antes','↑  Subir'),down=button('Mover después','↓  Bajar');
  const moveTo=button('Elegir destino','Mover a…'),text=button('Editar texto aquí','Editar texto');
  const image=button('Cambiar imagen','Cambiar foto');
  controls.append(up,down,moveTo,text,image);
  const target=el('div','target-actions');target.hidden=true;
  const instruction=el('p','target-label');
  const before=button('Colocar antes','Antes'),after=button('Colocar después','Después');
  const inside=button('Colocar dentro','Dentro'),cancelMove=button('Cancelar movimiento','Cancelar');
  const choices=el('div','target-buttons');choices.append(before,after,inside,cancelMove);
  target.append(instruction,choices);
  section.append(caption,controls,target);
  const dockFoot=el('div','dock-foot');dockFoot.append(panel);
  dock.append(dockHead,list,section,dockFoot);

  const box=el('div','box'),handle=el('div','handle'),line=el('div','line'),ghost=el('div','ghost');
  const grip=button('Arrastrar selección','⠿','grip'),tag=el('span','tag');
  grip.setAttribute('aria-describedby','xebax-drag-help');
  const dragHelp=el('span','sr-only','Arrastra el bloque o usa las flechas del teclado para cambiar su posición.');
  dragHelp.id='xebax-drag-help';handle.append(grip,tag);
  ghost.setAttribute('aria-hidden','true');
  for(const n of [box,handle,line,ghost])n.hidden=true;
  const dialog=el('dialog'),question=el('h2'),detail=el('p'),actions=el('div'),cancel=button('Cancelar'),ok=button('Confirmar','Confirmar','primary');
  actions.append(cancel,ok);dialog.append(question,detail,actions);cancel.onclick=()=>dialog.close('cancel');ok.onclick=()=>dialog.close('ok');
  function confirm(title,body,action){
    if(dialog.open)return Promise.resolve(false);
    question.textContent=title;detail.textContent=body;dialog.setAttribute('aria-label',title);ok.textContent=action;ok.setAttribute('aria-label',action);
    dialog.returnValue='cancel';dialog.showModal();cancel.focus();
    return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='ok'),{once:true}));
  }
  const media=el('dialog','media'),mediaHead=el('header'),mediaBody=el('div');
  media.setAttribute('aria-label','Elegir imagen');const close=button('Cerrar biblioteca','Cerrar');
  mediaHead.append(el('h2','','Elegir imagen'),close);media.append(mediaHead,mediaBody);close.onclick=()=>media.close();
  const spacer=el('div');spacer.setAttribute('aria-hidden','true');document.body.prepend(spacer);
  document.documentElement.classList.add('xebax-editing');
  const styles=el('style');styles.textContent=`
    html{scroll-padding-top:calc(var(--xebax-bar,64px) + 140px);scroll-behavior:auto!important;overflow-anchor:none}
    .xebax-editing body{margin-inline-start:var(--xebax-rail,0px)!important}
    .top-promo,.legal-header{top:var(--xebax-bar,64px)!important}
    .top-promo,#siteHeader{left:var(--xebax-rail,0px)!important}
    #siteHeader{top:calc(var(--xebax-bar,64px) + 50px)!important}
    [data-x-grabbed]{opacity:.62!important}
    [data-x-writing]{outline:2px solid #255bc5!important;outline-offset:2px;cursor:text!important;user-select:text!important}
    .reveal{opacity:1!important;transform:none!important;transition:none!important}
    .xc-block:empty{min-height:2rem}
    .xebax-rail-open #siteHeader .nav{gap:.75rem}
    .xebax-rail-open #siteHeader .nav-links{gap:clamp(.7rem,1.1vw,1.8rem)}
  `;
  document.head.append(styles);shadow.append(css,bar,dock,box,handle,line,ghost,dragHelp,dialog,media);document.body.append(host);
  const wide=matchMedia('(min-width:1180px)');
  function toggleDock(open){
    dock.hidden=!open;treeToggle.setAttribute('aria-expanded',String(open));
    document.documentElement.classList.toggle('xebax-rail-open',open&&wide.matches);
    document.documentElement.style.setProperty('--xebax-rail',open&&wide.matches?'272px':'0px');
  }
  new ResizeObserver(()=>{
    document.documentElement.style.setProperty('--xebax-bar',bar.offsetHeight+'px');
    spacer.style.height=bar.offsetHeight+'px';
  }).observe(bar);
  wide.addEventListener('change',()=>toggleDock(wide.matches));
  treeToggle.onclick=()=>toggleDock(dock.hidden);
  fold.onclick=()=>toggleDock(false);
  toggleDock(wide.matches);
  return {host,bar,dock,list,caption,controls,treeToggle,toggleDock,wide,pageName,status,undo,redo,save,publish,exit,
    box,handle,grip,tag,line,ghost,up,down,moveTo,text,image,target,instruction,before,after,inside,cancelMove,panel,media,mediaBody,confirm};
}
export function frontEditor({page,state,rows}){
  const ui=chrome(page),undo=[],redo=[];
  let live=rows.live.content,version=Number(rows.draft.version),dirty=false,busy=false,conflict=false,editing=null;
  let revision=0,savedRevision=0,nextRevision=0;
  const changedText=()=>Boolean(editing&&editing.span.innerText.trim()!==editing.old.trim());
  const activePage=()=>page.sections?page:state.pages.find(p=>p.id===page.id);
  const snapshot=()=>mergePage({},state,activePage());
  function restore(s){
    const p=page.sections?page:s.pages.find(x=>x.id===page.id);state=mergePage(state,s,p);
  }
  function buttons(){
    if(!page.sections){ui.pageName.textContent=activePage().titulo;document.title=activePage().titulo;}
    ui.undo.disabled=busy||!undo.length;ui.redo.disabled=busy||!redo.length;
    ui.save.disabled=busy||conflict||(!dirty&&!changedText());ui.publish.disabled=busy||conflict;ui.exit.disabled=ui.panel.disabled=busy;
  }
  function changed(message){
    dirty=revision!==savedRevision;
    ui.status.textContent=conflict?'Hay una versión más reciente.':dirty?message:'Sin cambios pendientes';
    buttons();
  }
  function commit(update,undoView,redoView,message){
    const before=snapshot();update();
    const from=revision;revision=++nextRevision;
    undo.push({before,after:snapshot(),from,to:revision,undoView,redoView});
    if(undo.length>30)undo.shift();redo.length=0;changed(message);
  }
  function history(back){
    finishText(true);drag.cancel();const stack=back?undo:redo,other=back?redo:undo;
    if(!stack.length||busy)return;
    const change=stack.pop();
    revision=back?change.from:change.to;restore(back?change.before:change.after);(back?change.undoView:change.redoView)();other.push(change);drag.refresh();
    changed(back?'Cambio deshecho':'Cambio recuperado');
  }
  ui.undo.onclick=()=>history(true);ui.redo.onclick=()=>history(false);
  function move(a,b,side){
    if(busy||!destination(a,b,side))return false;
    const parent=a.parentNode,next=a.nextSibling;
    const to=destination(a,b,side).parent;
    const hadOrder=to.hasAttribute('data-layout-ordered');
    const orders=a.matches('[data-layout-type=section]')?[...to.children].map(n=>[n,n.style.order]):[];
    if(!place(a,b,side))return false;
    commit(()=>recordMove(state,activePage(),a,b,side),()=>{
      parent.insertBefore(a,next);if(!hadOrder)to.removeAttribute('data-layout-ordered');
      for(const [n,value] of orders)n.style.order=value;drag.select(a);
    },()=>{place(a,b,side,true);drag.select(a);},'Bloque movido · Sin guardar');return true;
  }
  const binding=visualText(page,()=>state);
  function finishText(accept){
    if(!editing)return;
    const {span,part,write,old}=editing;editing=null;
    const value=span.innerText.trim(),previous=old.trim();
    span.replaceWith(part);drag.writing(false);
    if(!accept||value===previous){buttons();return;}
    const next=old.match(/^\s*/)[0]+value+old.match(/\s*$/)[0];
    commit(()=>{write(value,next);part.data=next;},()=>{part.data=old;},()=>{part.data=next;},'Cambios sin guardar');
    drag.refresh();
  }
  function editText(hit,n,clicked){
    if(busy)return;finishText(true);
    const match=binding(hit,n,clicked);if(!match)return;
    const {part,write}=match,span=el('span');span.dataset.xWriting='';span.contentEditable='plaintext-only';
    span.setAttribute('role','textbox');span.setAttribute('aria-label','Editar texto del bloque');span.textContent=part.data;
    editing={span,part,write,old:part.data};drag.writing(true);part.replaceWith(span);span.focus({preventScroll:true});
    span.oninput=buttons;
    const range=document.createRange();range.selectNodeContents(span);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
    span.onblur=()=>finishText(true);
    span.onkeydown=e=>{
      if(!e.isComposing&&(e.key==='Escape'||e.key==='Enter'&&!e.shiftKey)){e.preventDefault();e.stopPropagation();finishText(e.key!=='Escape');}
    };
  }
  const photo=visualImage(page,()=>state);
  const library=mediaLibrary(currentToken,message=>ui.status.textContent=message,ui.media);
  function changeImage(hit,unit){
    const field=photo(hit,unit);if(!field||busy)return;
    const {img,full,backdrop,update}=field;
    ui.media.showModal();
    library.mount(ui.mediaBody,'image',url=>{
      const attrs=[[img,'src'],[img,'srcset'],[img,'data-fallback']];
      if(full)attrs.push([full,'data-full']);
      const originals=attrs.map(([n,k])=>n.getAttribute(k));
      const background=backdrop?.style.getPropertyValue('--destino-image');
      const show=()=>{
        img.removeAttribute('srcset');img.removeAttribute('data-fallback');img.src=url;
        if(full)full.setAttribute('data-full',url);
        if(backdrop)backdrop.style.setProperty('--destino-image',safeCssImage(url,document));
      };
      const revert=()=>{
        attrs.forEach(([n,k],i)=>originals[i]===null?n.removeAttribute(k):n.setAttribute(k,originals[i]));
        if(backdrop)backdrop.style.setProperty('--destino-image',background);
      };
      commit(()=>{update(url);show();},revert,show,'Imagen cambiada · Sin guardar');
    });
  }
  const drag=directDrag({host:ui.host,ui,move,editText,changeImage,canChangeImage:(h,n)=>!!photo(h,n),canEdit:(h,n,part)=>!!binding(h,n,part),canMove:()=>!busy});
  async function save(publish){
    finishText(true);if(busy||conflict||(!publish&&!dirty))return;
    const draft=structuredClone(state),out=publish?mergePage(live,draft,activePage()):null;
    if(publish){try{validatePublish(out);}catch(e){ui.status.textContent=e.message;return;}}
    const submitted=revision;busy=true;drag.cancel();ui.status.textContent=publish?'Publicando…':'Guardando…';buttons();
    try{
      const path=publish?'xebax_publish_page':'xebax_save_site';
      const body=publish?{draft_content:draft,live_content:out,expected_version:version}:{payload:draft,publish_now:false,expected_version:version};
      const next=await request('/rest/v1/rpc/'+path,{method:'POST',token:await currentToken(),body});
      version=Number(next);if(publish)live=out;
      savedRevision=submitted;dirty=revision!==savedRevision;
      ui.status.textContent=dirty?'Cambios pendientes':publish?'Página publicada':'Borrador guardado';
    }catch(e){
      conflict=e.code==='40001';
      ui.status.textContent=conflict?'Otro editor guardó cambios. Sal y vuelve a entrar para cargar su versión.':e.status===401?'La sesión caducó. Vuelve a entrar desde el panel.':e.message;
    }finally{busy=false;buttons();}
  }
  ui.save.onclick=()=>save(false);
  ui.publish.onclick=async()=>{
    finishText(true);
    if(await ui.confirm('Publicar esta página','Los visitantes verán los cambios de «'+ui.pageName.textContent+'».','Publicar cambios'))await save(true);
  };
  ui.panel.onclick=async()=>{
    finishText(true);
    if(dirty){await save(false);if(dirty)return;}
    const url=new URL('../resenas/admin.html',import.meta.url);url.searchParams.set('ajustes',page.id);location.assign(url.href);
  };
  ui.exit.onclick=async()=>{
    finishText(true);
    if(dirty&&!await ui.confirm('Salir de edición','Tienes cambios sin guardar en esta página.','Descartar y salir'))return;
    dirty=false;const u=new URL(location.href);u.searchParams.delete('editar');location.assign(u.href);
  };
  window.addEventListener('beforeunload',e=>{if(dirty||busy||changedText()){e.preventDefault();e.returnValue='';}});
  window.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey)||ui.host.shadowRoot.querySelector('dialog[open]'))return;
    const key=e.key.toLowerCase();
    if(key==='s'){e.preventDefault();save(false);}
    if(!editing&&(key==='z'||key==='y')){e.preventDefault();history(key==='z'&&!e.shiftKey);}
  });
  buttons();
}
