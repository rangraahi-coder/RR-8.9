// Payload-free notification: records are always refetched through normal permissions.
let timer: ReturnType<typeof setTimeout> | undefined;
export function notifyDataChanged() {
 if(typeof window==='undefined')return;
 if(timer)clearTimeout(timer);
 timer=setTimeout(()=>{timer=undefined;window.dispatchEvent(new CustomEvent('erp-data-changed'));},200);
}
export function notifyCommittedWrite() {
 notifyDataChanged();
 if(typeof window==='undefined'||typeof BroadcastChannel==='undefined')return;
 const channel=new BroadcastChannel('rangraahi-committed-data');
 channel.postMessage('changed');channel.close();
}
export function listenForOtherTabs() {
 if(typeof BroadcastChannel==='undefined')return ()=>{};
 const channel=new BroadcastChannel('rangraahi-committed-data');
 channel.onmessage=event=>{if(event.data==='changed')notifyDataChanged();};
 return ()=>channel.close();
}
