// La sesión acompaña a la navegación en esta pestaña. No se incluye en enlaces.
import {request} from './api.js';
import {projectUrl} from './config.js';

const key='xebax-admin-tab-'+new URL(projectUrl).hostname;
let session=null,pending=null;
try{session=JSON.parse(sessionStorage.getItem(key));}catch{}
function persist(){
  try{if(session)sessionStorage.setItem(key,JSON.stringify(session));else sessionStorage.removeItem(key);}catch{}
}
export function hasSession(){return Boolean(session?.access&&session?.refresh);}
export function editorSession(){return hasSession()&&session.editor===true;}
export function setEditor(value){if(session){session.editor=value;persist();}}
export function beginSession(data,editor=false){
  session={access:data.access_token,refresh:data.refresh_token,until:Date.now()+Number(data.expires_in||3600)*1000,editor};persist();
}
export function clearSession(){session=null;pending=null;persist();}
export async function currentToken(){
  if(!hasSession())throw Error('Inicia sesión en el panel para continuar.');
  if(Date.now()<session.until-90000)return session.access;
  if(!pending){
    const previous=session;
    const task=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:previous.refresh}}).then(data=>{
      if(session!==previous)throw Error('La sesión ha cambiado.');
      beginSession(data,previous.editor);return session.access;
    }).catch(error=>{if(session===previous&&[400,401].includes(error.status))clearSession();throw error;})
      .finally(()=>{if(pending===task)pending=null;});
    pending=task;
  }
  return pending;
}
