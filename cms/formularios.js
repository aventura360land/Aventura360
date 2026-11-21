import {nombre} from './modelo.js';
export const $=id=>document.getElementById(id);
export function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
export function button(text,fn,cls){const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;}
export function select(items,value,change){
  const s=el('select');
  for(const item of items){const [v,label]=Array.isArray(item)?item:[item,item];const o=el('option',label);o.value=v;s.append(o);}
  s.value=value;s.addEventListener('change',()=>change(s.value));return s;
}
export function details(label,build,open=false){
  const d=el('details'),summary=el('summary',label);d.append(summary);
  let built=false;const fill=()=>{if(!built){built=true;const box=el('div');d.append(box);build(box);}};
  d.addEventListener('toggle',()=>{if(d.open)fill();});if(open){fill();d.open=true;}return d;
}
export function field(spec,value,update,chooseMedia){
  const wrap=el('div',undefined,'field'),label=el('label',spec.label);
  const id='f-'+crypto.randomUUID();label.htmlFor=id;wrap.append(label);
  const type=spec.type||'text';
  let input;
  if(type==='select'){input=select(spec.options||[],String(value??''),v=>update(v));}
  else{
    input=el(['textarea','rich'].includes(type)?'textarea':'input');
    if(type==='boolean'){input.type='checkbox';input.checked=Boolean(value);}
    else{if(input.tagName==='INPUT')input.type=type==='color'?'color':type==='number'?'number':'text';input.value=value??'';}
    input.addEventListener(type==='boolean'?'change':'input',()=>update(type==='boolean'?input.checked:type==='number'?Number(input.value):input.value));
  }
  input.id=id;wrap.append(input);
  if(type==='rich'){
    const actions=el('div',undefined,'field-actions');
    for(const [title,left,right] of [['Negrita','**','**'],['Cursiva','_','_'],['Enlace','[','](https://)']]){
      actions.append(button(title,()=>{
        const start=input.selectionStart,end=input.selectionEnd,selection=input.value.slice(start,end)||'Texto';
        input.setRangeText(left+selection+right,start,end,'end');
        const linkStart=start+left.length+selection.length+2;
        if(title==='Enlace')input.setSelectionRange(linkStart,linkStart+8);else input.setSelectionRange(start+left.length,start+left.length+selection.length);
        input.focus();update(input.value);
      }));
    }wrap.append(actions);
  }
  if(['image','video'].includes(type)&&chooseMedia){
    const tools=el('div',undefined,'field-actions');
    tools.append(button(type==='image'?'Elegir imagen':'Elegir video',()=>chooseMedia(type,v=>{input.value=v;update(v);})));
    wrap.append(tools);
  }
  return wrap;
}
export function move(arr,from,to){if(to<0||to>=arr.length)return;const [item]=arr.splice(from,1);arr.splice(to,0,item);}
export function rowActions(arr,index,{changed,redraw,duplicate,remove=true,confirm}){
  const box=el('div',undefined,'row-head');
  for(const [caption,delta] of [['Subir',-1],['Bajar',1]]){
    const b=button(caption,()=>{move(arr,index,index+delta);changed();redraw();});
    b.disabled=index+delta<0||index+delta>=arr.length;box.append(b);
  }
  if(duplicate)box.append(button('Duplicar',()=>{arr.splice(index+1,0,duplicate(arr[index]));changed();redraw();}));
  if(remove)box.append(button('Quitar',async()=>{if(await confirm('Quitar este elemento','El cambio se aplicará cuando publiques.','Quitar')){arr.splice(index,1);changed();redraw();}},'danger'));
  return box;
}
const arrayModels={fotos:{src:'',alt:''},videos:{src:'',poster:'',label:'',portrait:false},opciones:{etiqueta:'',accion:'pregunta',valor:''}};
function infer(k,value,context){
  if((context==='texto'&&k==='texto')||(context==='paquete'&&k==='descripcion'))return {type:'rich'};
  if(k==='accion')return {type:'select',options:['pregunta','servicio','seccion','whatsapp']};
  if(typeof value==='boolean')return {type:'boolean'};
  if(typeof value==='number')return {type:'number'};
  if(k==='src')return {type:context==='videos'||context==='video'?'video':'image'};
  if(['imagen','poster'].includes(k))return {type:'image'};
  if(k==='enlace')return {type:'url'};
  if(k==='descripcion'||k==='texto'||String(value).length>110)return {type:'textarea'};
  return {type:'text'};
}
export function objectFields(container,obj,context,helpers){
  const {changed,choose,confirm}=helpers;
  for(const key of Object.keys(obj)){
    if(helpers.skip?.includes(key))continue;
    const value=obj[key],label=nombre(key);
    if(Array.isArray(value)){
      const draw=host=>{host.replaceChildren();const arr=obj[key];
        arr.forEach((item,i)=>{
          const cap=typeof item==='string'?item:item?.titulo||item?.etiqueta||item?.alt||item?.label;
          host.append(details((i+1)+'. '+(cap?String(cap).slice(0,65):label),panel=>{
            panel.append(rowActions(arr,i,{changed,redraw:()=>draw(host),duplicate:structuredClone,confirm}));
            if(item!==null&&typeof item==='object')objectFields(panel,item,key,helpers);
            else panel.append(field({label:'Texto',type:'textarea'},item,v=>{arr[i]=v;changed();},choose));
          }));
        });
        host.append(button('Añadir elemento',()=>{arr.push(structuredClone(arrayModels[key]??''));changed();draw(host);host.querySelectorAll(':scope > details')[arr.length-1].open=true;}));
      };
      container.append(details(label+' ('+value.length+')',draw));
    }else if(value!==null&&typeof value==='object'){
      container.append(details(label,panel=>objectFields(panel,value,key,helpers)));
    }else{
      const control=field({label,...infer(key,value,context)},value,v=>{obj[key]=v;changed();},choose);
      control.dataset.wpKey=key;container.append(control);
    }
  }
}
