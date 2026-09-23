'use client';
import {progressItemMedia} from '@/lib/progressItemMedia';
import Link from 'next/link';
export default function ItemMeasurementLinks({job,styles,variants,error}:{job:Record<string,any>;styles:Record<string,any>[];variants:Record<string,any>[];error?:string}){
 const media=progressItemMedia(job,styles,variants);
 const href=media.style?`/item-master?styleId=${encodeURIComponent(media.style.id)}`:`/item-master?search=${encodeURIComponent(job.style_en||job.job_card_no||'')}`;
 return <details className="mt-2 text-xs"><summary className="cursor-pointer text-primary hover:underline">View Measurement Sheet</summary><div className="mt-2 flex flex-col gap-2 max-w-full">{!error&&media.problem&&<p className="text-amber-700">{media.problem}</p>}{error?<p role="alert">Measurement sheets could not be loaded: {error}</p>:media.sheets.length?media.sheets.map(sheet=><a key={sheet.id} href={sheet.url} target="_blank" rel="noopener noreferrer" className="text-primary underline break-words">{sheet.colour} · Open measurement sheet ↗</a>):<p className="text-muted-foreground">{media.problem?'Measurement sheet cannot be confirmed until the item/colour link is resolved.':'No measurement sheet uploaded for this item / colour.'}</p>}<Link href={href} className="text-primary underline">Open Item Master</Link></div></details>;
}
