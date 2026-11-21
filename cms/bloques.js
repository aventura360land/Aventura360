import {hrefSeguro,themeFields} from './modelo.js';
import {formattedText} from './formato.js';
function field(el,key,owner){
  el.dataset.xField=key;
  if(owner)el.dataset.xOwner=owner.id;
  return el;
}
function paragraph(text,key){const p=field(document.createElement('p'),key);p.append(formattedText(text));return p;}
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
  const a=node('a',text,'xc-button');a.href=dest;return field(a,'etiqueta');
}
function list(values,key){
  const ul=node('ul');
  for(const [i,v] of (values||[]).entries()){
    if(typeof v!=='string'||!v.trim())continue;
    const li=field(node('li',v),key);li.dataset.xIndex=i;ul.append(li);
  }
  return ul.childElementCount?ul:null;
}
function block(b,owner){
  const box=node('div',null,'xc-block');
  box.dataset.xOwner=owner.id;box.dataset.xBlock=b.blockId;
  switch(b.type){
    case 'texto': if(b.titulo)box.append(field(node('h3',b.titulo),'titulo'));if(b.texto)box.append(paragraph(b.texto,'texto'));break;
    case 'imagen':case 'video':{
      const fig=node('figure'),el=media(b.type==='imagen'?'img':'video',b.src,b.alt);if(!el)break;
      if(b.type==='video'&&hrefSeguro(b.poster,true))el.poster=b.poster;
      add(fig,el,b.pie&&field(node('figcaption',b.pie),'pie'));box.append(fig);break;
    }
    case 'galeria':{
      const grid=node('div',null,'xc-gallery');
      for(const [index,f] of (b.fotos||[]).entries()){
        const img=media('img',f.src,f.alt);
        if(img){img.dataset.xPhoto=index;grid.append(img);}
      }
      box.append(grid);break;
    }
    case 'lista':add(box,b.titulo&&field(node('h3',b.titulo),'titulo'),list(b.elementos,'elementos'));break;
    case 'boton':add(box,link(b.etiqueta,b.enlace));break;
    case 'paquete':{
      const card=node('article',null,'xc-package');
      add(card,media('img',b.imagen,b.alt));const detail=node('div');
      add(detail,b.titulo&&field(node('h3',b.titulo),'titulo'),b.precio&&field(node('strong',b.precio),'precio'),b.duracion&&field(node('p',b.duracion),'duracion'),b.descripcion&&paragraph(b.descripcion,'descripcion'),list(b.incluye,'incluye'),link(b.etiqueta,b.enlace));
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
      const wrap=node('div',null,'xc-wrap');if(x.titulo)wrap.append(field(node('h2',x.titulo),'titulo',x));
      for(const b of x.blocks||[])wrap.append(block(b,x));el.append(wrap);
      if(x.beforeFirst){
        const first=main?.querySelector('[data-x-section]');
        if(first)first.before(el);else main?.append(el);
      }else{
        const after=anchorMap.get(x.after)||Array.from(main?.querySelectorAll('[data-x-section]')||[]).find(v=>v.dataset.xSection===x.after);
        if(after)after.after(el);else main?.append(el);
        anchorMap.set(x.after,el);
      }
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
    main.append(field(node('h1',p.titulo),'titulo',p));if(p.descripcion)main.append(field(node('p',p.descripcion,'xc-intro'),'descripcion',p));
    for(const b of p.blocks||[])main.append(block(b,p));
    const go=document.querySelector('[data-cms-home]');if(go)go.href=homeLink||'./';
  }
}
