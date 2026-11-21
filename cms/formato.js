import {hrefSeguro} from './modelo.js';

const runs=new WeakMap();

// Cada tramo visible conserva los delimitadores y el destino del enlace del modelo.
export function formattedText(text){
  const fragment=document.createDocumentFragment(),source=String(text||''),parts=[];
  const pattern=/\*\*([^*\n]+)\*\*|_([^_\n]+)_|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  function append(parent,value,prefix='',suffix=''){
    const node=document.createTextNode(value);
    parent.append(node);parts.push({node,prefix,suffix});runs.set(node,parts);
  }
  let offset=0;
  for(const match of source.matchAll(pattern)){
    append(fragment,source.slice(offset,match.index));
    const tag=match[1]?'strong':match[2]?'em':'a';
    const wrapper=document.createElement(tag);
    if(tag==='a'){
      const dest=hrefSeguro(match[4]);if(dest)wrapper.href=dest;
      append(wrapper,match[3],'[',']('+match[4]+')');
    }else{
      const marker=tag==='strong'?'**':'_';
      append(wrapper,match[1]||match[2],marker,marker);
    }
    fragment.append(wrapper);offset=match.index+match[0].length;
  }
  append(fragment,source.slice(offset));return fragment;
}
export function textWithEdit(part,value){
  const parts=runs.get(part);
  if(!parts)return value;
  return parts.map(run=>{
    const text=run.node===part?value:run.node.data;
    return text?run.prefix+text+run.suffix:'';
  }).join('');
}
