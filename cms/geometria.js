export const deviceNames={desktop:'Escritorio',tablet:'Tableta',phone:'Móvil'};
const queries={
  desktop:'(width >= 1024px)',
  tablet:'(640px < width < 1024px)',
  phone:'(width <= 640px)'
};
export const geometryFields=[
  {key:'x',label:'Horizontal (X)',min:-4096,max:4096},
  {key:'y',label:'Vertical (Y)',min:-4096,max:4096},
  {key:'width',label:'Ancho',min:12,max:4096,property:'width'},
  {key:'height',label:'Alto',min:12,max:4096,property:'height'},
  {key:'fontSize',label:'Tamaño del texto',min:8,max:200,property:'font-size'}
];
const dimensions=geometryFields.filter(field=>field.property);

export function normalizeGeometry(value){
  const result={};
  for(const {key,min,max,property} of geometryFields){
    const number=value?.[key];
    if(typeof number!=='number'||!Number.isFinite(number))continue;
    const rounded=Math.round(Math.max(min,Math.min(number,max)));
    if(property||rounded)result[key]=rounded;
  }
  return result;
}

export const geometryCSS=Object.entries(queries).map(([device,query])=>{
  const prefix='x-geo-'+device;
  return `@media ${query}{
    [data-${prefix}-inline]{display:inline-block}
    [data-${prefix}-position]{translate:var(--${prefix}-position)!important}
    [data-${prefix}-width]{box-sizing:border-box;width:var(--${prefix}-width)!important;min-width:0!important;max-width:100%!important;flex-shrink:0}
    [data-${prefix}-height]{box-sizing:border-box;height:var(--${prefix}-height)!important;min-height:0!important;max-height:none!important}
    [data-${prefix}-fontsize]{font-size:var(--${prefix}-fontsize)!important}
  }`;
}).join('\n');

export function applyGeometry(node,byDevice){
  if(!byDevice&&!node.hasAttribute('data-x-geometry'))return;
  const view=node.ownerDocument.defaultView;
  // Un elemento inline necesita una caja para aceptar translate, ancho y alto.
  const isInline=node.matches('a,span,strong,small,picture')&&
    (node.hasAttribute('data-x-geometry-inline')||view?.getComputedStyle(node).display==='inline');
  let active=false;
  for(const device of Object.keys(queries)){
    const {x,y,...sizes}=normalizeGeometry(byDevice?.[device]);
    const box=Boolean(x||y||sizes.width||sizes.height);
    const prefix='x-geo-'+device+'-';
    function set(key,value){
      node.toggleAttribute('data-'+prefix+key,value!==undefined);
      if(value===undefined)node.style.removeProperty('--'+prefix+key);
      else node.style.setProperty('--'+prefix+key,value);
    }
    node.toggleAttribute('data-'+prefix+'inline',isInline&&box);
    set('position',x||y?`${x||0}px ${y||0}px`:undefined);
    for(const {key} of dimensions){
      set(key.toLowerCase(),sizes[key]===undefined?undefined:sizes[key]+'px');
    }
    active||=box||sizes.fontSize!==undefined;
  }
  node.toggleAttribute('data-x-geometry',active);
  node.toggleAttribute('data-x-geometry-inline',active&&isInline);
}
