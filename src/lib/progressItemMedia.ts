type Row=Record<string,any>;
const norm=(v:unknown)=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const label=(v:unknown)=>norm(v).replace(/\s*[–—-]\s*/g,' - ');
const safe=(v:unknown)=>typeof v==='string'&&/^https?:\/\//i.test(v.trim())?v.trim():'';
const same=(a:unknown,b:unknown)=>!!norm(a)&&!!norm(b)&&label(a)===label(b);
/** Stable IDs first, then unique full item identity; never borrow another colour's media. */
export function progressItemMedia(job:Row,styles:Row[],variants:Row[]){
 const empty=(problem:string)=>({style:null,image:'',sheets:[] as {id:string;colour:string;url:string}[],problem});
 const explicitVariant=job.item_variant_id?variants.find(v=>v.id===job.item_variant_id):undefined;
 if(job.item_variant_id&&!explicitVariant)return empty('Linked item variant is unavailable. Review its Item Master link.');
 if(explicitVariant&&job.item_style_id&&explicitVariant.style_id!==job.item_style_id)return empty('Item and variant links disagree. Review the Job Card link.');
 const linkedVariants=explicitVariant?[explicitVariant]:variants.filter(v=>job.id&&v.linked_job_card_id===job.id);
 let matches:Row[]=[];
 if(job.item_style_id)matches=styles.filter(s=>s.id===job.item_style_id);
 else if(linkedVariants.length)matches=styles.filter(s=>linkedVariants.some(v=>v.style_id===s.id));
 else matches=styles.filter(s=>(job.id&&s.linked_job_card_id===job.id)||(job.job_card_no&&s.job_card_no===job.job_card_no));
 const fullMatch=(s:Row,display:unknown)=>[s.style_no,s.design_code,s.item_name].some(n=>same(n,display))||variants.some(v=>v.style_id===s.id&&(
   same(v.style_no,display)||[s.style_no,s.item_name,v.style_no].some(n=>norm(n)&&norm(v.colour)&&same(`${n} - ${v.colour}`,display))
 ));
 if(!matches.length&&!job.item_style_id&&!linkedVariants.length){
  // A precise colour-qualified item name outranks a shared/base design code.
  matches=styles.filter(s=>fullMatch(s,job.style_en));
  if(!matches.length)matches=styles.filter(s=>fullMatch(s,job.design_code));
 }
 const style=matches.length===1?matches[0]:null;
 if(!style)return empty(matches.length>1?'Item link is ambiguous. Open Item Master to review.':'Item link unavailable.');
 const rows=variants.filter(v=>v.style_id===style.id);
 const colours=(Array.isArray(job.colors)?job.colors:[]).map((c:any)=>norm(typeof c==='object'?c.name||c.colour||c.color:c)).filter(Boolean);
 let selected=linkedVariants.filter(v=>v.style_id===style.id);
 let problem='';
 if(!selected.length&&colours.length)selected=rows.filter(v=>colours.includes(norm(v.colour_normalized||v.colour)));
 if(!selected.length){
  const exact=rows.filter(v=>same(v.style_no,job.style_en));
  const qualified=colours.some((colour:string)=>label(job.style_en).endsWith(` - ${colour}`));
  // Imported rows can have an exact colour-qualified item code but stale colour metadata.
  // Only a unique exact variant identity qualifies; a singleton/base-code guess does not.
  if(exact.length===1&&qualified)selected=exact;
 }
 if(!selected.length&&!colours.length)selected=rows.filter(v=>[style.style_no,style.item_name,v.style_no].some(n=>norm(n)&&norm(v.colour)&&same(`${n} - ${v.colour}`,job.style_en)));
 if(!selected.length&&!colours.length)selected=rows;
 if(selected.length&&colours.length&&selected.some(v=>!colours.includes(norm(v.colour_normalized||v.colour)))){
  problem=`Attachments are from the linked/exact item variant. Its colour (${selected.map(v=>v.colour||'not recorded').join(', ')}) differs from the Job Card (${colours.join(', ')}). Review the Item Master colour.`;
 }else if(!selected.length&&colours.length){
  problem='No matching item colour link was found. Review the Item Master colour; attachments may exist on another variant.';
 }
 const image=(selected.length===1?safe(selected[0].variant_image_url):'')||safe(style.primary_image_url)||(selected.length>1?safe([...selected].sort((a,b)=>String(a.colour||'').localeCompare(String(b.colour||''))).find(v=>safe(v.variant_image_url))?.variant_image_url):'');
 const sheets=selected.filter(v=>safe(v.measurement_sheet_url)).map(v=>({id:v.id,colour:v.colour||'Item',url:safe(v.measurement_sheet_url)}));
 return {style,image,sheets,problem};
}
