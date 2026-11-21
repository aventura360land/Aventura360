import {projectUrl,publishableKey,adminUsername,adminMailDomain} from './config.js';

export function accountEmail(input) {
  const account = input.trim().toLowerCase();
  if (account === adminUsername) return adminUsername + '@' + adminMailDomain;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return account;
  throw new Error('Revisa tu nombre de usuario.');
}

const root = projectUrl.trim().replace(/\/$/,'');
export const configured = /^https:\/\//.test(root) && publishableKey.startsWith('sb_publishable_');
const fields = 'id,name,stars,comment,created_at,status';
export class ApiError extends Error {
  constructor(message,status,code) {super(message);this.status=status;this.code=code;}
}
export async function request(path,{method='GET',body,token,prefer}={}) {
  if (!configured) throw new Error('Falta conectar el proyecto de reseñas de Xebax.');
  const headers={apikey:publishableKey};
  if(token) headers.Authorization='Bearer '+token;
  if(body!==undefined) headers['Content-Type']='application/json';
  if(prefer) headers.Prefer=prefer;
  let response;
  try { response=await fetch(root+path,{method,headers,cache:'no-store',body:body===undefined?undefined:JSON.stringify(body)}); }
  catch {throw new Error('No pudimos conectar. Verifica tu conexión e intenta de nuevo.');}
  const text=await response.text();
  let data=null;
  if(text) { try {data=JSON.parse(text);} catch {throw new Error('El servicio de reseñas no está disponible.');} }
  if(!response.ok) throw new ApiError(response.status===429?'Has hecho varios intentos. Espera un momento.':'No se pudo completar la solicitud.',response.status,data?.code);
  return data;
}
export async function listReviews(status,before,token) {
  const query=new URLSearchParams({select:fields,status:'eq.'+status,order:'id.desc',limit:'7'});
  if(before) query.set('id','lt.'+before);
  const rows=await request('/rest/v1/xebax_reviews?'+query,{token});
  const items=rows.slice(0,6);
  return {items,next:rows.length>6?items.at(-1).id:null};
}
export async function submitReview(review) {
  try {
    await request('/rest/v1/xebax_reviews',{method:'POST',body:review,prefer:'return=minimal'});
  } catch(e) {
    // Un reintento conserva el UUID. La restricción UNIQUE impide un segundo registro.
    if(e.status!==409 || e.code!=='23505') throw e;
  }
}
export async function moderate(id,from,status,token) {
  const query=new URLSearchParams({id:'eq.'+id,status:'eq.'+from,select:'id'});
  const rows=await request('/rest/v1/xebax_reviews?'+query,{method:'PATCH',body:{status},token,prefer:'return=representation'});
  if(rows.length!==1) throw new Error('La reseña cambió. Actualiza la lista.');
}
export function element(tag,text,cls) {
  const el=document.createElement(tag);
  if(text!==undefined) el.textContent=text;
  if(cls) el.className=cls;
  return el;
}
export function reviewCard(review) {
  const article=element('article',undefined,'xr-review');
  const stars=element('span','★'.repeat(review.stars)+'☆'.repeat(5-review.stars),'xr-rating');
  stars.setAttribute('role','img');stars.setAttribute('aria-label',review.stars+' de 5 estrellas');
  const date=element('time',new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeZone:'America/Bogota'}).format(new Date(review.created_at)));
  date.dateTime=review.created_at;
  const meta=element('div',undefined,'xr-meta');meta.append(stars,date);
  article.append(meta,element('h4',review.name),element('p',review.comment));return article;
}
