'use client';
import {Fragment,useState,type ReactNode} from 'react';
import {ChevronDown,ChevronRight} from 'lucide-react';
import {voucherReportGroups} from '@/lib/voucherReportGroups';
type Row=Record<string,any>;
/** Renders valid table rows; retains the existing voucher row/actions unchanged. */
export default function VoucherReportRows<T extends Row>({rows,jobs=[],sources=[],columns,children}:{rows:T[];jobs?:Row[];sources?:Row[];columns:number;children:(row:T,index:number)=>ReactNode}){
 const [open,setOpen]=useState<Set<string>>(new Set());
 const toggle=(key:string)=>setOpen(prev=>{const next=new Set(prev);next.has(key)?next.delete(key):next.add(key);return next;});
 const heading=(key:string,label:string,count:number,nested=false)=><tr className={nested?'bg-muted/10':'bg-muted/30'}><td colSpan={columns} className="p-0"><button type="button" aria-expanded={open.has(key)} onClick={()=>toggle(key)} className={`flex w-full items-center gap-2 text-left py-3 pr-4 ${nested?'pl-8':'pl-4'}`}>{open.has(key)?<ChevronDown size={16} className="shrink-0"/>:<ChevronRight size={16} className="shrink-0"/>}<span className="font-semibold break-words">{label}</span><span className="text-xs text-muted-foreground">{count} entries</span></button></td></tr>;
 return <><tr><td colSpan={columns} className="px-4 py-2 text-xs text-muted-foreground">Item → Job Card → Entries · Current filters apply</td></tr>{voucherReportGroups(rows,jobs,sources).map(([key,item])=><Fragment key={key}>{heading(key,item.name,item.count)}{open.has(key)&&[...item.jobs].map(([jobKey,job])=>{const nested=JSON.stringify([key,jobKey]);return <Fragment key={jobKey}>{heading(nested,job.name,job.rows.length,true)}{open.has(nested)&&job.rows.map(({row,index})=><Fragment key={row.id||index}>{children(row,index)}</Fragment>)}</Fragment>;})}</Fragment>)}</>;
}
