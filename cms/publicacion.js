import {slugify} from './modelo.js';
export function validatePublish(state){
  const slugs=new Set();
  for(const p of state.pages){
    if(!p.titulo.trim()||!p.slug||slugify(p.slug)!==p.slug||slugs.has(p.slug))throw Error('Revisa Páginas nuevas. Cada página necesita título y dirección única en minúsculas, sin espacios.');
    slugs.add(p.slug);
  }
  if(state.dynamic&&!/^\d{7,15}$/.test(state.dynamic.whatsapp))throw Error('Revisa el número en Contacto y mensajes. Escribe solo dígitos con el indicativo internacional.');
  for(const p of [...state.pages,...state.extras]){
    if(!p.visible)continue;
    for(const b of p.blocks||[]){
      if(b.type==='paquete'&&!b.titulo.trim())throw Error('Escribe un nombre para el paquete turístico de «'+p.titulo+'».');
    }
  }
}
