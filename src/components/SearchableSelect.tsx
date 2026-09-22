'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';

type Option = { value: string; text: string; group: string; disabled: boolean };
// Keep the real select for form values, required validation and native change events.
export default function SearchableSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
 const { children, className, style, onChange, onInvalid, onFocus, ...rest }=props;
 const native=useRef<HTMLSelectElement>(null),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),search=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[options,setOptions]=useState<Option[]>([]),[selected,setSelected]=useState(''),[active,setActive]=useState(0);
 const [position,setPosition]=useState({left:0,top:0,width:200,maxHeight:260});const uid=useId();
 useEffect(()=>{const el=native.current;if(!el)return;setOptions(Array.from(el.options).map(o=>({value:o.value,text:o.text,group:o.parentElement?.tagName==='OPTGROUP'?(o.parentElement as HTMLOptGroupElement).label:'',disabled:o.disabled||(o.parentElement?.tagName==='OPTGROUP'&&(o.parentElement as HTMLOptGroupElement).disabled)})));setSelected(el.value);},[children,props.value,props.defaultValue]);
 const filtered=options.filter(o=>`${o.text} ${o.group}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
 function show(){if(native.current?.matches(':disabled'))return;setQuery('');setActive(0);setOpen(true);}
 function close(){setOpen(false);trigger.current?.focus();}
 function choose(o:Option){if(o.disabled||!native.current)return;const el=native.current;el.value=o.value;el.dispatchEvent(new Event('change',{bubbles:true}));setSelected(el.value);close();}
 useEffect(()=>{if(!open)return;
  function place(){const r=trigger.current?.getBoundingClientRect();if(!r)return;const h=window.visualViewport?.height||window.innerHeight;const w=window.visualViewport?.width||window.innerWidth;const below=h-r.bottom-12;const height=Math.min(320,Math.max(below,r.top-12));setPosition({left:Math.max(8,Math.min(r.left,w-Math.min(Math.max(r.width,230),w-16)-8)),top:below>=Math.min(240,height)?r.bottom+4:Math.max(8,r.top-height-4),width:Math.min(Math.max(r.width,230),w-16),maxHeight:Math.max(100,height)});}
  function outside(e:PointerEvent){if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))setOpen(false);}
  place();search.current?.focus();document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);window.visualViewport?.addEventListener('resize',place);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);};
 },[open]);
 useEffect(()=>{if(open)document.getElementById(`${uid}-option-${active}`)?.scrollIntoView({block:'nearest'});},[active,open,uid]);
 const label=props['aria-label']||'Select option';
 return <>
  <select {...rest} id={props.id?`${props.id}--native`:undefined} ref={native} className="sr-only" tabIndex={-1} aria-hidden="true" onFocus={e=>{onFocus?.(e);trigger.current?.focus();}} onInvalid={e=>{onInvalid?.(e);e.preventDefault();show();}} onChange={e=>{setSelected(e.target.value);onChange?.(e);}}>{children}</select>
  <button id={props.id} ref={trigger} type="button" disabled={props.disabled} className={`${className||'input-field'} inline-flex items-center justify-between gap-2 max-w-full text-left`} style={style} aria-label={label} aria-labelledby={props['aria-labelledby']} aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-list`} aria-required={props.required} onClick={()=>open?close():show()} onKeyDown={e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();show();}}}>
   <span className="truncate min-w-0">{options.find(o=>o.value===selected)?.text||'Select option'}</span><ChevronDown size={14} className="shrink-0"/>
  </button>
  {open&&createPortal(<div ref={panel} className="fixed bg-card text-foreground border border-border rounded-lg shadow-xl flex flex-col overflow-hidden" style={{...position,zIndex:10000}} onClick={e=>e.stopPropagation()}>
   <div className="flex items-center gap-2 p-2 border-b border-border shrink-0"><Search size={16}/><input ref={search} role="combobox" aria-label={`Search ${label}`} aria-controls={`${uid}-list`} aria-expanded="true" aria-autocomplete="list" aria-activedescendant={filtered[active]?`${uid}-option-${active}`:undefined} placeholder="Search… / खोजें" value={query} className="w-full min-w-0 bg-transparent p-2 outline-none text-base" onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}else if(e.key==='Tab'){setOpen(false);trigger.current?.focus();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(0,Math.min(filtered.length-1,i+(e.key==='ArrowDown'?1:-1))));}else if(e.key==='Enter'){e.preventDefault();if(filtered[active])choose(filtered[active]);}}}/></div>
   <div id={`${uid}-list`} role="listbox" aria-label={label} className="overflow-y-auto min-h-0 p-1">
    {filtered.map((o,i)=><button key={`${o.value}:${i}`} id={`${uid}-option-${i}`} type="button" role="option" aria-selected={o.value===selected} disabled={o.disabled} tabIndex={-1} className={`block w-full text-left p-2 rounded whitespace-normal break-words disabled:opacity-40 ${i===active?'bg-primary/10':''} ${o.value===selected?'text-primary font-semibold':''}`} onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o)}>{o.group&&<span className="block text-xs text-muted-foreground">{o.group}</span>}{o.text}</button>)}
    {!filtered.length&&<p role="status" className="p-3 text-sm text-muted-foreground">No matching options</p>}
   </div>
  </div>,document.body)}
 </>;
}
