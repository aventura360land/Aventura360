import {button,el,field,objectFields,details} from './formularios.js';
import {applyStyle,destination,layoutKey,pageLayout,spacings} from './disposicion.js';
import {blockTypes,copyBlock,idNuevo,slugify} from './modelo.js';
import {safeUrl,validSrcset} from './plantilla.js';
import {labelOf} from './estructura.js';

function nativeFields(page,state,node){
  const result=new Map(),sections=page.sections||[];
  const candidates=[node,...node.querySelectorAll('[data-x-node]')];
  for(const candidate of candidates){
    if(candidate!==node&&!node.matches('[data-layout-type=row]')&&candidate.closest('[data-x-layout]')!==node)continue;
    if(!candidate.dataset.xNode)continue;
    const entry=candidate.closest('[data-x-item]'),collectionId=entry?.parentElement?.dataset.xCollection;
    const row=state.template.collections[collectionId]?.find(i=>i.id===entry.dataset.xItem);
    const collection=sections.flatMap(s=>s.collections).find(c=>c.id===collectionId);
    const source=collection?.items.find(i=>i.id===(row?.source||entry.dataset.xItem));
    const specs=collection&&source?source.fields.filter(f=>f.node===candidate.dataset.xNode):
      sections.flatMap(s=>s.fields).filter(f=>f.node===candidate.dataset.xNode);
    for(const f of specs){
      const rowId=entry?.dataset.xItem;
      result.set((rowId||'')+'/'+f.id,{f,collection:source?collection:null,rowId,row});
    }
  }
  return [...result.values()];
}

export function blockOwner(state,node,page){
  const box=node?.closest('[data-x-block]');
  const area=node?.closest('.xc-section');
  if(!box&&!area&&!page.sections)return {owner:state.pages.find(p=>p.id===page.id),box:null};
  const id=box?.dataset.xOwner||area?.id.slice('seccion-'.length);
  const owner=state.pages.find(p=>p.id===id)||state.extras.find(p=>p.id===id);
  return {owner,box,block:owner?.blocks?.find(b=>b.blockId===box?.dataset.xBlock)};
}

// Acciones de duplicar/quitar disponibles para un nodo (bloque propio o elemento de colección).
// Las usan tanto el panel de Ajustes como la barra flotante del bloque.
export function blockActions(ctx,node,flush=()=>true){
  if(!node)return null;
  const page=ctx.page(),state=ctx.state();
  const {owner,block}=blockOwner(state,node,page);
  if(block){
    return {
      duplicate:()=>{if(flush())ctx.duplicate(owner,block,copyBlock(block));},
      remove:async()=>{
        if(flush()&&await ctx.confirm('Quitar este bloque','Puedes recuperarlo con Deshacer antes de cerrar el editor.','Quitar'))ctx.remove(owner,block);
      }
    };
  }
  if(node.dataset.xItem){
    const collectionId=node.parentElement?.dataset.xCollection;
    const collection=page.sections?.flatMap(section=>section.collections).find(c=>c.id===collectionId);
    if(collection){
      return {
        duplicate:()=>{if(flush())ctx.changeRow(collection,node.dataset.xItem,true);},
        remove:async()=>{
          if(flush()&&await ctx.confirm('Quitar este elemento','Puedes recuperar el elemento con Deshacer.','Quitar'))ctx.changeRow(collection,node.dataset.xItem,false);
        }
      };
    }
  }
  return null;
}

function actionRow(acts){
  const row=el('div',undefined,'inline-actions');
  row.append(button('Duplicar',acts.duplicate),button('Quitar',acts.remove,'danger'));
  return row;
}

export function studioInspector(host,ctx){
  let pending=null;
  function flush(reload=false){
    if(!pending)return true;
    const apply=pending;pending=null;
    try{
      if(!apply(reload))pending=apply;
      return !pending;
    }catch(error){pending=apply;ctx.report(error.message,true);return false;}
  }

  function form(build,update){
    const wrapper=el('form',undefined,'fields');
    const apply=el('button','Aplicar al lienzo','primary');apply.disabled=true;apply.type='submit';
    function changed(){
      apply.disabled=false;
      pending=reload=>{const ok=update(reload);if(ok)apply.disabled=true;return ok;};
      ctx.updateButtons();
    }
    build(wrapper,changed);
    wrapper.append(apply);
    wrapper.onsubmit=e=>{e.preventDefault();flush(true);};
    host.append(wrapper);
  }

  function styleControls(node,page){
    const values=pageLayout(ctx.state(),page)?.styles?.[layoutKey(node)]||{};
    host.append(details('Disposición',box=>{
      const originalSection=page.sections?.find(s=>s.id===node.dataset.xSection&&s.sortable);
      function update(key,value){
        ctx.commit(state=>{
          if(originalSection&&key==='hidden'){
            const order=state.template.sections[page.id]??=page.sections.filter(s=>s.sortable).map(s=>({id:s.id,visible:true}));
            const entry=order.find(s=>s.id===originalSection.id);
            if(entry)entry.visible=!value;else order.push({id:originalSection.id,visible:!value});
          }
          const layout=pageLayout(state,ctx.page(),true);
          const styles=layout.styles??={};
          const style={...styles[layoutKey(node)]};
          if(value&&!(originalSection&&key==='hidden'))style[key]=value;else delete style[key];
          if(Object.keys(style).length)styles[layoutKey(node)]=style;else delete styles[layoutKey(node)];
        },{reload:false,message:'Disposición actualizada'});
        if(originalSection&&key==='hidden')node.hidden=value;
        applyStyle(node,pageLayout(ctx.state(),ctx.page())?.styles?.[layoutKey(node)]);
        ctx.refresh();
      }
      const align=[['','Predeterminada'],['left','Izquierda'],['center','Centrada'],['right','Derecha']];
      const space=[['','Predeterminado'],...Object.keys(spacings).map(k=>[k,k[0].toUpperCase()+k.slice(1)])];
      box.append(field({label:'Alineación',type:'select',options:align},values.align,v=>update('align',v)));
      box.append(field({label:'Espacio superior',type:'select',options:space},values.space,v=>update('space',v)));
      box.append(field({label:'Ocultar en la página',type:'boolean'},values.hidden||node.hidden,v=>update('hidden',v)));
    }));
  }

  function render(node,tab){
    pending=null;host.replaceChildren();
    const page=ctx.page(),state=ctx.state();
    if(tab==='page'){
      host.append(el('h3',page.label||page.titulo));
      if(page.sections){
        host.append(el('p','Selecciona una sección para ver sus controles en Bloque.'));
      }else{
        const copy={titulo:page.titulo,slug:page.slug,descripcion:page.descripcion,menu:page.menu,visible:page.visible};
        form((box,changed)=>objectFields(box,copy,'page',{changed,skip:[]}),reload=>{
          const slug=slugify(copy.slug);
          if(!copy.titulo.trim()||!slug||ctx.state().pages.some(p=>p.id!==page.id&&p.slug===slug)){
            ctx.report('Escribe un título y una dirección única para la página.',true);return false;
          }
          ctx.commit(()=>Object.assign(ctx.page(),copy,{slug}),{reload,message:'Ajustes de página actualizados'});return true;
        });
      }
      const panel=el('a','Administrar páginas, apariencia y reseñas');panel.href='../resenas/admin.html';
      host.append(panel);return;
    }
    if(!node){
      host.append(el('h3','Selecciona un bloque'),el('p','Haz clic en la página o elige un elemento de Estructura para editarlo.'));
      return;
    }
    host.append(el('h3',labelOf(node).name),el('p',labelOf(node).kind));
    if(ctx.choosing()){
      const target=ctx.target();
      const text=target?'Destino · '+labelOf(target).name:'Selecciona el destino en la página o en Estructura.';
      const moves=el('div',undefined,'move-actions');
      for(const [side,label] of [['before','Antes'],['after','Después'],['inside','Dentro']]){
        if(target&&destination(node,target,side))moves.append(button(label,()=>ctx.finishMove(side)));
      }
      moves.append(button('Cancelar',ctx.cancelMove));
      host.append(el('p',text),moves);return;
    }

    const moves=el('div',undefined,'move-actions'),order=ctx.siblings(node),index=order.indexOf(node);
    const up=button('Subir',()=>ctx.step(-1)),down=button('Bajar',()=>ctx.step(1));
    up.disabled=index<=0;down.disabled=index<0||index>=order.length-1;
    moves.append(up,down,button('Mover a…',ctx.startMove));host.append(moves);
    styleControls(node,page);

    const {owner,block}=blockOwner(state,node,page);
    if(block){
      const copy=structuredClone(block);
      form((box,changed)=>objectFields(box,copy,block.type,{changed,choose:ctx.choose,confirm:ctx.confirm,skip:['type','blockId']}),reload=>{
        ctx.commit(()=>Object.assign(block,structuredClone(copy)),{reload,message:'Contenido actualizado'});return true;
      });
      const acts=blockActions(ctx,node,flush);
      if(acts)host.append(actionRow(acts));
    }else{
      const specs=nativeFields(page,state,node);
      const edits=new Map();
      if(specs.length)form((box,changed)=>{
        for(const {f,collection,rowId,row} of specs){
          const spec={...f};if(f.type==='srcset')spec.type='text';
          box.append(field(spec,row?.values?.[f.id]??state.template.values[f.id]??f.value,value=>{
            edits.set((rowId||'')+'/'+f.id,{f,collection,rowId,value});changed();
          },ctx.choose));
        }
      },reload=>{
        for(const {f,value} of edits.values()){
          const media=['image','video','url'].includes(f.type);
          if((media&&value.trim()&&!safeUrl(value,f.type))||(f.type==='srcset'&&!validSrcset(value))){
            ctx.report('Revisa el enlace o archivo en «'+f.label+'».',true);return false;
          }
        }
        ctx.commit(draft=>{
          const changes=new Map(edits);
          for(const entry of edits.values()){
            if(entry.f.attr!=='src'||entry.f.type!=='image')continue;
            for(const related of specs){
              if(related.rowId!==entry.rowId||related.f.node!==entry.f.node||!['srcset','data-fallback'].includes(related.f.attr))continue;
              const key=(related.rowId||'')+'/'+related.f.id;
              if(!changes.has(key))changes.set(key,{...related,value:''});
            }
          }
          for(const {f,collection,rowId,value} of changes.values()){
            const template=draft.template;
            if(collection&&rowId){
              const rows=template.collections[collection.id]??=collection.items.map(i=>({id:i.id,source:i.id,values:{}}));
              const row=rows.find(i=>i.id===rowId);
              if(row)(row.values??={})[f.id]=value;
            }else template.values[f.id]=value;
          }
        },{reload,message:'Contenido actualizado'});return true;
      });
      if(owner&&page.sections){
        const copy={titulo:owner.titulo};
        form((box,changed)=>box.append(field({label:'Título de la sección'},copy.titulo,v=>{copy.titulo=v;changed();})),reload=>{
          ctx.commit(()=>Object.assign(owner,copy),{reload,message:'Sección actualizada'});return true;
        });
      }
      const acts=blockActions(ctx,node,flush);
      if(acts)host.append(actionRow(acts));
    }
  }
  return {render,flush,pending:()=>!!pending,actions:node=>blockActions(ctx,node,flush)};
}
