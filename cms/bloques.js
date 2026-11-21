import {hrefSeguro,themeFields} from './modelo.js';
import {formattedText} from './formato.js';
function paragraph(text){const p=document.createElement('p');p.append(formattedText(text));return p;}
function node(tag,txt,cls){
  const el=document.createElement(tag);
  if(txt)el.textContent=txt;
  if(cls)el.className=cls;
  return el;
}
function media(tag,src,alt){
  const url=hrefSeguro(src,true);if(!url)return null;
  const el=node(tag);el.src=url;
  if(tag==='img'){el.alt=alt||'';el.loading='lazy';}else{el.controls=true;el.preload='metadata';el.playsInline=true;}
  return el;
}
function add(parent,...els){parent.append(...els.filter(Boolean));}
function link(text,url){
  const dest=hrefSeguro(url);if(!dest||!text)return null;
  const a=node('a',text,'xc-button');a.href=dest;return a;
}
function list(values){
  const ul=node('ul');for(const v of values||[])if(typeof v==='string'&&v.trim())ul.append(node('li',v));return ul.childElementCount?ul:null;
}
function block(b){
  const box=node('div',null,'xc-block');
  switch(b.type){
    case 'texto': if(b.titulo)box.append(node('h3',b.titulo));if(b.texto)box.append(paragraph(b.texto));break;
    case 'imagen':case 'video':{
      const fig=node('figure'),el=media(b.type==='imagen'?'img':'video',b.src,b.alt);if(!el)break;
      if(b.type==='video'&&hrefSeguro(b.poster,true))el.poster=b.poster;
      add(fig,el,b.pie&&node('figcaption',b.pie));box.append(fig);break;
    }
    case 'galeria':{const grid=node('div',null,'xc-gallery');for(const f of b.fotos||[])add(grid,media('img',f.src,f.alt));box.append(grid);break;}
    case 'lista':add(box,b.titulo&&node('h3',b.titulo),list(b.elementos));break;
    case 'boton':add(box,link(b.etiqueta,b.enlace));break;
    case 'paquete':{
      const card=node('article',null,'xc-package');
      add(card,media('img',b.imagen,b.alt));const detail=node('div');
      add(detail,b.titulo&&node('h3',b.titulo),b.precio&&node('strong',b.precio),b.duracion&&node('p',b.duracion),b.descripcion&&paragraph(b.descripcion),list(b.incluye),link(b.etiqueta,b.enlace));
      card.append(detail);box.append(card);break;
    }
  }
  return box;
}
export function renderSite(state,pageId,draft=false){
  for(const k of Object.keys(themeFields)){
    const color=state.theme[k];if(/^#[0-9a-f]{6}$/i.test(color))document.documentElement.style.setProperty('--'+k,color);
  }
  const menu=document.querySelector('#navLinks, [data-cms-menu]');
  const homeLink=pageId==='inicio'?'':'./';
  for(const x of state.extras)if(x.visible){const path=(!x.pagina||x.pagina==='inicio')?'index.html':x.pagina+'.html';if(menu&&x.menu&&x.titulo){const a=node('a',x.titulo);a.href=(pageId===(x.pagina||'inicio')?'':'./'+path)+'#seccion-'+encodeURIComponent(x.id);menu.append(a);}}
  const addToMenu=(p,href)=>{if(menu&&p.menu&&p.titulo){const a=node('a',p.titulo);a.href=href;menu.append(a);}};
  if(pageId!=='pagina'){
    const main=document.querySelector('main'),anchorMap=new Map();
    for(const x of state.extras){
      if(!x.visible||(x.pagina||'inicio')!==pageId)continue;
      const el=node('section',null,'xc-section');el.id='seccion-'+x.id;
      const wrap=node('div',null,'xc-wrap');if(x.titulo)wrap.append(node('h2',x.titulo));
      for(const b of x.blocks||[])wrap.append(block(b));el.append(wrap);
      const after=anchorMap.get(x.after)||Array.from(main?.querySelectorAll('[data-x-section]')||[]).find(v=>v.dataset.xSection===x.after);
      if(after)after.after(el);else main?.append(el);
      anchorMap.set(x.after,el);
    }
    if(pageId==='inicio'&&main)Array.from(main.children).forEach((el,i)=>el.style.order=String(i+1));
  }
  for(const p of state.pages)if(p.visible)addToMenu(p,'./pagina.html?p='+encodeURIComponent(p.slug));
  if(pageId==='pagina'){
    const main=document.querySelector('#page-content'),slug=new URLSearchParams(location.search).get('p');
    const p=state.pages.find(x=>x.slug===slug&&(x.visible||draft));
    main.replaceChildren();
    if(!p){document.title='Página no disponible';main.append(node('h1','Página no disponible'),link('Volver al inicio','./'));return;}
    document.title=p.titulo;document.querySelector('meta[name="description"]').content=p.descripcion||p.titulo;
    main.append(node('h1',p.titulo));if(p.descripcion)main.append(node('p',p.descripcion,'xc-intro'));
    for(const b of p.blocks||[])main.append(block(b));
    const go=document.querySelector('[data-cms-home]');if(go)go.href=homeLink||'./';
  }
}
