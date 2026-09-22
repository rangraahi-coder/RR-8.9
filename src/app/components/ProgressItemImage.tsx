'use client';
import {useState} from 'react';
type Row=Record<string,any>;
import {progressItemMedia} from '@/lib/progressItemMedia';
export function progressItemImage(job:Row,styles:Row[],variants:Row[]):string{return progressItemMedia(job,styles,variants).image;}
export default function ProgressItemImage({src,name}:{src:string;name:string}){
 const [failed,setFailed]=useState('');
 return <div className="w-16 h-20 sm:w-20 sm:h-24 shrink-0 rounded-lg border bg-slate-50 overflow-hidden flex items-center justify-center">{src&&failed!==src?<img src={src} alt={name} width={80} height={96} loading="lazy" decoding="async" className="w-full h-full object-contain" onError={()=>setFailed(src)}/>:<span className="text-[10px] text-center text-muted-foreground px-1">No image</span>}</div>;
}
