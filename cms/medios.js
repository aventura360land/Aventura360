import {projectUrl,publishableKey} from '../resenas/config.js';
import {request} from '../resenas/api.js';
import {el,button,$} from './formularios.js';
const bucket='xebax-media',folder='contenido';
const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif','image/gif':'gif','video/mp4':'mp4','video/webm':'webm'};
function video(url){return /\.(?:mp4|webm)$/i.test(new URL(url,location.href).pathname);}
function assetUrl(url){return /^https?:/i.test(url)?url:new URL('../'+url,import.meta.url).href;}
function remoteUrl(name){return projectUrl+'/storage/v1/object/public/'+bucket+'/'+folder+'/'+encodeURIComponent(name);}
export function mediaLibrary(getToken,report,dialog=null){
  let originals,remote=[];const generations=new WeakMap();
  async function listAll(){
    const files=[];let offset=0;
    do{
      const page=await request('/storage/v1/object/list/'+bucket,{method:'POST',token:await getToken(),body:{prefix:folder,limit:100,offset,sortBy:{column:'created_at',order:'desc'}}});
      files.push(...page.filter(f=>f.id).map(f=>remoteUrl(f.name)));offset+=page.length;if(page.length<100)break;
    }while(true);return files;
  }
  async function mount(host,kind='',pick=null,replace=null){
    const version=(generations.get(host)||0)+1;generations.set(host,version);host.replaceChildren();const tools=el('div',undefined,'section-tools'),filter=el('input'),loader=el('input'),msg=el('p','Cargando archivos…','hint'),grid=el('div',undefined,'card-grid');
    filter.placeholder='Buscar por nombre';filter.setAttribute('aria-label','Buscar archivos');loader.type='file';loader.accept=Object.keys(types).filter(t=>!kind||t.startsWith(kind==='video'?'video/':'image/')).join(',');loader.hidden=true;
    const up=button('Subir archivo',()=>loader.click()),more=button('Mostrar más',()=>{count+=30;draw();});
    tools.append(filter,up,loader);host.append(tools,msg,grid,more);
    let count=30,failed=false;
    function draw(){if(version!==generations.get(host)||!host.isConnected)return;
      const rows=[...remote,...(originals||[])].filter(url=>(!kind||video(url)===(kind==='video'))&&decodeURIComponent(url).toLowerCase().includes(filter.value.toLowerCase()));
      grid.replaceChildren();msg.textContent=(failed?'No se pudieron listar los archivos subidos. ':'')+rows.length+' archivos';
      for(const url of rows.slice(0,count)){
        const card=button('',async()=>{if(pick){pick(url);(dialog||$('media-dialog')).close();}else {const link=el('a');link.href=assetUrl(url);link.target='_blank';link.rel='noopener';link.click();}},'media-card');
        const isVideo=video(url),thumb=el(isVideo?'video':'img');if(isVideo){thumb.preload='none';}else{thumb.loading='lazy';thumb.alt='';}thumb.src=assetUrl(url);card.append(thumb,el('span',decodeURIComponent(url.split('/').pop()).replace(/^[0-9a-f-]{36}-/,'')));if(replace){
          const entry=el('div',undefined,'media-entry');entry.append(card,button('Reemplazar en todo el sitio',()=>replace(isVideo?'video':'image',url)));grid.append(entry);
        }else grid.append(card);
      }more.hidden=rows.length<=count;
    }
    filter.oninput=()=>{count=30;draw();};
    loader.onchange=async()=>{
      const f=loader.files[0];if(!f)return;loader.value='';
      if(!types[f.type]||f.size>52428800||(kind&&f.type.split('/')[0]!== (kind==='image'?'image':'video'))){msg.textContent='Elige un formato permitido de hasta 50 MiB.';return;}
      up.disabled=true;msg.textContent='Subiendo '+f.name+'…';
      try{
        const safe=f.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,70)||'archivo';
        const filename=crypto.randomUUID()+'-'+safe+'.'+types[f.type];
        const res=await fetch(projectUrl+'/storage/v1/object/'+bucket+'/'+folder+'/'+filename,{method:'POST',headers:{apikey:publishableKey,Authorization:'Bearer '+await getToken(),'Content-Type':f.type},body:f});
        if(!res.ok)throw Error('No se pudo subir el archivo. Revisa el tamaño, la conexión y el espacio del proyecto.');
        const url=remoteUrl(filename);remote.unshift(url);if(pick){pick(url);(dialog||$('media-dialog')).close();}else{filter.value='';draw();report('Archivo subido.');}
      }catch(e){msg.textContent=e.message;}finally{up.disabled=false;}
    };
    try{
      if(!originals){const res=await fetch(new URL('./medios.json',import.meta.url));if(!res.ok)throw Error('No se pudo cargar el catálogo de medios.');originals=await res.json();}
      try{remote=await listAll();}catch{failed=true;}draw();
    }catch(e){msg.textContent=e.message;}
  }
  return {mount,choose(kind,fn){$('media-dialog').showModal();mount($('media-dialog-body'),kind,fn);}};
}
