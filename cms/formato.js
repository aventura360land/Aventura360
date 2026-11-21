import {hrefSeguro} from './modelo.js';
export function formattedText(text){
  const fragment=document.createDocumentFragment(),source=String(text||'');
  const pattern=/\*\*([^*\n]+)\*\*|_([^_\n]+)_|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  let offset=0;
  for(const m of source.matchAll(pattern)){
    fragment.append(source.slice(offset,m.index));
    const tag=m[1]?'strong':m[2]?'em':'a';
    const node=document.createElement(tag);node.textContent=m[1]||m[2]||m[3];
    if(tag==='a'){const dest=hrefSeguro(m[4]);if(dest)node.href=dest;}
    fragment.append(node);offset=m.index+m[0].length;
  }
  fragment.append(source.slice(offset));return fragment;
}
