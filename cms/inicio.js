import {projectUrl,publishableKey} from '../resenas/config.js';
import {applyTemplate} from './plantilla.js';
import {renderSite} from './bloques.js';
import {applyAppearance} from './apariencia.js';
import {createState,reviewCopy} from './modelo.js';

const name=location.pathname.split('/').pop();
const pageId=({'privacidad.html':'privacidad','terminos.html':'terminos','pagina.html':'pagina'})[name]||'inicio';
const nonce=new URLSearchParams(location.search).get('borrador');
const preview=Boolean(nonce&&window.parent!==window);
const cacheKey='xebax-publicado-v1-'+new URL(projectUrl).hostname;
async function localFile(name){
  const res=await fetch(new URL(name,import.meta.url));if(!res.ok)throw new Error(name);
  return res.json();
}
async function readPublic(){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),3500);
  try{
    const result=await fetch(projectUrl+'/rest/v1/xebax_cms?slot=eq.live&select=version,content',{headers:{apikey:publishableKey},cache:'no-store',signal:controller.signal});
    if(!result.ok)throw Error('contenido');
    const [row]=await result.json();if(!row)throw Error('contenido');
    try{localStorage.setItem(cacheKey,JSON.stringify(row.content));}catch{}
    return row.content;
  }catch{
    try{return JSON.parse(localStorage.getItem(cacheKey)||'{}');}catch{return {};}
  }finally{clearTimeout(timeout);}
}
function privatePreview(){
  return new Promise(resolve=>{
    const timer=setTimeout(()=>{window.removeEventListener('message',receive);resolve({});},8000);
    function receive(e){
      if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='xebax-preview-data'||e.data.nonce!==nonce)return;
      clearTimeout(timer);window.removeEventListener('message',receive);resolve(e.data.content);
    }
    window.addEventListener('message',receive);
    parent.postMessage({type:'xebax-preview-ready',nonce},location.origin);
  });
}
async function start(){
  const [catalog,dynamic,raw]=await Promise.all([localFile('plantilla.json'),localFile('dinamico.json'),preview?privatePreview():readPublic()]);
  if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
  const state=createState(raw||{});
  window.xebaxDynamic=state.dynamic||dynamic;
  window.xebaxReviewCopy={...reviewCopy,...state.reviews};
  if(pageId!=='pagina')applyTemplate(document,catalog,state.template,pageId);
  applyAppearance(document,state.appearance||{});renderSite(state,pageId,preview);
  if(preview){
    let inspect=false;
    const setMode=e=>{
      if(e.origin===location.origin&&e.source===parent&&e.data?.type==='xebax-preview-mode'&&e.data.nonce===nonce){inspect=Boolean(e.data.enabled);document.documentElement.classList.toggle('xc-inspect',inspect);}
    };
    window.addEventListener('message',setMode);
    parent.postMessage({type:'xebax-preview-mounted',nonce},location.origin);
    document.addEventListener('click',e=>{
      if(!inspect)return;
      e.preventDefault();e.stopImmediatePropagation();
      const hit=e.target.closest('[data-x-node]')||e.target.closest('[data-x-section]');
      const sect=e.target.closest('[data-x-section]'),row=e.target.closest('[data-x-item]'),coll=e.target.closest('[data-x-collection]');
      const extra=e.target.closest('.xc-section');
      parent.postMessage({type:'xebax-preview-edit',nonce,pageId,node:hit?.dataset.xNode,section:sect?.dataset.xSection,collection:coll?.dataset.xCollection,item:row?.dataset.xItem,custom:!!extra||pageId==='pagina'},location.origin);
    },true);
    window.addEventListener('submit',e=>e.preventDefault(),true);
    document.addEventListener('click',e=>{
      const a=e.target.closest('a');if(a&&!a.getAttribute('href')?.startsWith('#'))e.preventDefault();
    },true);
  }
}
export const ready=start().catch(error=>console.warn('No se pudo aplicar el contenido de Xebax.',error.message));
