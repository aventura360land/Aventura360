import {configured,request,listReviews,submitReview,element,reviewCard} from './api.js';
import {reviewCopy} from '../cms/modelo.js';
await window.xebaxReady;
const copy=window.xebaxReviewCopy||reviewCopy;
const preview=new URLSearchParams(location.search).has('borrador') && window.parent!==window;
const form=document.querySelector('#xr-form'), summary=document.querySelector('#xr-summary');
const stars=document.querySelector('#xr-stars'), list=document.querySelector('#xr-list');
const more=document.querySelector('#xr-more'), notice=document.querySelector('#xr-notice');
const submit=form.querySelector('[type=submit]');
const moreLabel=more.textContent;
let next=null, submission=null;
function paint(value) {
  for(const label of stars.children){
    const selected=Number(label.firstChild.value)<=value;
    label.lastChild.textContent=selected?'★':'☆';
    label.classList.toggle('selected',selected);
  }
}
for(let n=1;n<=5;n++) {
  const label=element('label'), radio=element('input');
  Object.assign(radio,{name:'stars',type:'radio',value:String(n),required:true});
  radio.setAttribute('aria-label',copy.escala.replace('{valor}',n));
  label.append(radio,element('span','☆'));stars.append(label);
}
stars.onchange=()=>paint(Number(form.elements.stars.value));
form.oninput=()=>{submission=null;notice.textContent='';};
form.onsubmit=async e=>{
  e.preventDefault();if(submit.disabled)return;
  if(preview){notice.textContent='La vista previa no envía reseñas.';return;}
  const values=new FormData(form);
  const name=values.get('name').trim(),comment=values.get('comment').trim();
  if(!name||!comment){notice.textContent=copy.incompleta;return;}
  submission??=crypto.randomUUID();
  submit.disabled=true;notice.textContent=copy.enviando;
  try{
    await submitReview({name,stars:Number(values.get('stars')),comment,submission});
    form.reset();paint(0);submission=null;
    notice.textContent=copy.gracias;
  }catch(error){notice.textContent=error.message;}finally{submit.disabled=false;}
};
async function load(){
  more.disabled=true;
  try{
    const [page,stats]=await Promise.all([listReviews('published',next),next?null:request('/rest/v1/rpc/xebax_review_summary',{method:'POST',body:{}})]);
    if(!next){
      list.replaceChildren();
      const {total,average}=stats[0];
      summary.textContent=total?copy.promedio.replace('{promedio}',new Intl.NumberFormat('es-CO').format(average)).replace('{total}',total).replace('{unidad}',Number(total)===1?copy.singular:copy.plural):copy.vacia;
    }
    list.append(...page.items.map(reviewCard));next=page.next;more.hidden=!next;more.textContent=moreLabel;
  }catch(error){if(!next)summary.textContent=copy.error;more.hidden=false;more.textContent=copy.reintentar;}
  finally{more.disabled=false;}
}
more.onclick=load;
if(configured){submit.disabled=false;load();}
else{form.hidden=true;summary.textContent=copy.proximamente;}
