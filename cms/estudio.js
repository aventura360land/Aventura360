import {openDraft} from './acceso-visual.js';
import {currentToken,editorSession} from '../resenas/sesion.js';
import {request} from '../resenas/api.js';
import {button,el} from './formularios.js';
import {blockTypes,createState,idNuevo} from './modelo.js';
import {createPage,paginaURL,mergePage} from './paginas.js';
import {validatePublish} from './publicacion.js';
import {destination,layoutKey,orderedChildren,place,recordMove} from './disposicion.js';
import {labelOf} from './estructura.js';
import {mediaLibrary} from './medios.js';
import {visualText,textAtPoint} from './texto-visual.js';
import {canvasUI} from './estudio-lienzo.js';
import {blockOwner,studioInspector} from './estudio-ajustes.js';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const frame=$('frame'),workspace=$('workspace'),tree=$('tree'),inspectorHost=$('inspector'),pageMenu=$('pages');
const status=$('status'),loading=$('loading'),publish=$('publish'),save=$('save');
const pageTitle=p=>p?.label||p?.titulo||'Página sin título';

let catalog,draft,live,version,busy=false,conflict=false,mounted=false,preview=false,nonce='',timer;
let revision=0,saved=0,sequence=0,pageId='',selectedKey='',targetKey='',choosing=false,inline=null;
let tab=params.get('tab')==='page'?'page':'block',nodes=new Map(),scroll={left:0,top:0},follow=false;
const undo=[],redo=[],expansions=new Map(),nativeRoot='[data-x-layout]';
const page=()=>catalog?.pages.find(p=>p.id===pageId)||draft?.pages.find(p=>p.id===pageId);
const selection=()=>nodes.get(selectedKey);
const target=()=>nodes.get(targetKey);
const dirty=()=>revision!==saved||inspector.pending()||Boolean(inline&&inline.span.innerText!==inline.original.data);

function report(message,error=false){
  status.textContent=message;status.toggleAttribute('data-error',error);
}

function buttons(){
  save.disabled=!draft||!dirty()||busy||conflict;
  publish.disabled=!draft||busy||conflict||!mounted;
  $('preview').disabled=!mounted||busy;
  $('undo').disabled=!undo.length||busy;
  $('redo').disabled=!redo.length||busy;
  pageMenu.disabled=!draft||busy;
}
function updatePages(){
  const pages=[...catalog.pages,...draft.pages];
  const items=pages.map(p=>new Option(pageTitle(p),p.id));
  pageMenu.replaceChildren(...items,new Option('+ Crear página','__new__'));
  pageMenu.value=pageId;
  $('add-section').hidden=!page()?.sections;
  const actual=page()?.sections?page():live.pages.find(p=>p.id===pageId&&p.visible);
  $('visit').hidden=!actual;
  if(actual)$('visit').href=paginaURL(actual);
}

function commit(change,{reload=true,message='Cambios sin guardar'}={}){
  const before={doc:structuredClone(draft),revision,pageId,key:selectedKey};
  change(draft);
  revision=++sequence;
  undo.push({before,after:{doc:structuredClone(draft),revision,pageId,key:selectedKey}});
  if(undo.length>30)undo.shift();
  redo.length=0;report(message);buttons();updatePages();
  if(reload)load();
}

function history(back){
  if(busy)return;
  finishInline(true);
  if(!inspector.flush())return;
  const stack=back?undo:redo,other=back?redo:undo;
  if(!stack.length)return;
  cancelMove(false);canvas.cancel();
  const entry=stack.pop(),item=back?entry.before:entry.after;
  other.push(entry);
  const samePage=pageId===item.pageId;
  draft=createState(structuredClone(item.doc));pageId=item.pageId;
  selectedKey=item.key;revision=item.revision;
  if(!samePage)$('search').value='';
  replacePageURL();updatePages();load({reset:!samePage});buttons();
  report(revision===saved?'Sin cambios pendientes':back?'Cambio deshecho':'Cambio rehecho');
}

function modal(title,body,action){
  const dialog=$('confirm-dialog');
  $('confirm-title').textContent=title;$('confirm-copy').textContent=body;$('confirm-action').textContent=action;
  dialog.returnValue='cancel';dialog.showModal();
  return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='yes'),{once:true}));
}

const media=mediaLibrary(currentToken,report,$('media-dialog'));
function choose(kind,onChoose){
  $('media-dialog').showModal();media.mount($('media-content'),kind,onChoose);
}

function pane(name,open){
  if(open){
    const other=name==='left'?'right':'left';
    $(other).removeAttribute('data-open');$('open-'+other).setAttribute('aria-expanded','false');
  }
  $(name).toggleAttribute('data-open',open);$('open-'+name).setAttribute('aria-expanded',String(open));
}
function setTab(next){
  finishInline(true);
  if(!inspector.flush())return;
  tab=next;
  $('block-tab').setAttribute('aria-pressed',String(tab==='block'));
  $('page-tab').setAttribute('aria-pressed',String(tab==='page'));
  if(revision!==displayedRevision)load();else inspector.render(selection(),tab);
}

function setLeftTab(add){
  $('layers').hidden=add;$('insert').hidden=!add;
  $('layers-tab').setAttribute('aria-pressed',String(!add));$('add-tab').setAttribute('aria-pressed',String(add));
}

function showPath(node){
  if(!node){$('path').textContent=pageTitle(page());return;}
  const section=node.closest('[data-layout-type=section]');
  $('path').textContent=section&&section!==node?labelOf(section).name+' / '+labelOf(node).name:labelOf(node).name;
  $('path').title=$('path').textContent;
}

function drawTree(reveal=false){
  const query=$('search').value.trim().toLocaleLowerCase('es'),doc=frame.contentDocument;
  const opened=expansions.get(pageId)||new Set();expansions.set(pageId,opened);
  if(reveal){
    for(let n=selection()?.parentElement?.closest(nativeRoot);n;n=n.parentElement?.closest(nativeRoot))opened.add(layoutKey(n));
  }
  const oldScroll=$('layers').scrollTop;
  const fragment=document.createDocumentFragment();
  function rows(container,host,level){
    for(const node of orderedChildren(container)){
      if(node.matches('script,style,dialog,noscript,template'))continue;
      const key=layoutKey(node);
      if(!key){rows(node,host,level);continue;}
      const {name,kind}=labelOf(node);
      const nested=el('div');rows(node,nested,query?0:level+1);
      const matches=!query||name.toLocaleLowerCase('es').includes(query);
      if(!matches){host.append(...nested.children);continue;}
      const row=el('div',undefined,'tree-row');row.style.setProperty('--depth',Math.min(6,level));
      row.dataset.key=key;row.toggleAttribute('data-selected',key===selectedKey);row.toggleAttribute('data-target',key===targetKey);
      row.toggleAttribute('data-hidden',node.hidden||node.hasAttribute('data-layout-hidden'));
      const expand=button('›',()=>{
        nested.hidden=!nested.hidden;
        if(nested.hidden)opened.delete(key);else opened.add(key);
        collapse();
      },'expand');
      function collapse(){
        expand.setAttribute('aria-expanded',String(!nested.hidden));
        expand.setAttribute('aria-label',(nested.hidden?'Expandir ':'Contraer ')+name);
      }
      nested.hidden=!query&&!opened.has(key);expand.disabled=!nested.childElementCount;collapse();
      const select=button(name,()=>onSelect(node,true),'tree-name');select.title=kind+' · '+name;
      if(query){
        const section=node.parentElement?.closest('[data-layout-type=section]');
        const context=section?kind+' · '+labelOf(section).name:kind;
        select.prepend(el('small',context,'tree-kind'));
        select.setAttribute('aria-label',name+' · '+context);
      }
      if(key===selectedKey)select.setAttribute('aria-current','true');
      const grip=el('button',undefined,'tree-grip');grip.type='button';grip.setAttribute('aria-label','Arrastrar '+name);
      grip.onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();step(e.key==='ArrowUp'?-1:1,node);}};
      row.append(expand,select,grip);host.append(row);
      if(nested.childElementCount)host.append(nested);
    }
  }
  for(const [selector,title] of [['body > main',''],['body > header','Cabecera'],['body > footer','Pie de página']]){
    const root=doc.querySelector(selector);
    if(!root)continue;
    if(!title){rows(root,fragment,0);continue;}
    const group=el('details'),children=el('div');
    rows(root,children,0);if(!children.childElementCount)continue;
    const groupId='group-'+selector;
    group.open=Boolean(query||opened.has(groupId)||reveal&&root.contains(selection()));
    group.ontoggle=()=>{if(group.open)opened.add(groupId);else opened.delete(groupId);};
    group.append(el('summary',title,'tree-group'),children);fragment.append(group);
  }
  if(!fragment.childElementCount)fragment.append(el('p','No hay coincidencias.'));
  tree.replaceChildren(fragment);$('layers').scrollTop=oldScroll;
  const selectedRow=tree.querySelector('[data-selected]');
  if(reveal&&selectedRow?.getClientRects().length){
    const box=$('layers').getBoundingClientRect(),r=selectedRow.getBoundingClientRect();
    if(r.top<box.top)$('layers').scrollTop+=r.top-box.top-5;
    else if(r.bottom>box.bottom)$('layers').scrollTop+=r.bottom-box.bottom+5;
  }
}

function select(node,reveal=false,follow=false){
  selectedKey=layoutKey(node)||'';tab='block';
  $('block-tab').setAttribute('aria-pressed','true');$('page-tab').setAttribute('aria-pressed','false');
  drawTree(reveal);canvas.select(node,follow);inspector.render(node,tab);showPath(node);
}
function onSelect(node,fromTree=false){
  if(busy||!mounted)return;
  if(choosing){
    if(!['before','after','inside'].some(side=>destination(selection(),node,side))){
      report('Elige un destino compatible con este bloque.',true);return;
    }
    targetKey=layoutKey(node);
    if(fromTree&&node.getClientRects().length)node.scrollIntoView({block:'center',behavior:'instant'});
    const side=['before','after','inside'].find(value=>destination(selection(),node,value));
    canvas.mark({node,side});drawTree();inspector.render(selection(),tab);
    pane('right',true);report('Elige la posición respecto al destino.');return;
  }
  finishInline(true);
  if(!inspector.flush())return;
  select(node,true,fromTree);
  if(revision!==displayedRevision)load({follow:fromTree});
  if(fromTree&&matchMedia('(max-width:760px)').matches)pane('left',false);
}

function startMove(){
  if(!inspector.flush()||!selection())return;
  choosing=true;inspector.render(selection(),'block');canvas.draw();
  report('Selecciona el destino en el lienzo o en Estructura.');
  if(matchMedia('(max-width:1120px)').matches)pane('right',false);
}
function cancelMove(draw=true){
  choosing=false;targetKey='';canvas.mark(null);canvas.draw();
  if(draw&&mounted){drawTree();inspector.render(selection(),tab);report(dirty()?'Cambios sin guardar':'Sin cambios pendientes');}
}
function move(source,dest,side){
  if(!mounted||busy||!inspector.flush()||!destination(source,dest,side))return;
  const shouldReload=displayedRevision!==revision;
  if(!place(source,dest,side)){report('El bloque ya está en esa posición.');return;}
  commit(state=>recordMove(state,page(),source,dest,side),{reload:false,message:'Bloque movido · Sin guardar'});
  displayedRevision=revision;
  choosing=false;targetKey='';canvas.mark(null);select(source,true);
  if(shouldReload)load();
}
function step(delta,source=selection()){
  const siblings=canvas.siblings(source),other=siblings[siblings.indexOf(source)+delta];
  if(other)move(source,other,delta<0?'before':'after');
}

function insertSection(){
  if(!mounted||busy||!page()?.sections||!inspector.flush())return;
  const node=selection(),{owner}=blockOwner(draft,node,page());
  const section={id:idNuevo(),pagina:pageId,titulo:'Nueva sección',visible:true,menu:false,
    after:node?.closest('[data-x-section]')?.dataset.xSection||owner?.after||'',blocks:[]};
  commit(state=>{
    state.extras.push(section);selectedKey='e:'+encodeURIComponent('seccion-'+section.id);
  },{reload:false,message:'Sección añadida · Sin guardar'});
  $('search').value='';setLeftTab(false);pane('right',true);tab='block';load({follow:true});
}
function insertBlock(type){
  if(!mounted||busy||!inspector.flush())return;
  const model=page(),node=selection(),entry=blockOwner(draft,node,model);
  const value={type,blockId:idNuevo(),...structuredClone(blockTypes[type][1])};
  if(type==='texto')value.texto='Escribe el texto del bloque.';
  if(type==='paquete')value.titulo='Nuevo paquete';
  const anchor=node?.closest('[data-x-section]')?.dataset.xSection||node?.closest('.xc-section')&&entry.owner?.after||'';
  commit(state=>{
    let owner=entry.owner;
    if(!owner&&model.sections){
      owner={id:idNuevo(),pagina:model.id,titulo:'',visible:true,menu:false,after:anchor,blocks:[]};
      state.extras.push(owner);
    }
    if(!owner)owner=model;
    owner.blocks.splice(entry.block?owner.blocks.indexOf(entry.block)+1:owner.blocks.length,0,value);
    selectedKey='b:'+(model.sections?encodeURIComponent(owner.id):'page')+'/'+encodeURIComponent(value.blockId);
  },{reload:false,message:'Bloque añadido · Sin guardar'});
  $('search').value='';setLeftTab(false);pane('right',true);tab='block';load({follow:true});
}
function duplicate(owner,block,copy){
  commit(()=>{
    owner.blocks.splice(owner.blocks.indexOf(block)+1,0,copy);
    selectedKey='b:'+(page().sections?encodeURIComponent(owner.id):'page')+'/'+encodeURIComponent(copy.blockId);
  },{reload:false,message:'Bloque duplicado · Sin guardar'});
  load({follow:true});
}
function remove(owner,block){
  commit(()=>{
    owner.blocks.splice(owner.blocks.indexOf(block),1);
    if(page().sections&&!owner.blocks.length&&!owner.titulo){
      draft.extras=draft.extras.filter(extra=>extra!==owner);
    }
    selectedKey='';
  },{message:'Bloque quitado · Sin guardar'});
}

function changeRow(collection,id,duplicate){
  const list=draft.template.collections[collection.id]??collection.items.map(i=>({id:i.id,source:i.id,values:{}}));
  const index=list.findIndex(row=>row.id===id);
  if(index<0)return;
  commit(state=>{
    const rows=state.template.collections[collection.id]??=list;
    if(duplicate){
      const copy={...structuredClone(rows[index]),id:idNuevo()};
      copy.source??=id;
      rows.splice(index+1,0,copy);
      selectedKey='r:'+encodeURIComponent(collection.id)+'/'+encodeURIComponent(copy.id);
    }else{
      rows.splice(index,1);selectedKey='';
    }
  },{message:duplicate?'Elemento duplicado · Sin guardar':'Elemento quitado · Sin guardar'});
}

const inspector=studioInspector(inspectorHost,{
  state:()=>draft,page,commit,report,choose,confirm:modal,updateButtons:buttons,
  refresh:()=>{displayedRevision=revision;drawTree();canvas.draw();},
  siblings:node=>canvas.siblings(node),step,choosing:()=>choosing,target,
  startMove,cancelMove:()=>cancelMove(),finishMove:side=>move(selection(),target(),side),duplicate,remove,changeRow
});

const canvas=canvasUI({
  frame,paper:$('paper'),selection:$('selection'),grip:$('grip'),gripCaption:$('grip-caption'),drop:$('drop'),dragLabel:$('drag-label'),tree,preview:()=>preview
},{
  nodes:()=>nodes,ready:()=>mounted&&!busy&&!preview,choosing:()=>choosing,label:labelOf,
  select:(node)=>{selectedKey=layoutKey(node);showPath(node);},move,step,report,
  onSelect,onText:editInline,key:keyboard,openInspector:()=>pane('right',true)
});

function finishInline(accept){
  if(!inline)return;
  const {span,original,write}=inline;inline=null;
  const value=span.innerText.trim();span.replaceWith(original);
  if(accept&&value!==original.data.trim()){
    const next=original.data.match(/^\s*/)[0]+value+original.data.match(/\s*$/)[0];
    commit(()=>{write(value,next);original.data=next;},{reload:false,message:'Texto actualizado · Sin guardar'});
    displayedRevision=revision;drawTree(true);inspector.render(selection(),tab);
  }
  canvas.draw();buttons();
}
function editInline(node,hit,event){
  if(busy||!mounted||!inspector.flush())return;
  if(revision!==displayedRevision){load();return;}
  finishInline(true);
  const binding=visualText(page(),()=>draft)(hit,node,textAtPoint(event));
  if(!binding){onSelect(node);pane('right',true);return;}
  const original=binding.part,doc=original.ownerDocument,span=doc.createElement('span');
  span.contentEditable='plaintext-only';span.dataset.studioWriting='';span.setAttribute('role','textbox');span.setAttribute('aria-label','Editar texto del bloque');
  span.style.outline='2px solid #149064';span.textContent=original.data;
  inline={span,original,write:binding.write};original.replaceWith(span);
  const range=doc.createRange();range.selectNodeContents(span);
  span.focus({preventScroll:true});const selected=doc.getSelection();selected.removeAllRanges();selected.addRange(range);
  span.oninput=buttons;span.onblur=()=>finishInline(true);
  span.onkeydown=e=>{
    if(!e.isComposing&&(e.key==='Escape'||e.key==='Enter'&&!e.shiftKey)){
      e.stopPropagation();e.preventDefault();finishInline(e.key!=='Escape');
    }
  };
}

let displayedRevision=-1;
function load({reset=false,follow:scrollToSelection=false}={}){
  if(!page())return;
  if(mounted&&!reset)scroll={left:frame.contentWindow.scrollX,top:frame.contentWindow.scrollY};
  if(reset)scroll={left:0,top:0};
  follow=scrollToSelection;mounted=false;canvas.cancel();canvas.select(null);buttons();
  inspectorHost.inert=true;
  const url=new URL(paginaURL(page()),location.href);
  nonce=idNuevo();url.searchParams.set('borrador',nonce);url.searchParams.set('estudio','1');
  loading.textContent='Cargando la página…';loading.hidden=false;
  clearTimeout(timer);timer=setTimeout(()=>{
    const panel=el('div');panel.append(el('p','La página no terminó de cargar.'),button('Reintentar',()=>load()));
    loading.replaceChildren(panel);report('Reintenta cargar el lienzo.',true);
  },12000);
  frame.src=url.href;
}
window.addEventListener('message',e=>{
  if(e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.nonce!==nonce)return;
  if(e.data.type==='xebax-preview-ready'){
    frame.contentWindow.postMessage({type:'xebax-preview-data',nonce,content:draft},location.origin);
  }else if(e.data.type==='xebax-preview-mounted'){
    clearTimeout(timer);nodes=canvas.attach(frame.contentDocument);mounted=true;displayedRevision=revision;
    loading.hidden=true;frame.contentWindow.scrollTo({...scroll,behavior:'instant'});
    drawTree(true);canvas.select(selection(),follow);inspector.render(selection(),tab);inspectorHost.inert=false;showPath(selection());
    buttons();
  }
});

async function saveToServer(publishing){
  if(busy||conflict||!draft||document.querySelector('dialog[open]'))return;
  finishInline(true);
  if(!inspector.flush())return;
  if(!publishing&&revision===saved)return;
  const payload=structuredClone(draft),current=page(),publicDoc=publishing?mergePage(live,draft,current):null;
  if(publishing){try{validatePublish(publicDoc);}catch(error){report(error.message,true);return;}}
  if(publishing&&!await modal('Publicar '+pageTitle(current),'Los visitantes verán los cambios guardados en esta página.','Publicar cambios'))return;
  busy=true;canvas.cancel();buttons();report(publishing?'Publicando…':'Guardando…');
  const savedAt=revision;
  try{
    const path=publishing?'xebax_publish_page':'xebax_save_site';
    const body=publishing?{draft_content:payload,live_content:publicDoc,expected_version:version}:{payload,publish_now:false,expected_version:version};
    const next=await request('/rest/v1/rpc/'+path,{method:'POST',token:await currentToken(),body});
    version=Number(next);saved=savedAt;
    if(publishing){live=publicDoc;updatePages();}
    report(publishing?'Página publicada':'Borrador guardado');
    if(displayedRevision!==revision)load();
  }catch(error){
    conflict=error.code==='40001';
    report(conflict?'Otra sesión guardó una versión nueva. Conserva esta pestaña y vuelve a abrir el borrador para compararlo.':error.message,true);
  }finally{busy=false;buttons();}
}

function switchPage(id){
  finishInline(true);
  if(!inspector.flush()){pageMenu.value=pageId;return;}
  cancelMove(false);if(id===pageId)return;
  pageId=id;selectedKey='';$('search').value='';
  replacePageURL();
  updatePages();load({reset:true});report(dirty()?'Cambios sin guardar':'Sin cambios pendientes');
}
function replacePageURL(){
  const url=new URL(location.href);url.searchParams.set('page',pageId);url.searchParams.delete('p');
  window.history.replaceState(null,'',url);
}
function keyboard(e){
  if(document.querySelector('dialog[open]'))return;
  const tag=e.target?.localName;
  if(e.key==='Escape'&&choosing){e.preventDefault();cancelMove();return;}
  if(!(e.ctrlKey||e.metaKey))return;
  const key=e.key.toLowerCase();
  if(key==='s'){e.preventDefault();saveToServer(false);}
  if(!inline&&!['input','textarea','select'].includes(tag)&&['z','y'].includes(key)){
    e.preventDefault();history(key==='z'&&!e.shiftKey);
  }
}

$('layers-tab').onclick=()=>setLeftTab(false);
$('add-tab').onclick=()=>setLeftTab(true);
$('block-tab').onclick=()=>setTab('block');
$('page-tab').onclick=()=>setTab('page');
for(const side of ['left','right']){
  $('open-'+side).onclick=()=>pane(side,!$(side).hasAttribute('data-open'));
  $('close-'+side).onclick=()=>pane(side,false);
}
$('search').oninput=()=>{if(mounted)drawTree();};
for(const control of document.querySelectorAll('.devices button'))control.onclick=()=>{
  $('canvas').dataset.screen=control.dataset.screen;canvas.fit();
  for(const sibling of control.parentElement.children)sibling.setAttribute('aria-pressed',String(sibling===control));
};
if(matchMedia('(max-width:760px)').matches)document.querySelector('.devices button[data-screen="phone"]')?.click();
const newSection=button('Sección',insertSection,'block-option');newSection.id='add-section';$('insert').append(newSection);
for(const [type,[label]] of Object.entries(blockTypes))$('insert').append(button(label,()=>insertBlock(type),'block-option'));
save.onclick=()=>saveToServer(false);
publish.onclick=()=>saveToServer(true);
$('undo').onclick=()=>history(true);$('redo').onclick=()=>history(false);
$('preview').onclick=()=>{
  finishInline(true);if(!inspector.flush())return;
  cancelMove(false);preview=!preview;
  workspace.toggleAttribute('data-preview',preview);$('preview').setAttribute('aria-pressed',String(preview));
  $('preview').textContent=preview?'Volver a editar':'Vista previa';
  if(displayedRevision!==revision)load();
  else{frame.contentDocument.documentElement.classList.toggle('xebax-edit',!preview);canvas.draw();}
};
pageMenu.onchange=()=>{
  if(pageMenu.value!=='__new__'){switchPage(pageMenu.value);return;}
  pageMenu.value=pageId;
  const title=el('input');title.placeholder='Título de la página';title.setAttribute('aria-label','Título de la página nueva');title.required=true;
  const form=el('form');const create=el('button','Crear');create.type='submit';
  form.append(title,create,button('Cancelar',()=>{form.remove();setLeftTab(false);}));
  $('insert').querySelector('form')?.remove();$('insert').prepend(form);setLeftTab(true);pane('left',true);title.focus();
  form.onsubmit=e=>{
    e.preventDefault();if(!title.value.trim()||!inspector.flush())return;
    let created;
    commit(state=>{created=createPage(state,title.value.trim(),live.pages);},{reload:false,message:'Página creada · Sin guardar'});
    form.remove();setLeftTab(false);switchPage(created.id);
  };
};
window.addEventListener('keydown',keyboard);
window.addEventListener('beforeunload',e=>{if(draft&&dirty()){e.preventDefault();e.returnValue='';}});

async function start(){
  if(!editorSession()){location.replace('../resenas/admin.html');return;}
  try{
    const [rows,data]=await Promise.all([openDraft(),fetch('./plantilla.json').then(res=>{
      if(!res.ok)throw Error('No se pudo abrir el catálogo de páginas.');return res.json();
    })]);
    catalog=data;draft=createState(rows.draft.content);live=createState(rows.live.content);version=Number(rows.draft.version);
    const requested=params.get('page'),slug=params.get('p');
    const resolved=catalog.pages.find(p=>p.id===requested)||draft.pages.find(p=>p.id===requested)||draft.pages.find(p=>slug&&p.slug===slug);
    if((slug||requested&&requested!=='pagina')&&!resolved)throw Error('Esta página no existe en el borrador.');
    pageId=resolved?.id||'inicio';
    updatePages();
    $('block-tab').setAttribute('aria-pressed',String(tab==='block'));$('page-tab').setAttribute('aria-pressed',String(tab==='page'));
    load({reset:true});report('Borrador abierto');
  }catch(error){loading.textContent=error.message;report(error.message,true);}
}
start();
