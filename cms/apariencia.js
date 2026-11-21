import {hrefSeguro} from './modelo.js';
const fonts={'Bricolage Grotesque':"'Bricolage Grotesque',system-ui,sans-serif",Inter:"Inter,system-ui,sans-serif",Sistema:'system-ui,sans-serif',Serif:'Georgia,serif',Monoespaciada:'ui-monospace,monospace'};
export const appearanceFields=[
  {id:'display',label:'Tipografía de títulos',type:'select',options:Object.keys(fonts),value:'Bricolage Grotesque'},
  {id:'body',label:'Tipografía de texto',type:'select',options:Object.keys(fonts),value:'Inter'},
  ...Object.entries({'deep-2':['Verde del pie','#0a403b'],'orange-deep':['Naranja oscuro','#d75d0b'],lime:['Lima','#b4d64a'],wa:['WhatsApp','#25d366'],white:['Blanco','#ffffff']}).map(([id,[label,value]])=>({id,label,value,type:'color'})),
  ...['img/pueblo-calle-th.webp','img/cuatrimoto-grupo-th.webp','img/helicoptero-piedra-th.webp'].map((value,i)=>({id:'icono'+i,label:'Miniatura de portada '+(i+1),type:'image',value}))
];
export function applyAppearance(doc,values){
  for(const f of appearanceFields){
    const v=values[f.id];if(typeof v!=='string')continue;
    if(f.type==='select'&&Object.hasOwn(fonts,v))doc.documentElement.style.setProperty('--'+f.id,fonts[v]);
    if(f.type==='color'&&/^#[0-9a-f]{6}$/i.test(v))doc.documentElement.style.setProperty('--'+f.id,v);
    if(f.type==='image'&&hrefSeguro(v,true)){
      const icon=doc.querySelectorAll('.hero-note i')[Number(f.id.slice(-1))];if(icon)icon.style.backgroundImage='url('+JSON.stringify(new URL(v,doc.baseURI).href)+')';
    }
  }
}
