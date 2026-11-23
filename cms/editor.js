import {studioURL} from './acceso-visual.js';
import {validatePublish} from './publicacion.js';
import {pageCanvas} from './lienzo.js';
import {pagesList,mergePage,paginaURL} from './paginas.js';
import {request} from '../resenas/api.js';
import {createState,themeFields,reviewCopy,nombre} from './modelo.js';
import {appearanceFields} from './apariencia.js';
import {replaceAsset} from './reemplazar.js';
import {mediaLibrary} from './medios.js';
import {editTemplate,editCustom,editDynamic} from './edicion.js';
import {$,button,el,field} from './formularios.js';
let confirmPending=false;
export function confirmar(title,body,ok='Continuar'){
  if(confirmPending)return Promise.resolve(false);
  return new Promise(resolve=>{
    const dialog=$('confirm-dialog');confirmPending=true;$('confirm-title').textContent=title;$('confirm-body').textContent=body;$('confirm-ok').textContent=ok;
    dialog.returnValue='cancel';dialog.addEventListener('close',()=>{confirmPending=false;resolve(dialog.returnValue==='ok');},{once:true});dialog.showModal();
  });
}
function jsonFile(file){return fetch(new URL(file,import.meta.url)).then(r=>{if(!r.ok)throw Error('Falta un archivo del editor.');return r.json();});}
const definitions=[['all-pages','Páginas'],['site-content','Contenido del sitio'],['inicio','Página de inicio'],['privacidad','Privacidad'],['terminos','Términos y condiciones'],['extras','Secciones y paquetes'],['pages','Páginas nuevas'],['servicios','Fichas de servicios'],['mapa','Puntos del mapa'],['asistente','Asistente de la web'],['interfaz','Contacto y mensajes'],['appearance','Apariencia'],['media','Biblioteca de medios'],['history','Historial']];
export function createEditor({token,report,openReviews}){
  let state,catalog,dynamic,revision=0,dirty=false,serial=0,working=false,section='',previewNonce='',session=0,conflict=false;
  let live=createState(),activePage=null,disposeCanvas=null;
  let undoStack=[],redoStack=[],baseline=null,groupTimer=0,restoring=false;
  const track=()=>{
    if(!activePage||restoring)return;
    if(!groupTimer&&baseline){undoStack.push(baseline);if(undoStack.length>35)undoStack.shift();}
    redoStack=[];clearTimeout(groupTimer);
    groupTimer=setTimeout(()=>{groupTimer=0;if(activePage)baseline=mergePage({},state,activePage);},450);
    syncHistoryButtons();
  };
  function syncHistoryButtons(){
    const undo=host.querySelector('[data-edit-action="undo"]'),redo=host.querySelector('[data-edit-action="redo"]');
    if(undo)undo.disabled=!undoStack.length;if(redo)redo.disabled=!redoStack.length;
  }
  function changeHistory(direction){
    if(!activePage||working)return;
    const source=direction==='undo'?undoStack:redoStack,destination=direction==='undo'?redoStack:undoStack;
    if(!source.length)return;
    clearTimeout(groupTimer);groupTimer=0;
    const id=activePage.id,previous=source.pop();destination.push(mergePage({},state,activePage));
    const oldPage=activePage.sections?activePage:previous.pages.find(p=>p.id===id);
    state=mergePage(state,previous,oldPage);
    const page=oldPage.sections?oldPage:state.pages.find(p=>p.id===id);
    restoring=true;try{open('canvas',page);changed();}finally{restoring=false;}
    baseline=mergePage({},state,page);syncHistoryButtons();
  }
  const nav=$('cms-nav'),host=$('workspace'),media=mediaLibrary(token,report);
  const fileKeys=['preview','save','publish'];
  const changed=()=>{track();dirty=true;serial++;$('save-state').textContent=conflict?'Conflicto de versiones':'Cambios sin guardar';};
  function changeLayout(update){
    clearTimeout(groupTimer);groupTimer=0;
    baseline=mergePage({},state,activePage);
    update();changed();
    clearTimeout(groupTimer);groupTimer=0;
    baseline=mergePage({},state,activePage);
  }
  const ctx=()=>({state,catalog,dynamic,changed,changeLayout,choose:media.choose,confirm:confirmar,report,saveDraft:()=>save(false),changeHistory});
  const readDraft=async()=>{
    const rows=await request('/rest/v1/xebax_cms?select=slot,content,version',{token:await token()});
    const draft=rows.find(r=>r.slot==='draft'),published=rows.find(r=>r.slot==='live');
    if(!draft||!published)throw Error('Esta cuenta no tiene acceso al editor.');
    return {draft,live:published};
  };
  const showVersion=()=>{$('save-state').textContent='Borrador · versión '+revision;};
  function replaceDraft(rows){state=createState(rows.draft.content);live=createState(rows.live.content);revision=Number(rows.draft.version);dirty=false;conflict=false;serial++;showVersion();}
  async function history(){
    const info=el('p','Cargando versiones…');host.append(info);
    const active=session;
    try{
      let before=null; const stack=el('div');host.append(stack);
      const next=button('Ver más versiones',async()=>{try{await load();}catch(e){report(e.message);}});
      async function load(){
        next.disabled=true;const cursor=before!==null?'&version=lt.'+before:'';
        const rows=await request('/rest/v1/xebax_cms_history?select=version,created_at&order=version.desc&limit=15'+cursor,{token:await token()});
        if(active!==session||section!=='history'||!info.isConnected)return;
        info.textContent='Las versiones anteriores se pueden recuperar como borrador.';
        if(!rows.length&&before===null)info.textContent='Aquí aparecerán las versiones anteriores tras publicar cambios.';
        for(const row of rows){
          const line=el('div',undefined,'page-line');line.append(el('strong','Versión '+row.version),el('span',new Date(row.created_at).toLocaleString('es-CO')),button('Recuperar como borrador',async()=>{
            if(!await confirmar('Recuperar versión '+row.version,'Reemplazará el borrador actual. La web pública seguirá con su contenido actual.','Recuperar'))return;
            try{
              const [item]=await request('/rest/v1/xebax_cms_history?select=content&version=eq.'+row.version,{token:await token()});if(!item)throw Error('La versión ya no está disponible.');
              const previous=state;state=createState(item.content);changed();if(!(await save(false))){state=previous;changed();return;}open('all-pages');report('Versión recuperada como borrador.');
            }catch(e){report(e.message);}
          }));stack.append(line);
        }
        if(rows.length)before=rows.at(-1).version;next.disabled=false;next.hidden=rows.length<15;
      }await load();host.append(next);
    }catch(e){info.textContent=e.message;}
  }
  async function reloadDraft(){
    if(dirty&&!await confirmar('Cargar borrador del servidor','Se descartarán los cambios locales de este panel.','Cargar'))return;
    try{replaceDraft(await readDraft());open(section==='canvas'?'all-pages':section);report('Borrador actualizado.');}catch(e){report(e.message);}
  }
  function open(k,jump=null){
    disposeCanvas?.();disposeCanvas=null;
    clearTimeout(groupTimer);groupTimer=0;
    activePage=k==='canvas'?jump:null;section=k;
    if(!restoring){undoStack=[];redoStack=[];baseline=activePage?mergePage({},state,activePage):null;}
    const editing=Boolean(activePage);
    document.body.classList.toggle('wp-editing',editing);
    const group=editing?'all-pages':['extras','pages','servicios','mapa','asistente','interfaz'].includes(k)?'site-content':k;
    $('publish').textContent=editing?(activePage.sections||live.pages.some(p=>p.id===activePage.id&&p.visible)?'Actualizar página':'Publicar página'):'Publicar sitio';
    $('publish').hidden=!state||k==='all-pages'||k==='reviews';
    for(const b of nav.querySelectorAll('button[data-view]')){if(b.dataset.view===group)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    $('review-panel').hidden=k!=='reviews';host.hidden=k==='reviews';host.replaceChildren();
    if(k==='reviews'){openReviews();return;}
    const title=activePage?.label||activePage?.titulo||definitions.find(d=>d[0]===k)?.[1]||'Contenido';host.append(el('h1',title));
    if(conflict)host.append(button('Cargar la versión actual del servidor',reloadDraft));
    const content=el('div');host.append(content);const c=ctx(),page=catalog.pages.find(p=>p.id===k);
    if(k==='all-pages'){
      const studio=async (page,tab)=>{
        if(working||dirty&&!await save(false))return;
        location.assign(studioURL(page.id,null,tab));
      };
      pagesList(content,c,live,p=>studio(p),p=>studio(p,'page'));
    }
    else if(k==='canvas'){disposeCanvas=pageCanvas(content,activePage,c,()=>open('all-pages'));syncHistoryButtons();}
    else if(k==='site-content'){
      const menu=el('div',undefined,'wp-options');
      for(const [id,label] of definitions.filter(([id])=>['extras','pages','servicios','mapa','asistente','interfaz'].includes(id))){
        menu.append(button(id==='pages'?'Organizar páginas personalizadas':label,()=>open(id)));
      }content.append(menu);
    }
    else if(page)editTemplate(content,page,c,jump);
    else if(k==='extras'||k==='pages')editCustom(content,k==='pages',c);
    else if(['servicios','mapa','asistente','interfaz'].includes(k)){
      editDynamic(content,k,c);
      if(k==='interfaz'){
        content.append(el('h2','Mensajes de reseñas'));for(const [key,v] of Object.entries(reviewCopy))content.append(field({label:nombre(key),type:'text'},state.reviews[key]??v,value=>{state.reviews[key]=value;changed();}));
      }
    }else if(k==='appearance'){
      for(const [id,[label,value]] of Object.entries(themeFields))content.append(field({label,type:'color'},state.theme[id]||value,v=>{state.theme[id]=v;changed();}));
      state.appearance??={};for(const f of appearanceFields)content.append(field(f,state.appearance[f.id]??f.value,v=>{state.appearance[f.id]=v;changed();},media.choose));
    }else if(k==='media')media.mount(content,'',null,(kind,oldUrl)=>{
      media.choose(kind,newUrl=>{
        if(!state)return;
        const n=replaceAsset(state,catalog,dynamic,oldUrl,newUrl);
        if(n)changed();report(n?'Archivo reemplazado en el borrador ('+n+' referencias).':'Este archivo no está en uso en el contenido editable.');
      });
    });
    else if(k==='history')history();
  }
  async function save(publish,scope=null){
    if(working||!state)return false;
    if(conflict){report('Carga el borrador actual antes de guardar.');return false;}
    const outgoing=publish&&scope?mergePage(live,state,scope):state;
    if(publish)try{validatePublish(outgoing);}catch(e){report(e.message);return false;}
    const currentSession=session,at=serial,payload=structuredClone(state);
    working=true;for(const k of ['save','publish'])$(k).disabled=true;
    try{
      const publishingPage=Boolean(publish&&scope),snapshot=publishingPage?structuredClone(outgoing):payload;
      const rpc=publishingPage?'xebax_publish_page':'xebax_save_site';
      const args=publishingPage?{draft_content:payload,live_content:snapshot,expected_version:revision}:{payload,expected_version:revision,publish_now:publish};
      const version=await request('/rest/v1/rpc/'+rpc,{method:'POST',token:await token(),body:args});
      if(currentSession!==session)return false;
      if(publish){live=createState(snapshot);if(scope&&activePage?.id===scope.id)$('publish').textContent=scope.visible===false?'Publicar página':'Actualizar página';}
      revision=Number(version);if(serial===at){dirty=false;$('save-state').textContent=(publish?'Publicado':'Borrador guardado')+' · versión '+revision;}else changed();
      report(publish?(scope?'Página actualizada.':'Cambios publicados.'):'Borrador guardado.');return true;
    }catch(e){
      if(e.code==='40001'){conflict=true;open(section,activePage);$('save-state').textContent='Conflicto de versiones';report('Otra sesión actualizó el contenido. Copia tus cambios y carga la versión actual.');}
      else report(e.status===401?'La sesión caducó. Copia tus cambios antes de volver a entrar.':e.message);
      return false;
    }finally{working=false;for(const k of ['save','publish'])$(k).disabled=false;}
  }
  function previewUrl(){
    previewNonce=crypto.randomUUID();const url=new URL($('preview-page').value,location.href);url.searchParams.set('borrador',previewNonce);$('preview-frame').src=url.href;
  }
  function preview(){
    const selector=$('preview-page');selector.replaceChildren();
    const pages=[['../index.html','Inicio'],['../privacidad.html','Privacidad'],['../terminos.html','Términos y condiciones'],...state.pages.filter(p=>p.slug).map(p=>['../pagina.html?p='+encodeURIComponent(p.slug),p.titulo])];
    for(const [url,label] of pages){const opt=el('option',label);opt.value=url;selector.append(opt);}
    if(activePage)selector.value=paginaURL(activePage);
    else if(['privacidad','terminos'].includes(section))selector.value='../'+section+'.html';
    $('preview-dialog').showModal();previewUrl();
  }
  window.addEventListener('message',e=>{
    const frame=$('preview-frame');
    if(!state||!$('preview-dialog').open||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.nonce!==previewNonce)return;
    if(e.data.type!=='xebax-preview-ready')return;
    frame.contentWindow.postMessage({type:'xebax-preview-data',nonce:previewNonce,content:state},location.origin);
  });
  $('preview-page').onchange=previewUrl;
  $('preview-dialog').addEventListener('close',()=>{previewNonce='';$('preview-frame').removeAttribute('src');});
  for(const d of document.querySelectorAll('dialog [data-close]'))d.onclick=()=>d.closest('dialog').close();
  $('preview').onclick=preview;$('save').onclick=()=>save(false);
  $('publish').onclick=async()=>{
    const page=activePage,action=$('publish').textContent;
    const msg=page?'Se actualizará «'+(page.label||page.titulo)+'». Los cambios de otras páginas seguirán en borrador.':'Se publicarán todos los cambios pendientes del sitio, incluidas las demás páginas.';
    if(await confirmar(action,msg,action))await save(true,page);
  };
  $('reviews-nav').dataset.view='reviews';$('reviews-nav').onclick=()=>open('reviews');
  window.addEventListener('keydown',e=>{
    if(state&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save(false);}
  });
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  async function start(){
    const active=++session;
    const [row,c,d]=await Promise.all([readDraft(),jsonFile('plantilla.json'),jsonFile('dinamico.json')]);
    if(active!==session)return;catalog=c;dynamic=d;replaceDraft(row);
    for(const [id,label] of definitions.filter(([id])=>['all-pages','site-content','media','appearance','history'].includes(id))){const b=button(label,()=>open(id));b.dataset.view=id;nav.insertBefore(b,$('reviews-nav'));}
    for(const id of fileKeys)$(id).hidden=false;
    const id=new URL(location.href).searchParams.get('ajustes');
    const page=[...catalog.pages,...state.pages].find(p=>p.id===id);
    if(page)location.replace(studioURL(page.id,null,'page'));else open('all-pages');
  }
  function stop(){clearTimeout(groupTimer);groupTimer=0;undoStack=[];redoStack=[];baseline=null;disposeCanvas?.();disposeCanvas=null;activePage=null;live=createState();document.body.classList.remove('wp-editing');session++;dirty=false;conflict=false;state=null;previewNonce='';host.replaceChildren();host.hidden=true;nav.querySelectorAll('button:not(#reviews-nav)').forEach(b=>b.remove());for(const id of fileKeys)$(id).hidden=true;$('save-state').textContent='';for(const id of ['media-dialog','preview-dialog'])if($(id).open)$(id).close();}
  return {start,stop,showReviews:()=>open('reviews'),hasChanges:()=>dirty,isSaving:()=>working};
}
