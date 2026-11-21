import {el,button,field,objectFields,rowActions,select} from './formularios.js';
import {editTemplate} from './edicion.js';
import {layoutEditor} from './mover.js';
import {blockTypes,copyBlock,idNuevo} from './modelo.js';
import {paginaURL} from './paginas.js';

export function pageCanvas(host,page,ctx,back){
  const toolbar=el('div',undefined,'wp-tools'),body=el('div',undefined,'wp-layout'),paper=el('div',undefined,'wp-paper');
  const inspector=el('aside',undefined,'wp-inspector'),frame=el('iframe');frame.title='Página en edición';frame.className='wp-frame';
  inspector.setAttribute('aria-label','Ajustes de edición');
  host.append(toolbar,body);paper.append(frame);body.append(paper,inspector);
  const template=page.sections,fieldsByNode=new Map(),collections=new Map();
  for(const section of template||[]){
    const register=(spec,collection=null,item=null)=>{
      const entry=fieldsByNode.get(spec.node)||{specs:[],section,collection,item};
      entry.specs.push(spec);fieldsByNode.set(spec.node,entry);
    };
    section.fields.forEach(spec=>register(spec));
    for(const c of section.collections){collections.set(c.id,c);for(const item of c.items)for(const f of item.fields)register(f,c,item);}
  }
  let nonce='',timer=0,scroll=0,jumpTo=null,selected=null,currentSection='',currentOwner=null;
  const insHeading=title=>{inspector.replaceChildren(el('h2',title));};
  function refresh(delay=280){
    clearTimeout(timer);timer=setTimeout(()=>{if(!host.isConnected)return;scroll=frame.contentWindow?.scrollY||0;load();},delay);
  }
  const layout=layoutEditor({frame,inspector,page,ctx,leave:()=>{layout.close();outline();}});
  const modified=()=>{ctx.changed();refresh();};
  const helpers={...ctx,changed:modified};
  function ownerRows(entry,rowId){
    if(!entry.collection||!rowId)return ctx.state.template.values;
    const c=entry.collection,rows=ctx.state.template.collections[c.id]??=c.items.map(i=>({id:i.id,source:i.id,values:{}}));
    const row=rows.find(r=>r.id===rowId);return row?(row.values??={}):ctx.state.template.values;
  }
  function highlight(node){
    selected?.classList.remove('wp-selected-node');selected=node;node?.classList.add('wp-selected-node');
  }
  function showFields(entry,holder,rowId,node){
    currentSection=entry.section.id;currentOwner=null;highlight(node);
    insHeading(entry.item?.label||entry.section.label);
    for(const f of entry.specs){
      const spec={...f};if(f.attr==='data-service'){spec.type='select';spec.options=Object.keys((ctx.state.dynamic||ctx.dynamic).servicios);}
      const input=field(spec,holder[f.id]??ctx.state.template.values[f.id]??f.value,v=>{holder[f.id]=v;modified();},ctx.choose);
      input.dataset.wpField=f.id;inspector.append(input);
    }
    inspector.append(button('Más ajustes de la sección',()=>advanced(entry.section.id)));
  }
  function advanced(section){
    if(!template)return settings();
    insHeading('Ajustes de la sección');
    editTemplate(inspector,page,helpers,{section});
  }
  function settings(){
    currentOwner=null;insHeading('Ajustes de página');
    if(template){advanced('seo');return;}
    for(const [key,label,type] of [['titulo','Título de la página','text'],['slug','Dirección de la página','text'],['descripcion','Descripción','textarea'],['visible','Visible al publicar','boolean'],['menu','Mostrar en el menú','boolean']]){
      const input=field({label,type},page[key],v=>{page[key]=v;if(key==='titulo')host.parentElement.querySelector('h1').textContent=v;modified();},ctx.choose);
      input.dataset.wpKey=key;inspector.append(input);
    }
  }
  function owners(){return template?ctx.state.extras.filter(x=>(x.pagina||'inicio')===page.id):[page];}
  function focusOwner(owner,index){
    currentOwner=owner;jumpTo={owner:owner.id,index};
    if(!template&&index===undefined){settings();return;}
    if(index===undefined){
      insHeading('Sección');inspector.append(field({label:'Título de la sección'},owner.titulo,v=>{owner.titulo=v;modified();}));
      inspector.append(button('Añadir bloque aquí',insert));return;
    }
    const block=owner.blocks[index];if(!block)return outline();
    insHeading(blockTypes[block.type]?.[0]||'Bloque');
    inspector.append(rowActions(owner.blocks,index,{...helpers,redraw:()=>{jumpTo=null;outline();},duplicate:copyBlock}));
    objectFields(inspector,block,block.type,{...helpers,skip:['type','blockId']});
    inspector.append(button('Añadir otro bloque',insert));
  }
  function outline(){
    insHeading('Estructura');currentOwner=null;
    for(const s of template||[]){
      inspector.append(button(s.label,()=>{currentSection=s.id;advanced(s.id);frame.contentDocument?.querySelector('[data-x-section="'+CSS.escape(s.id)+'"]')?.scrollIntoView({block:'start'});},'wp-outline'));
    }
    for(const owner of owners()){
      if(template)inspector.append(button(owner.titulo||'Sección de bloques',()=>focusOwner(owner),'wp-outline'));
      for(const [index,b] of owner.blocks.entries())inspector.append(button(blockTypes[b.type]?.[0]+(b.titulo?' · '+b.titulo:''),()=>{
        focusOwner(owner,index);findBlock(owner.id,index)?.scrollIntoView({block:'center'});},'wp-outline'));
    }
    if(!template&&!page.blocks.length)inspector.append(el('p','Esta página todavía no tiene bloques.','hint'));
  }
  function insert(){
    insHeading('Añadir bloque');
    let where=currentOwner&&owners().includes(currentOwner)?'owner:'+currentOwner.id:currentSection?'after:'+currentSection:'end';
    if(template){
      const locations=[['end','Al final de la página'],...template.filter(s=>s.sortable).map(s=>['after:'+s.id,'Después de '+s.label]),...owners().map(o=>['owner:'+o.id,o.titulo||'Sección de bloques'])];
      if(!locations.some(([id])=>id===where))where='end';
      inspector.append(field({type:'select',label:'Insertar en',options:locations},where,v=>where=v));
    }
    const grid=el('div',undefined,'wp-inserter');
    for(const [type,[label,defaults]] of Object.entries(blockTypes))grid.append(button(label,()=>{
      let owner=page;
      if(template){
        owner=where.startsWith('owner:')?owners().find(o=>o.id===where.slice(6)):null;
        if(!owner){
          const after=where.startsWith('after:')?where.slice(6):'';
          owner=owners().findLast(o=>o.editorGroup===true&&o.after===after&&o.visible);
          if(!owner){owner={id:idNuevo(),titulo:'',visible:true,menu:false,pagina:page.id,after,blocks:[],editorGroup:true};ctx.state.extras.push(owner);}
        }
      }
      owner.blocks.push({blockId:idNuevo(),type,...structuredClone(defaults)});ctx.changed();focusOwner(owner,owner.blocks.length-1);refresh(0);
    }));
    inspector.append(grid);
  }
  function findBlock(id,index){
    const doc=frame.contentDocument;if(!doc)return;
    if(index===undefined)return template?doc.getElementById('seccion-'+id):doc.getElementById('page-content');
    const block=owners().find(owner=>owner.id===id)?.blocks[index];
    if(block)return doc.querySelector('[data-x-owner="'+CSS.escape(id)+'"][data-x-block="'+CSS.escape(block.blockId)+'"]');
  }
  function setup(){
    const d=frame.contentDocument;if(!d||!d.body)return;
    const css=d.createElement('style');
    css.textContent='[data-wp-run]{all:unset!important;display:inline!important;cursor:text!important;min-width:2px}.wp-selected-node,[data-wp-run]:focus{outline:2px solid #167b66!important;outline-offset:3px}.xc-block{min-height:2rem}.xc-block:empty::before{content:"Bloque vacío";color:#53675f}.reveal{opacity:1!important;transform:none!important} [data-x-node]:hover,.xc-block:hover{outline:1px dashed #539980;outline-offset:2px} html{scroll-behavior:auto!important}';
    d.head.append(css);
    const runs=new WeakMap();
    for(const node of d.body.querySelectorAll('[data-x-node]')){
      const entry=fieldsByNode.get(node.dataset.xNode);if(!entry||node.closest('noscript,svg,textarea,button[disabled]'))continue;
      const textNodes=Array.from(node.childNodes).filter(x=>x.nodeType===3);
      for(const f of entry.specs.filter(f=>Number.isInteger(f.text))){
        const original=textNodes[f.text];if(!original)continue;
        const run=d.createElement('span');run.dataset.wpRun=f.id;run.contentEditable='plaintext-only';run.setAttribute('aria-label',f.label);run.setAttribute('role','textbox');run.setAttribute('spellcheck','true');
        run.textContent=original.data;original.replaceWith(run);runs.set(run,{f,entry,node});
      }
    }
    const customRuns=new WeakMap();
    function editableValue(node,model,key,owner,index){
      if(!node||typeof model[key]!=='string'||node.childElementCount)return;
      const run=d.createElement('span');run.dataset.wpRun=key;run.contentEditable='plaintext-only';run.setAttribute('role','textbox');run.setAttribute('aria-label',key==='titulo'?'Título':key==='texto'?'Texto del bloque':key);
      run.textContent=node.textContent;node.replaceChildren(run);customRuns.set(run,{model,key,owner,index});
    }
    for(const owner of owners()){
      const area=template?d.getElementById('seccion-'+owner.id):d.getElementById('page-content');if(!area)continue;
      editableValue(template?area.querySelector('.xc-wrap > h2'):area.querySelector(':scope > h1'),owner,'titulo',owner);
      if(!template)editableValue(area.querySelector('.xc-intro'),owner,'descripcion',owner);
      owner.blocks.forEach((b,i)=>{
        const box=findBlock(owner.id,i);if(!box)return;
        editableValue(box.querySelector('h3'),b,'titulo',owner,i);
        if(b.type==='texto')editableValue(box.querySelector('p'),b,'texto',owner,i);
        if(b.type==='paquete')editableValue(box.querySelector('strong'),b,'precio',owner,i);
        if(['imagen','video'].includes(b.type))editableValue(box.querySelector('figcaption'),b,'pie',owner,i);
        if(['boton','paquete'].includes(b.type))editableValue(box.querySelector('.xc-button'),b,'etiqueta',owner,i);
      });
    }
    layout.attach(d);
    function readRow(node){return node.closest('[data-x-item]')?.dataset.xItem;}
    d.addEventListener('input',e=>{
      const run=e.target.closest('[data-wp-run]'),custom=customRuns.get(run);
      if(custom){
        custom.model[custom.key]=run.textContent;ctx.changed();
        if(custom.model===page&&custom.key==='titulo')host.parentElement.querySelector('h1').textContent=run.textContent;
        const input=inspector.querySelector('[data-wp-key="'+custom.key+'"] input,[data-wp-key="'+custom.key+'"] textarea');
        if(input)input.value=run.textContent;
        return;
      }
      const hit=runs.get(run);if(!hit)return;
      const holder=ownerRows(hit.entry,readRow(hit.node)),value=e.target.textContent;
      holder[hit.f.id]=value.trim();ctx.changed();
      const input=inspector.querySelector('[data-wp-field="'+CSS.escape(hit.f.id)+'"] input, [data-wp-field="'+CSS.escape(hit.f.id)+'"] textarea');if(input)input.value=value.trim();
    },true);
    d.addEventListener('click',e=>{
      e.preventDefault();e.stopImmediatePropagation();
      const run=e.target.closest('[data-wp-run]'),customRun=customRuns.get(run);
      if(customRun){focusOwner(customRun.owner,customRun.index);highlight(run.parentElement);if(d.activeElement!==run)run.focus();return;}
      const node=e.target.closest('[data-x-node]'),entry=node&&fieldsByNode.get(node.dataset.xNode),extra=e.target.closest('.xc-section'),custom=e.target.closest('.xc-block');
      if(custom||extra&&!entry){
        const owner=custom?owners().find(x=>x.id===custom.dataset.xOwner):owners().find(x=>'seccion-'+x.id===extra.id);
        if(owner){const index=custom?owner.blocks.findIndex(b=>b.blockId===custom.dataset.xBlock):undefined;focusOwner(owner,index);highlight(custom||extra);}
      }else if(entry){showFields(entry,ownerRows(entry,readRow(node)),readRow(node),node);const run=e.target.closest('[data-wp-run]');if(run&&d.activeElement!==run)run.focus();}
      else if(!template){settings();}
      else{const section=e.target.closest('[data-x-section]')?.dataset.xSection;if(section){currentSection=section;advanced(section);}}
    },true);
    d.addEventListener('keydown',e=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();ctx.saveDraft();}
    },true);
    d.addEventListener('submit',e=>e.preventDefault(),true);
    if(jumpTo){const target=findBlock(jumpTo.owner,jumpTo.index);if(target){target.scrollIntoView({block:'center'});highlight(target);}jumpTo=null;}
    else frame.contentWindow.scrollTo(0,scroll);
  }
  function onMessage(e){
    if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.nonce!==nonce)return;
    if(e.data.type==='xebax-preview-ready')frame.contentWindow.postMessage({type:'xebax-preview-data',nonce,content:ctx.state},location.origin);
    if(e.data.type==='xebax-preview-mounted')setup();
  }
  function load(){nonce=idNuevo();const u=new URL(paginaURL(page),location.href);u.searchParams.set('borrador',nonce);frame.src=u.href;}
  const size=select([['wide','Escritorio'],['mobile','Móvil']],'wide',v=>paper.classList.toggle('wp-mobile',v==='mobile'));size.setAttribute('aria-label','Tamaño del lienzo');
  const undo=button('Deshacer',()=>ctx.changeHistory('undo')),redo=button('Rehacer',()=>ctx.changeHistory('redo'));
  undo.dataset.editAction='undo';redo.dataset.editAction='redo';
  const edit=action=>()=>{layout.close();action();};
  toolbar.append(button('← Páginas',back),button('+ Añadir bloque',edit(insert),'primary'),layout.trigger,undo,redo,button('Estructura',edit(outline)),button('Ajustes de página',edit(settings)),size);
  insHeading('Edición visual');inspector.append(el('p','Haz clic en un texto para escribir sobre él. Selecciona una imagen o un botón para cambiar sus propiedades.','hint'));
  if(!template&&!page.blocks.length)insert();
  window.addEventListener('message',onMessage);load();
  return ()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);};
}
