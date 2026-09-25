export type NavigableIssue={message:string;target?:HTMLElement;path?:string;record?:{table:string;id:string;label:string}};
const marked=new WeakMap<HTMLElement,()=>void>();
function visibleTarget(target:HTMLElement){return target.matches('select[aria-hidden="true"]')&&target.nextElementSibling instanceof HTMLButtonElement?target.nextElementSibling:target;}
export function markIssue(source:HTMLElement){
 const target=visibleTarget(source);
 if(marked.has(target))return;
 const outline=target.style.outline,offset=target.style.outlineOffset,invalid=target.getAttribute('aria-invalid');
 target.style.outline='2px solid #dc2626';target.style.outlineOffset='2px';target.setAttribute('aria-invalid','true');
 const clear=()=>{target.style.outline=outline;target.style.outlineOffset=offset;if(invalid===null)target.removeAttribute('aria-invalid');else target.setAttribute('aria-invalid',invalid);target.removeEventListener('input',clear);target.removeEventListener('change',clear);source.removeEventListener('change',clear);marked.delete(target);};
 marked.set(target,clear);target.addEventListener('input',clear);target.addEventListener('change',clear);source.addEventListener('change',clear);
}
export function reportFieldIssue(message:string,target:HTMLElement|null){
 if(target)markIssue(target);
 window.dispatchEvent(new CustomEvent('erp-request-error',{detail:{message,target:target||undefined,path:window.location.pathname}}));
}
export function focusIssue(source:HTMLElement){
 const target=visibleTarget(source);
 for(let p=target.parentElement;p;p=p.parentElement)if(p instanceof HTMLDetailsElement)p.open=true;
 markIssue(target);
 if(!target.matches('input,select,textarea,button,a,[tabindex]'))target.tabIndex=-1;
 target.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});target.focus({preventScroll:true});
}
