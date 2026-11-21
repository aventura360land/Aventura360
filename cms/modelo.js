export const themeFields = {
  deep:['Verde principal','#062d2b'], water:['Verde secundario','#0d5a52'], aqua:['Turquesa','#19a092'],
  orange:['Botones y acentos','#ef7b27'], paper:['Fondo claro','#fffdf8'], ink:['Texto principal','#10211e'],
  sand:['Fondo alternativo','#f6f0e4'], muted:['Texto secundario','#51605d']
};
export const blockTypes = {
  texto:['Texto',{titulo:'',texto:''}], imagen:['Imagen',{src:'',alt:'',pie:''}],
  video:['Video',{src:'',poster:'',pie:''}], galeria:['Galería',{fotos:[{src:'',alt:''}]}],
  lista:['Lista',{titulo:'',elementos:['']}], boton:['Botón',{etiqueta:'',enlace:''}],
  paquete:['Paquete turístico',{titulo:'',descripcion:'',precio:'',duracion:'',incluye:[''],imagen:'',alt:'',etiqueta:'Reservar',enlace:''}]
};
export const reviewCopy = {
  gracias:'¡Gracias! Recibimos tu reseña. Aparecerá aquí cuando Xebax la revise.',
  incompleta:'Escribe un nombre y una reseña.', enviando:'Enviando…', vacia:'Aún no hay reseñas publicadas.',
  error:'No pudimos cargar las reseñas.', reintentar:'Volver a intentar', proximamente:'Las reseñas estarán disponibles próximamente.',
  promedio:'{promedio} de 5 · {total} {unidad}', singular:'reseña', plural:'reseñas', escala:'{valor} de 5 estrellas'
};
export function hrefSeguro(input, medio=false) {
  if(typeof input!=='string' || !input.trim()) return '';
  const value=input.trim();
  try {
    const url=new URL(value,document.baseURI);
    const protocols=medio?['http:','https:']:['http:','https:','mailto:','tel:'];
    return protocols.includes(url.protocol) && !url.username && !url.password ? value : '';
  }catch{return '';}
}
export function slugify(input) {
  return String(input).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
}
// Asigna claves reproducibles a los bloques anteriores al editor de disposición.
function ownersWithKeys(rows){
  return (Array.isArray(rows)?rows:[]).map(owner=>{
    const used=new Set();
    const blocks=(owner.blocks||[]).map((block,i)=>{
      if(typeof block.blockId==='string'&&block.blockId&&!used.has(block.blockId)){
        used.add(block.blockId);return block;
      }
      let key='original-'+i;
      while(used.has(key))key+='-';
      used.add(key);return {...block,blockId:key};
    });
    return {...owner,blocks};
  });
}
export function copyBlock(block){return {...structuredClone(block),blockId:idNuevo()};}
export function createState(raw={}) {
  return { ...raw, template:{values:{},sections:{},collections:{},...raw.template},
    theme:{...raw.theme}, reviews:{...raw.reviews}, pages:ownersWithKeys(raw.pages),
    extras:ownersWithKeys(raw.extras) };
}
export function nombre(key){
  const labels={src:'Archivo',alt:'Descripción accesible',poster:'Portada del video',url:'Enlace',portrait:'Formato vertical',label:'Etiqueta',whatsapp:'WhatsApp',titulo:'Título',descripcion:'Descripción',duracion:'Duración',boton:'Botón',categoria:'Categoría',caracteristicas:'Características',etiqueta:'Texto del botón',accion:'Acción',id:'Identificador',incluye:'Incluye',pie:'Pie de imagen o video',precio:'Precio',texto:'Texto',imagen:'Imagen',menu:'Mostrar en el menú',srcset:'Tamaños alternativos',servicios:'Fichas de servicios',mapa:'Puntos del mapa',asistente:'Asistente de la web',interfaz:'Mensajes de la interfaz'};
  if(labels[key]) return labels[key];
  const spaced=String(key).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').toLowerCase();
  return spaced[0]?.toUpperCase()+spaced.slice(1);
}
export function idNuevo(){return crypto.randomUUID();}
