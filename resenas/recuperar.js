import {configured,request,accountEmail} from './api.js';

const byId=id=>document.getElementById(id);
const ask=byId('request-form'), change=byId('new-form'), message=byId('message');
const storageKey='xebax-recuperacion-pkce-v1';
const callback=new URL('./recuperar.html',location.href);
const params=new URLSearchParams(location.search);
const code=params.get('code');
const failed=params.has('error') || new URLSearchParams(location.hash.slice(1)).has('error');
if(location.search || location.hash) history.replaceState(null,'',callback.pathname);
let accessToken='';

function base64url(bytes){
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function previousVerifier(){
  try{
    const item=JSON.parse(localStorage.getItem(storageKey));
    return item && Date.now()<item.expires && /^[A-Za-z0-9_-]{43}$/.test(item.value) ? item.value : '';
  }catch{return '';}
}
function showRequest(text){
  change.hidden=true;ask.hidden=false;message.textContent=text;
}
ask.onsubmit=async event=>{
  event.preventDefault();
  const button=ask.querySelector('button');button.disabled=true;
  try{
    const email=accountEmail(byId('username').value);
    const verifier=previousVerifier() || base64url(crypto.getRandomValues(new Uint8Array(32)));
    localStorage.setItem(storageKey,JSON.stringify({value:verifier,expires:Date.now()+3600000}));
    const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    await request('/auth/v1/recover?redirect_to='+encodeURIComponent(callback.href),{method:'POST',
      body:{email,code_challenge:challenge,code_challenge_method:'s256'}});
    message.textContent='Si la cuenta existe, recibirás un enlace en su correo. Revisa también la carpeta de spam.';
  }catch(e){
    message.textContent=e.name==='SecurityError'?'Habilita el almacenamiento del navegador y vuelve a intentarlo.':e.message;
  }finally{button.disabled=false;}
};
change.onsubmit=async event=>{
  event.preventDefault();
  if(!accessToken)return;
  if(byId('password').value!==byId('confirm').value){message.textContent='Las contraseñas deben coincidir.';return;}
  const button=change.querySelector('button');button.disabled=true;
  try{
    await request('/auth/v1/user',{method:'PUT',token:accessToken,body:{password:byId('password').value}});
    const usedToken=accessToken;accessToken='';change.reset();change.hidden=true;
    byId('done').hidden=false;message.textContent='Tu contraseña se actualizó. Ya puedes iniciar sesión.';
    try{await request('/auth/v1/logout?scope=local',{method:'POST',token:usedToken});}catch{}
  }catch(e){
    if(e.status===401||e.status===403){accessToken='';change.reset();showRequest('El enlace caducó. Solicita uno nuevo.');}
    else message.textContent=e.status===422?'Elige otra contraseña que cumpla las reglas de tu cuenta.':e.message;
  }finally{button.disabled=false;}
};
async function start(){
  if(!configured){message.textContent='La recuperación estará disponible cuando se conecte la base de Xebax.';return;}
  if(failed){showRequest('El enlace caducó o ya se utilizó. Solicita otro.');return;}
  if(!code){showRequest('');return;}
  const verifier=previousVerifier();
  if(!verifier){showRequest('Solicita un nuevo enlace desde este navegador y ábrelo aquí.');return;}
  message.textContent='Verificando el enlace…';
  try{
    const session=await request('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:verifier}});
    if(!session?.access_token)throw new Error('Enlace inválido');
    localStorage.removeItem(storageKey);
    accessToken=session.access_token;change.hidden=false;message.textContent='Elige tu nueva contraseña.';byId('password').focus();
  }catch{showRequest('No se pudo verificar el enlace. Solicita uno nuevo y ábrelo aquí.');}
}
start();
