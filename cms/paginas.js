import {createState,slugify,idNuevo} from './modelo.js';
import {el,button,select} from './formularios.js';
export const paginaURL=(page)=>page.sections?'../'+(page.id==='inicio'?'index':page.id)+'.html':'../pagina.html?p='+encodeURIComponent(page.slug);

function copyKey(dst,src,key){if(Object.hasOwn(src,key))dst[key]=structuredClone(src[key]);else delete dst[key];}
export function mergePage(liveRaw,draft,page){
  const live=createState(structuredClone(liveRaw));
  if(!page.sections){
    const idx=live.pages.findIndex(p=>p.id===page.id);
    if(idx<0)live.pages.push(structuredClone(page));else live.pages[idx]=structuredClone(page);
    return live;
  }
  const target=live.template,source=draft.template;
  if(source.layout||target.layout){
    copyKey(target.layout??={},source.layout||{},page.id);
    if(!Object.keys(target.layout).length)delete target.layout;
  }
  copyKey(target.sections,source.sections,page.id);
  for(const s of page.sections){
    for(const f of s.fields)copyKey(target.values,source.values,f.id);
    for(const c of s.collections){
      copyKey(target.collections,source.collections,c.id);
      for(const item of c.items)for(const f of item.fields)copyKey(target.values,source.values,f.id);
    }
  }
  const inPage=x=>(x.pagina||'inicio')===page.id;
  const selected=draft.extras.filter(inPage),ids=new Set(selected.map(x=>x.id));
  live.extras=live.extras.filter(x=>!inPage(x)&&!ids.has(x.id)).concat(structuredClone(selected));
  return live;
}
// PostgreSQL puede devolver las claves JSONB en un orden distinto al del formulario.
function equalContent(a,b){
  const ordered=(key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value;
  return JSON.stringify(a,ordered)===JSON.stringify(b,ordered);
}
export function pageStatus(page,live,draft){
  const actual=live.pages.find(x=>x.id===page.id);
  if(!page.sections&&!actual?.visible)return 'Borrador';
  if(!page.sections)return equalContent(actual,page)?'Publicada':'Cambios pendientes';
  const own=doc=>{
    const projected=mergePage({},doc,page);
    const order=projected.template.sections[page.id];
    if(order&&JSON.stringify(order)===JSON.stringify(page.sections.filter(s=>s.sortable).map(s=>({id:s.id,visible:true}))))delete projected.template.sections[page.id];
    return projected;
  };
  return equalContent(own(live),own(draft))?'Publicada':'Cambios pendientes';
}
export function createPage(state,title,livePages=[]){
  const base=slugify(title)||'pagina';
  const assigned=new Set([...state.pages,...livePages].map(p=>p.slug));
  let slug=base,i=2;while(assigned.has(slug))slug=base+'-'+i++;
  const p={id:idNuevo(),titulo:title,slug,descripcion:'',visible:true,menu:false,blocks:[]};state.pages.push(p);return p;
}
export function pagesList(host,ctx,live,edit,advanced){
  let query='',filter='Todas';const tools=el('div',undefined,'wp-list-tools'),grid=el('div',undefined,'wp-page-table');
  const search=el('input');search.type='search';search.placeholder='Buscar páginas';search.setAttribute('aria-label','Buscar páginas');
  const filterBox=select(['Todas','Publicadas','Borradores','Cambios pendientes'],filter,v=>{filter=v;draw();});filterBox.setAttribute('aria-label','Filtrar por estado');
  const add=button('Añadir página',()=>{creation.hidden=false;title.focus();},'primary');
  const creation=el('form',undefined,'wp-new-page');creation.hidden=true;
  const title=el('input');title.required=true;title.placeholder='Título de la página';title.setAttribute('aria-label',title.placeholder);
  const submit=el('button','Crear y editar','primary');submit.type='submit';
  creation.append(title,submit,button('Cancelar',()=>{creation.hidden=true;title.value='';}));
  creation.onsubmit=e=>{e.preventDefault();if(!title.value.trim())return;const p=createPage(ctx.state,title.value.trim(),live.pages);ctx.changed();edit(p);};
  tools.append(search,filterBox,add);host.append(tools,creation,grid);
  function draw(){
    grid.replaceChildren();
    for(const page of [...ctx.catalog.pages,...ctx.state.pages]){
      const status=pageStatus(page,live,ctx.state),name=page.label||page.titulo||'Sin título';
      if(!name.toLowerCase().includes(query)||!['Todas',({'Borrador':'Borradores','Publicada':'Publicadas'})[status]||status].includes(filter))continue;
      const item=el('div',undefined,'wp-page-row'),text=el('div'),actions=el('div',undefined,'wp-row-actions'),link=button(name,()=>edit(page),'wp-page-title');
      text.append(link,el('small',page.sections?(page.id==='inicio'?'Portada del sitio':'Página legal'):paginaURL(page).slice(3)));
      const action=button('Editar',()=>edit(page));action.setAttribute('aria-label','Editar '+name);
      actions.append(action,button('Ajustes',()=>advanced(page)));const published=page.sections?page:live.pages.find(p=>p.id===page.id&&p.visible);
      if(published){const view=el('a','Ver');view.href=paginaURL(published);view.setAttribute('aria-label','Ver '+name+' en el sitio');actions.append(view);}
      item.append(text,el('span',status,'wp-status'),actions);grid.append(item);
    }if(!grid.childElementCount)grid.append(el('p','No hay páginas que coincidan con la búsqueda.'));
  }
  search.oninput=()=>{query=search.value.trim().toLowerCase();draw();};draw();
}
