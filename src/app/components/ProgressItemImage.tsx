'use client';
import {useState} from 'react';
type Row=Record<string,any>;
export function progressItemImage(job:Row,styles:Row[],variants:Row[]):string{
 const norm=(v:unknown)=>String(v||'').trim().toLowerCase();
 let matches=job.item_style_id?styles.filter(s=>s.id===job.item_style_id):styles.filter(s=>s.linked_job_card_id===job.id||s.job_card_no===job.job_card_no);
 if(!job.item_style_id&&!matches.length)matches=styles.filter(s=>[job.design_code,job.style_en].some(k=>norm(k)&&[s.style_no,s.design_code].some(v=>norm(v)===norm(k))));
 if(matches.length!==1)return '';
 const style=matches[0];const rows=variants.filter(v=>v.style_id===style.id);
 const colors=(Array.isArray(job.colors)?job.colors:[]).map(norm).filter(Boolean);
 const exact=colors.length===1?rows.filter(v=>norm(v.colour_normalized||v.colour)===colors[0]):[];
 if(exact.length===1&&exact[0].variant_image_url)return exact[0].variant_image_url;
 if(style.primary_image_url)return style.primary_image_url;
 if(rows.length===1&&(!colors.length||exact.length===1))return rows[0].variant_image_url||'';
 return '';
}
export default function ProgressItemImage({src,name}:{src:string;name:string}){
 const [failed,setFailed]=useState('');
 return <div className="w-16 h-20 sm:w-20 sm:h-24 shrink-0 rounded-lg border bg-slate-50 overflow-hidden flex items-center justify-center">{src&&failed!==src?<img src={src} alt={name} width={80} height={96} loading="lazy" decoding="async" className="w-full h-full object-contain" onError={()=>setFailed(src)}/>:<span className="text-[10px] text-center text-muted-foreground px-1">No image</span>}</div>;
}
