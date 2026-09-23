export type NavigableIssue={message:string;target?:HTMLElement;path?:string;record?:{table:string;id:string;label:string}};
export function reportFieldIssue(message:string,target:HTMLElement|null){
 window.dispatchEvent(new CustomEvent('erp-request-error',{detail:{message,target:target||undefined,path:window.location.pathname}}));
}
export function focusIssue(target:HTMLElement){
 for(let p=target.parentElement;p;p=p.parentElement)if(p instanceof HTMLDetailsElement)p.open=true;
 target.scrollIntoView({behavior:'smooth',block:'center'});
 target.focus({preventScroll:true});
 target.animate([{outline:'3px solid #ec4899'},{outline:'3px solid transparent'}],{duration:1800});
}
