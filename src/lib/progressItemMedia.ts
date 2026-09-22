type Row=Record<string,any>;
const norm=(v:unknown)=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const label=(v:unknown)=>norm(v).replace(/\s*[–—-]\s*/g,' - ');
const safe=(v:unknown)=>typeof v==='string'&&/^https?:\/\//i.test(v)?v:'';
/** Resolve stable links first; legacy display names must match exactly and uniquely. */
export function progressItemMedia(job:Row,styles:Row[],variants:Row[]){
 let matches:Row[]=[];
 const linkedVariants=variants.filter(v=>job.item_variant_id?v.id===job.item_variant_id:v.linked_job_card_id&&v.linked_job_card_id===job.id);
 if(job.item_style_id)matches=styles.filter(s=>s.id===job.item_style_id);
 else if(linkedVariants.length)matches=styles.filter(s=>linkedVariants.some(v=>v.style_id===s.id));
 else matches=styles.filter(s=>(s.linked_job_card_id&&s.linked_job_card_id===job.id)||(job.job_card_no&&s.job_card_no===job.job_card_no));
 if(!matches.length&&!job.item_style_id&&!linkedVariants.length){
  matches=styles.filter(s=>[s.style_no,s.design_code,s.item_name].some(v=>norm(v)&&[job.design_code,job.style_en].some(k=>norm(k)===norm(v)))||variants.some(v=>v.style_id===s.id&&[s.style_no,s.item_name,v.style_no].some(n=>norm(n)&&norm(v.colour)&&label(`${n} - ${v.colour}`)===label(job.style_en))));
 }
 const style=matches.length===1?matches[0]:null;
 if(!style)return {style:null,image:'',sheets:[] as {id:string;colour:string;url:string}[],problem:matches.length>1?'Item link is ambiguous. Open Item Master to review.':'Item link unavailable.'};
 const rows=variants.filter(v=>v.style_id===style.id);
 const colours=(Array.isArray(job.colors)?job.colors:[]).map((c:any)=>norm(typeof c==='object'?c.name||c.colour||c.color:c)).filter(Boolean);
 let selected=linkedVariants.filter(v=>v.style_id===style.id);
 if(!selected.length&&colours.length)selected=rows.filter(v=>colours.includes(norm(v.colour_normalized||v.colour)));
 if(!selected.length&&!colours.length)selected=rows.filter(v=>[style.style_no,style.item_name,v.style_no].some(n=>norm(n)&&norm(v.colour)&&label(`${n} - ${v.colour}`)===label(job.style_en)));
 if(!selected.length&&!colours.length)selected=rows;
 const image=(selected.length===1?safe(selected[0].variant_image_url):'')||safe(style.primary_image_url)||(selected.length>1?safe([...selected].sort((a,b)=>String(a.colour||'').localeCompare(String(b.colour||''))).find(v=>safe(v.variant_image_url))?.variant_image_url):'');
 const sheets=selected.filter(v=>safe(v.measurement_sheet_url)).map(v=>({id:v.id,colour:v.colour||'Item',url:safe(v.measurement_sheet_url)}));
 return {style,image,sheets,problem:''};
}
