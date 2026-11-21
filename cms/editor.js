import {request} from '../resenas/api.js';
import {createState,themeFields,reviewCopy,nombre,slugify} from './modelo.js';
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
const definitions=[['inicio','Página de inicio'],['privacidad','Privacidad'],['terminos','Términos y condiciones'],['extras','Secciones y paquetes'],['pages','Páginas nuevas'],['servicios','Fichas de servicios'],['mapa','Puntos del mapa'],['asistente','Asistente de la web'],['interfaz','Contacto y mensajes'],['appearance','Apariencia'],['media','Biblioteca de medios'],['history','Historial']];
function validatePublish(state){
  const slugs=new Set();
  for(const p of state.pages){
    if(!p.titulo.trim()||!p.slug||slugify(p.slug)!==p.slug||slugs.has(p.slug))throw Error('Revisa Páginas nuevas. Cada página necesita título y dirección única en minúsculas, sin espacios.');
    slugs.add(p.slug);
  }
  if(state.dynamic&&!/^\d{7,15}$/.test(state.dynamic.whatsapp))throw Error('Revisa el número en Contacto y mensajes. Escribe solo dígitos con el indicativo internacional.');
  for(const p of [...state.pages,...state.extras]){
    if(!p.visible)continue;
    for(const b of p.blocks||[]){
      if(b.type==='paquete'&&!b.titulo.trim())throw Error('Escribe un nombre para el paquete turístico de «'+p.titulo+'».');
    }
  }
}
export function createEditor({token,report,openReviews}){
  let state,catalog,dynamic,revision=0,dirty=false,serial=0,working=false,section='',previewNonce='',session=0,conflict=false;
  const nav=$('cms-nav'),host=$('workspace'),media=mediaLibrary(token,report);
  const fileKeys=['preview','save','publish'];
  const changed=()=>{dirty=true;serial++;$('save-state').textContent=conflict?'Conflicto de versiones':'Cambios sin guardar';};
  const ctx=()=>({state,catalog,dynamic,changed,choose:media.choose,confirm:confirmar,report});
  const readDraft=async()=>{const rows=await request('/rest/v1/xebax_cms?slot=eq.draft&select=content,version',{token:await token()});if(!rows.length)throw Error('Esta cuenta no tiene acceso al borrador.');return rows[0];};
  const showVersion=()=>{$('save-state').textContent='Borrador · versión '+revision;};
  function replaceDraft(row){state=createState(row.content);revision=Number(row.version);dirty=false;conflict=false;serial++;showVersion();}
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
              const previous=state;state=createState(item.content);changed();if(!(await save(false))){state=previous;changed();return;}open('inicio');report('Versión recuperada como borrador.');
            }catch(e){report(e.message);}
          }));stack.append(line);
        }
        if(rows.length)before=rows.at(-1).version;next.disabled=false;next.hidden=rows.length<15;
      }await load();host.append(next);
    }catch(e){info.textContent=e.message;}
  }
  async function reloadDraft(){
    if(dirty&&!await confirmar('Cargar borrador del servidor','Se descartarán los cambios locales de este panel.','Cargar'))return;
    try{replaceDraft(await readDraft());open(section);report('Borrador actualizado.');}catch(e){report(e.message);}
  }
  function open(k,jump=null){
    section=k;
    for(const b of nav.querySelectorAll('button[data-view]')){if(b.dataset.view===k)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    $('review-panel').hidden=k!=='reviews';host.hidden=k==='reviews';host.replaceChildren();
    if(k==='reviews'){openReviews();return;}
    const title=definitions.find(d=>d[0]===k)?.[1]||'Contenido';host.append(el('h1',title));
    if(conflict)host.append(button('Cargar la versión actual del servidor',reloadDraft));
    const content=el('div');host.append(content);const c=ctx(),page=catalog.pages.find(p=>p.id===k);
    if(page)editTemplate(content,page,c,jump);
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
  async function save(publish){
    if(working||!state)return false;
    if(conflict){report('Carga el borrador actual antes de guardar.');return false;}
    if(publish)try{validatePublish(state);}catch(e){report(e.message);return false;}
    const currentSession=session,at=serial,payload=structuredClone(state);
    working=true;for(const k of ['save','publish'])$(k).disabled=true;
    try{
      const version=await request('/rest/v1/rpc/xebax_save_site',{method:'POST',token:await token(),body:{payload,expected_version:revision,publish_now:publish}});
      if(currentSession!==session)return false;
      revision=Number(version);if(serial===at){dirty=false;$('save-state').textContent=(publish?'Publicado':'Borrador guardado')+' · versión '+revision;}else changed();
      report(publish?'Cambios publicados.':'Borrador guardado.');return true;
    }catch(e){
      if(e.code==='40001'){conflict=true;open(section);$('save-state').textContent='Conflicto de versiones';report('Otra sesión actualizó el contenido. Copia tus cambios y carga la versión actual.');}
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
    if(['privacidad','terminos'].includes(section))selector.value='../'+section+'.html';
    $('preview-dialog').showModal();previewUrl();
  }
  window.addEventListener('message',e=>{
    const frame=$('preview-frame');
    if(!state||!$('preview-dialog').open||e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.nonce!==previewNonce)return;
    if(e.data.type==='xebax-preview-mounted'){syncVisual();return;}
    if(e.data.type==='xebax-preview-edit'){
      if(!$('visual-mode').checked)return;
      const hit=e.data;const page=catalog.pages.find(p=>p.id===hit.pageId);
      if(hit.custom){$('preview-dialog').close();open(hit.pageId==='pagina'?'pages':'extras');return;}
      if(!page)return;
      for(const s of page.sections){
        const collection=s.collections.find(c=>c.id===hit.collection);
        const fields=collection?collection.items.flatMap(i=>i.fields):s.fields;
        const matches=fields.filter(f=>f.node===hit.node);
        const f=matches.find(f=>f.type==='image'||f.type==='video')||matches.find(f=>f.text!==undefined)||matches[0];
        if(!f&&s.id!==hit.section)continue;
        $('preview-dialog').close();open(page.id,{section:s.id,field:f?.id,collection:hit.collection,item:hit.item});return;
      }return;
    }
    if(e.data.type!=='xebax-preview-ready')return;
    frame.contentWindow.postMessage({type:'xebax-preview-data',nonce:previewNonce,content:state},location.origin);
  });
  function syncVisual(){$('preview-frame').contentWindow?.postMessage({type:'xebax-preview-mode',nonce:previewNonce,enabled:$('visual-mode').checked},location.origin);}
  $('visual-mode').onchange=syncVisual;
  $('preview-page').onchange=previewUrl;
  $('preview-dialog').addEventListener('close',()=>{previewNonce='';$('preview-frame').removeAttribute('src');});
  for(const d of document.querySelectorAll('dialog [data-close]'))d.onclick=()=>d.closest('dialog').close();
  $('preview').onclick=preview;$('save').onclick=()=>save(false);
  $('publish').onclick=async()=>{if(await confirmar('Publicar cambios','Los visitantes verán esta versión de la web. La versión anterior quedará en el historial.','Publicar'))await save(true);};
  $('reviews-nav').dataset.view='reviews';$('reviews-nav').onclick=()=>open('reviews');
  window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
  async function start(){
    const active=++session;
    const [row,c,d]=await Promise.all([readDraft(),jsonFile('plantilla.json'),jsonFile('dinamico.json')]);
    if(active!==session)return;catalog=c;dynamic=d;replaceDraft(row);
    for(const [id,label] of definitions){const b=button(label,()=>open(id));b.dataset.view=id;nav.insertBefore(b,$('reviews-nav'));}
    for(const id of fileKeys)$(id).hidden=false;open('inicio');
  }
  function stop(){session++;dirty=false;conflict=false;state=null;previewNonce='';host.replaceChildren();host.hidden=true;nav.querySelectorAll('button:not(#reviews-nav)').forEach(b=>b.remove());for(const id of fileKeys)$(id).hidden=true;$('save-state').textContent='';for(const id of ['media-dialog','preview-dialog'])if($(id).open)$(id).close();}
  return {start,stop,showReviews:()=>open('reviews'),hasChanges:()=>dirty,isSaving:()=>working};
}
