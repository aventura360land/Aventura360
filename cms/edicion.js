import {button,details,el,field,objectFields,rowActions,select} from './formularios.js';
import {blockTypes,copyBlock,idNuevo,nombre,slugify} from './modelo.js';

export function editTemplate(host,page,ctx,jump=null){
  const state=ctx.state.template, tools=el('div',undefined,'section-tools'),view=el('div');
  let section=page.sections.find(s=>s.id===jump?.section)||page.sections.find(s=>s.id===(page.id==='inicio'?'inicio':'introduccion'))||page.sections[0],query='';
  const picker=select(page.sections.map(s=>[s.id,s.label]),section.id,k=>{section=page.sections.find(s=>s.id===k);render();});picker.setAttribute('aria-label','Sección');
  const search=el('input');search.type='search';search.placeholder='Buscar un texto en esta página';search.setAttribute('aria-label',search.placeholder);tools.append(picker,search);
  const order=state.sections[page.id]??=page.sections.filter(s=>s.sortable).map(s=>({id:s.id,visible:true}));
  function showOrder(box){
    box.replaceChildren();
    order.forEach((v,i)=>{const line=el('div',undefined,'page-line'),label=page.sections.find(s=>s.id===v.id)?.label||v.id;
      const vis=el('input');vis.type='checkbox';vis.checked=v.visible;vis.setAttribute('aria-label','Mostrar '+label);vis.onchange=()=>{v.visible=vis.checked;ctx.changed();};
      line.append(vis,el('strong',label),rowActions(order,i,{changed:ctx.changed,redraw:()=>showOrder(box),remove:false}));box.append(line);
    });
  }
  host.append(tools,details('Orden y visibilidad de las secciones',showOrder),view);
  function inputFor(f,overrides,base=state.values){
    const val=overrides[f.id]??base[f.id]??f.value;
    const spec={...f};if(f.attr==='data-service'){spec.type='select';spec.options=[...new Set([val,...Object.keys((ctx.state.dynamic||ctx.dynamic).servicios)])];}
    const wrap=field(spec,val,v=>{overrides[f.id]=v;ctx.changed();},ctx.choose);
    if(jump?.field===f.id)requestAnimationFrame(()=>{const control=wrap.querySelector('input,textarea,select');control?.focus();control?.scrollIntoView({block:'center'});});
    return wrap;
  }
  function collection(box,c){
    const rows=state.collections[c.id]??=c.items.map(v=>({id:v.id,source:v.id,values:{}}));
    function draw(){
      box.replaceChildren();rows.forEach((v,i)=>{
        const source=c.items.find(s=>s.id===(v.source||v.id));if(!source)return;
        const textField=source.fields.find(f=>!f.attr&&['text','textarea'].includes(f.type)),label=v.values?.[textField?.id]||source.label;
        box.append(details((i+1)+'. '+label,editor=>{
          editor.append(rowActions(rows,i,{...ctx,redraw:draw,duplicate:item=>({...structuredClone(item),id:idNuevo()})}));
          for(const f of source.fields)editor.append(inputFor(f,v.values??={}));
        },jump?.item===v.id));
      });
      if(c.items.length){let model=c.items[0].id;const controls=el('div',undefined,'section-tools');
        const styles=select(c.items.map(i=>[i.id,i.label]),model,v=>model=v);styles.setAttribute('aria-label','Usar como modelo');
        controls.append(styles,button('Añadir elemento',()=>{rows.push({id:idNuevo(),source:model,values:{}});ctx.changed();draw();box.querySelectorAll(':scope > details')[rows.length-1].open=true;}));box.append(controls);
      }
    }draw();
  }
  function render(){
    view.replaceChildren();
    if(query){
      for(const s of page.sections){
        const all=s.fields.concat(s.collections.flatMap(c=>c.items.flatMap(i=>i.fields)));
        if(!all.some(f=>[f.label,f.value,state.values[f.id]].join(' ').toLowerCase().includes(query)))continue;
        view.append(button(s.label,()=>{search.value='';query='';section=s;picker.value=s.id;render();}));
      }if(!view.childElementCount)view.append(el('p','No hay coincidencias.'));return;
    }
    view.append(el('h2',section.label));
    for(const f of section.fields)view.append(inputFor(f,state.values));
    for(const c of section.collections)view.append(details(c.label,box=>collection(box,c),c.id===jump?.collection));
  }
  search.oninput=()=>{query=search.value.trim().toLowerCase();render();};render();
}

function blankLike(obj){
  if(Array.isArray(obj))return [];
  if(obj&&typeof obj==='object')return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,blankLike(v)]));
  return typeof obj==='number'?0:typeof obj==='boolean'?false:'';
}
function dictionaries(host,map,model,ctx){
  const draw=()=>{
    host.replaceChildren();
    const tools=el('div',undefined,'section-tools'),newName=el('input');newName.placeholder='Nombre del elemento nuevo';newName.setAttribute('aria-label',newName.placeholder);
    tools.append(newName,button('Crear',()=>{
      const key=slugify(newName.value);
      if(!key||['constructor','prototype','__proto__'].includes(key)||Object.hasOwn(map,key)){ctx.report('Elige un nombre distinto.');return;}
      const v=blankLike(model);if('titulo' in v)v.titulo=newName.value.trim();map[key]=v;ctx.changed();draw();host.querySelectorAll(':scope > details')[Object.keys(map).length-1].open=true;
    }));host.append(tools);
    for(const [key,v] of Object.entries(map)){
      host.append(details(v.titulo||nombre(key),box=>{
        box.append(el('p','Identificador: '+key,'hint'));objectFields(box,v,key,ctx);
        box.append(button('Quitar elemento',async()=>{if(await ctx.confirm('Quitar este elemento','Comprueba sus enlaces y botones antes de publicar.','Quitar')){delete map[key];ctx.changed();draw();}},'danger'));
      }));
    }
  };draw();
}
export function editDynamic(host,key,ctx){
  const data=ctx.state.dynamic??=structuredClone(ctx.dynamic);
  if(key==='servicios'||key==='mapa'){dictionaries(host,data[key],Object.values(ctx.dynamic[key])[0],ctx);return;}
  if(key==='asistente'){
    Object.entries(data.asistente).forEach(([k,v])=>{
      host.append(details(nombre(k),box=>{
        if(['respuestas','intenciones'].includes(k))dictionaries(box,v,Object.values(ctx.dynamic.asistente[k])[0],ctx);
        else objectFields(box,v,k,ctx);
      }));
    });return;
  }
  objectFields(host,data.interfaz,key,ctx);
  host.append(field({label:'Número principal de WhatsApp con indicativo',type:'text'},data.whatsapp,v=>{data.whatsapp=v;ctx.changed();}));
}

export function editCustom(host,isPage,ctx){
  const rows=isPage?ctx.state.pages:ctx.state.extras;
  function draw(){
    host.replaceChildren();
    host.append(button(isPage?'Crear página':'Añadir sección',()=>{
      const id=idNuevo();const x={id,titulo:isPage?'Página nueva':'Sección nueva',visible:true,menu:false,blocks:[]};
      if(isPage){x.slug='pagina-'+id.slice(0,8);x.descripcion='';}else{x.pagina='inicio';x.after='experiencias';}
      rows.push(x);ctx.changed();draw();host.querySelectorAll(':scope > details')[rows.length-1].open=true;
    }));
    if(!rows.length)host.append(el('p',isPage?'Crea una página y añade sus bloques de contenido.':'Añade una sección para ofrecer paquetes, incorporar una galería o ampliar una página existente.','hint'));
    rows.forEach((x,i)=>host.append(details(x.titulo||'Sin título',box=>{
      box.append(rowActions(rows,i,{...ctx,redraw:draw,duplicate:item=>{const c=structuredClone(item);c.id=idNuevo();if(isPage)c.slug+='-'+c.id.slice(0,6);c.titulo+=' (copia)';return c;}}));
      const edit=(key,label,type='text')=>box.append(field({label,type},x[key],v=>{x[key]=v;ctx.changed();}));
      edit('titulo','Título');if(isPage){edit('slug','Dirección corta de la página');edit('descripcion','Descripción','textarea');}
      else{
        const position=el('div');
        const selector=()=>{
          const p=ctx.catalog.pages.find(p=>p.id===(x.pagina||'inicio'));const options=[['','Al final'],...p.sections.filter(s=>s.sortable).map(s=>[s.id,s.label])];
          position.replaceChildren(field({label:'Colocar después de',type:'select',options},x.after||'',v=>{delete x.beforeFirst;x.after=v;ctx.changed();}));
        };
        box.append(field({label:'Página de destino',type:'select',options:ctx.catalog.pages.map(p=>[p.id,p.label])},x.pagina||'inicio',v=>{delete x.beforeFirst;x.pagina=v;x.after='';ctx.changed();selector();}),position);selector();
      }
      edit('visible','Visible al publicar','boolean');edit('menu','Añadir enlace al menú','boolean');
      box.append(el('h3','Bloques de contenido'));const content=el('div');box.append(content);
      const blocks=()=>{content.replaceChildren();
        x.blocks.forEach((b,bi)=>{const spec=blockTypes[b.type];if(!spec)return;
          content.append(details(spec[0]+(b.titulo?' · '+b.titulo:''),panel=>{
            panel.append(rowActions(x.blocks,bi,{...ctx,redraw:blocks,duplicate:copyBlock}));
            objectFields(panel,b,b.type,{...ctx,skip:['type','blockId']});
          }));
        });
        const addBar=el('div',undefined,'section-tools');let choice='texto';const picker=select(Object.entries(blockTypes).map(([k,v])=>[k,v[0]]),choice,v=>choice=v);picker.setAttribute('aria-label','Tipo de bloque');
        addBar.append(picker,button('Añadir bloque',()=>{x.blocks.push({blockId:idNuevo(),type:choice,...structuredClone(blockTypes[choice][1])});ctx.changed();blocks();content.querySelectorAll(':scope > details')[x.blocks.length-1].open=true;}));content.append(addBar);
      };blocks();
    })));
  };draw();
}
