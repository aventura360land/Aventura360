import {pageAfterLogin} from '../cms/acceso-visual.js';
import {hasSession,beginSession,clearSession,currentToken,setEditor} from './sesion.js';
import {configured,request,listReviews,moderate,element,reviewCard,accountEmail} from './api.js';
import {createEditor,confirmar} from '../cms/editor.js';
const byId=id=>document.getElementById(id);
const login=byId('login'),dashboard=byId('dashboard'),filter=byId('filter'),more=byId('more'),list=byId('list');
let next=null,revision=0;
const editor=createEditor({token:currentToken,report:msg=>{byId('notice').textContent=msg;},openReviews:()=>load()});
function reset(){
  editor.stop();clearSession();revision++;next=null;dashboard.hidden=true;login.hidden=false;
  filter.value='pending';list.replaceChildren();login.reset();byId('profile-username').textContent='';
}
function report(error){
  if(error.status===401){byId('notice').textContent='Tu sesión caducó. Copia cualquier edición pendiente y vuelve a iniciar sesión.';}
  else byId('notice').textContent=error.message;
}
function action(row,to,label){
  const button=element('button',label,to==='hidden'?'xr-alt':undefined);
  button.onclick=async()=>{
    button.disabled=true;
    try{await moderate(row.id,row.status,to,await currentToken());if(await load())byId('notice').textContent=to==='published'?'Reseña publicada.':'Reseña oculta.';}
    catch(e){report(e);}finally{button.disabled=false;}
  };
  return button;
}
async function load(append=false){
  const seq=++revision;
  byId('notice').textContent='';more.disabled=true;
  if(!append){list.replaceChildren();next=null;more.hidden=true;}
  try{
    const page=await listReviews(filter.value,next,await currentToken());
    if(seq!==revision)return false;
    for(const row of page.items){
      const article=reviewCard(row),controls=element('div',undefined,'xr-tools');
      if(row.status!=='published')controls.append(action(row,'published','Publicar'));
      if(row.status!=='hidden')controls.append(action(row,'hidden','Ocultar'));
      article.append(controls);list.append(article);
    }
    if(!append&&!page.items.length)list.append(element('p','No hay reseñas en esta lista.'));
    next=page.next;more.hidden=!next;return true;
  }catch(e){if(seq===revision)report(e);return false;}
  finally{if(seq===revision)more.disabled=false;}
}
async function enter(){
  const token=await currentToken();
  const profiles=await request('/rest/v1/xebax_moderators?select=username&limit=1',{token});
  if(!profiles.length){clearSession();throw Error('Esta cuenta no está autorizada para moderar reseñas.');}
  byId('profile-username').textContent=profiles[0].username;
  login.hidden=true;dashboard.hidden=false;byId('notice').textContent='';
  try{
    const access=await request('/rest/v1/xebax_site_editors?select=user_id&limit=1',{token});
    setEditor(!!access.length);
    if(access.length){
      const destination=pageAfterLogin(new URLSearchParams(location.search));
      if(destination){location.replace(destination);return;}
      await editor.start();
      const siteLink=document.querySelector('.mast a:last-child');siteLink.target='_self';
    }else{
      editor.showReviews();
      if(new URLSearchParams(location.search).has('editarPagina'))byId('notice').textContent='Esta cuenta solo tiene acceso a la moderación de reseñas.';
    }
  }catch(error){
    editor.showReviews();byId('notice').textContent='El editor de contenido no pudo cargarse. Vuelve a entrar para reintentar.';
  }
}
login.onsubmit=async e=>{
  e.preventDefault();const button=login.querySelector('button');button.disabled=true;
  byId('notice').textContent='Verificando acceso…';
  try{
    const email=accountEmail(byId('username').value);
    const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:byId('password').value}});
    byId('password').value='';
    beginSession(session);await enter();

  }catch(e){byId('notice').textContent=e.status===400||e.status===401?'Revisa el nombre de usuario y la contraseña.':e.message;}
  finally{button.disabled=false;}
};
byId('logout').onclick=async()=>{
  if(editor.isSaving())return;
  if(editor.hasChanges()&&!await confirmar('Cerrar sesión','Hay cambios sin guardar. Si sales ahora se perderán.','Salir'))return;
  const previous=await currentToken().catch(()=>null);reset();byId('notice').textContent='Sesión cerrada.';
  try{if(previous)await request('/auth/v1/logout?scope=local',{method:'POST',token:previous});}catch{}
};
filter.onchange=()=>load();more.onclick=()=>load(true);byId('refresh').onclick=()=>load();
if(!configured){login.hidden=true;byId('notice').textContent='Configura la URL y la clave pública de Xebax en resenas/config.js para activar el panel.';}

else if(hasSession()){
  login.hidden=true;
  enter().catch(error=>{reset();report(error);});
}
window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
