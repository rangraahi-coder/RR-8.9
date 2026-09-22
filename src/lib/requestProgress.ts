// Module-level state retains requests started before the status component mounts.
let reads=0,writes=0;
let state={reads,writes};
const blockRepeat=(event:Event)=>{if(writes>0){event.preventDefault();event.stopImmediatePropagation();}};
const listeners=new Set<()=>void>();
export const subscribeProgress=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export const getProgress=()=>state;
export const emptyProgress={reads:0,writes:0};
export function beginRequest(write:boolean){
 if(write){writes++;if(writes===1&&typeof document!=='undefined'){document.addEventListener('click',blockRepeat,true);document.addEventListener('submit',blockRepeat,true);}}else reads++;
 const emit=()=>{state={reads,writes};listeners.forEach(fn=>fn());};emit();
 let done=false;return()=>{if(done)return;done=true;if(write){writes--;if(writes===0&&typeof document!=='undefined'){document.removeEventListener('click',blockRepeat,true);document.removeEventListener('submit',blockRepeat,true);}}else reads--;emit();};
}
