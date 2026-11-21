import {request} from '../resenas/api.js';
import {currentToken,editorSession} from '../resenas/sesion.js';

const files={inicio:'index.html',privacidad:'privacidad.html',terminos:'terminos.html',pagina:'pagina.html'};
export function loginForPage(id,slug){
  const url=new URL('../resenas/admin.html',import.meta.url);
  url.searchParams.set('editarPagina',id);
  if(id==='pagina'&&slug)url.searchParams.set('p',slug);
  return url;
}
export function pageAfterLogin(params){
  const id=params.get('editarPagina'),slug=params.get('p');
  if(!Object.hasOwn(files,id)||(id==='pagina'&&!slug))return null;
  const url=new URL('../'+files[id],import.meta.url);
  if(id==='pagina')url.searchParams.set('p',slug);
  url.searchParams.set('editar','1');
  return url;
}
export async function openDraft(){
  if(!editorSession())return null;
  const rows=await request('/rest/v1/xebax_cms?select=slot,content,version',{token:await currentToken()});
  const draft=rows.find(r=>r.slot==='draft'),live=rows.find(r=>r.slot==='live');
  if(!draft||!live)throw Error('Esta cuenta no tiene acceso al borrador.');
  return {draft,live};
}
export async function editLink(error=''){
  if(!error){
    try{
      const access=await request('/rest/v1/xebax_site_editors?select=user_id&limit=1',{token:await currentToken()});
      if(!access.length)return;
    }catch{return;}
  }
  const host=document.createElement('div'),shadow=host.attachShadow({mode:'open'}),link=document.createElement('a');
  const url=new URL(location.href);url.searchParams.set('editar','1');
  link.href=error?new URL('../resenas/admin.html',import.meta.url):url;link.textContent=error?'No se abrió el borrador · Ir al panel':'✎  Editar página';
  link.style.cssText='position:fixed;bottom:16px;left:16px;z-index:2147483500;background:#172b28;color:#fff;padding:10px 16px;border-radius:6px;font:600 14px/1.4 system-ui;text-decoration:none;box-shadow:0 2px 10px #0003';
  shadow.append(link);document.body.append(host);
}
