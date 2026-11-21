import {configured,request,listReviews,moderate,element,reviewCard,accountEmail} from './api.js';
import {createEditor,confirmar} from '../cms/editor.js';
const byId=id=>document.getElementById(id);
const login=byId('login'),dashboard=byId('dashboard'),filter=byId('filter'),more=byId('more'),list=byId('list');
let token=null,refreshToken='',expires=0,refreshing=null,authEpoch=0,next=null,revision=0;
function storeSession(session){
  token=session.access_token;refreshToken=session.refresh_token;expires=Date.now()+Number(session.expires_in||3600)*1000;
}
async function currentToken(){
  if(!token)throw new Error('Inicia sesión para continuar.');
  if(Date.now()<expires-90000)return token;
  if(!refreshing){
    const epoch=authEpoch;
    refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:refreshToken}}).then(s=>{
      if(epoch!==authEpoch)throw new Error('La sesión ha cambiado.');
      storeSession(s);return token;
    }).finally(()=>{if(epoch===authEpoch)refreshing=null;});
  }
  return refreshing;
}
const editor=createEditor({token:currentToken,report:msg=>{byId('notice').textContent=msg;},openReviews:()=>load()});
function reset(){
  editor.stop();authEpoch++;refreshToken='';expires=0;refreshing=null;revision++;token=null;next=null;dashboard.hidden=true;login.hidden=false;
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
login.onsubmit=async e=>{
  e.preventDefault();const button=login.querySelector('button');button.disabled=true;
  byId('notice').textContent='Verificando acceso…';
  try{
    const email=accountEmail(byId('username').value);
    const session=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:byId('password').value}});
    byId('password').value='';
    const profiles=await request('/rest/v1/xebax_moderators?select=username&limit=1',{token:session.access_token});
    if(!profiles.length)throw new Error('Esta cuenta no está autorizada para moderar reseñas.');
    byId('profile-username').textContent=profiles[0].username;
    authEpoch++;storeSession(session);login.hidden=true;dashboard.hidden=false;byId('notice').textContent='';
    try{
      const access=await request('/rest/v1/xebax_site_editors?select=user_id&limit=1',{token});
      if(access.length)await editor.start();else editor.showReviews();
    }catch(error){
      editor.showReviews();byId('notice').textContent='El editor de contenido no pudo cargarse. Vuelve a entrar para reintentar.';
    }
  }catch(e){byId('notice').textContent=e.status===400||e.status===401?'Revisa el nombre de usuario y la contraseña.':e.message;}
  finally{button.disabled=false;}
};
byId('logout').onclick=async()=>{
  if(editor.isSaving())return;
  if(editor.hasChanges()&&!await confirmar('Cerrar sesión','Hay cambios sin guardar. Si sales ahora se perderán.','Salir'))return;
  const previous=token;reset();byId('notice').textContent='Sesión cerrada.';
  try{await request('/auth/v1/logout?scope=local',{method:'POST',token:previous});}catch{}
};
filter.onchange=()=>load();more.onclick=()=>load(true);byId('refresh').onclick=()=>load();
if(!configured){login.hidden=true;byId('notice').textContent='Configura la URL y la clave pública de Xebax en resenas/config.js para activar el panel.';}
