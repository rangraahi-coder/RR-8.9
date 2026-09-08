import {supabase} from '@/lib/supabase/client';
import type {StitchingEntry,QCEntry,FinishingEntry} from '@/app/production-workflow/data/productionData';
export async function loadLegacyWorkflow(){
 const results=await Promise.all(['stitching_entries','qc_entries','finishing_entries'].map(t=>supabase.from(t).select('*').order('created_at',{ascending:false})));
 for(const r of results)if(r.error)throw r.error;
 return {
 stitching:(results[0].data??[]).map(r=>r.workflow_payload??{id:r.id,entryNo:r.entry_no,date:r.date,jobCardRef:r.job_card_ref,styleName:r.style_name,contractor:'',piecesReceived:r.total_pieces_received,piecesCompleted:r.total_pieces_stitched,stitchingDefects:r.total_rejections,productionLoss:0,netPiecesForQC:r.net_pieces_passed,status:r.status,remarks:r.remarks}) as StitchingEntry[],
 qc:(results[1].data??[]).map(r=>r.workflow_payload??{id:r.id,entryNo:r.entry_no,date:r.date,jobCardRef:r.job_card_ref,styleName:r.style_name,inspector:'',piecesReceived:r.total_pieces_received,piecesPass:r.total_pass,piecesRejected:r.total_fail,piecesRework:0,netPiecesForFinishing:r.net_passed,status:r.status,remarks:r.remarks}) as QCEntry[],
 finishing:(results[2].data??[]).map(r=>r.workflow_payload??{id:r.id,entryNo:r.entry_no,date:r.date,jobCardRef:r.job_card_ref,styleName:r.style_name,contractor:r.quality_sign_off_by??'',piecesReceived:r.total_qc_passed,piecesCompleted:r.total_finished,finishingLoss:0,netFinishedPieces:r.total_finished,status:r.status,remarks:r.remarks}) as FinishingEntry[]};
}
export async function saveLegacyWorkflow(kind:'stitching'|'qc'|'finishing',entry:StitchingEntry|QCEntry|FinishingEntry){
 const base={id:crypto.randomUUID(),entry_no:entry.entryNo,date:entry.date,job_card_ref:entry.jobCardRef,style_name:entry.styleName,status:entry.status,remarks:entry.remarks};
 let fields:Record<string,unknown>={};
 if(kind==='stitching'){const e=entry as StitchingEntry;fields={total_pieces_received:e.piecesReceived,total_pieces_stitched:e.piecesCompleted,total_rejections:e.stitchingDefects+e.productionLoss,net_pieces_passed:e.netPiecesForQC};}
 if(kind==='qc'){const e=entry as QCEntry;fields={total_pieces_received:e.piecesReceived,total_pass:e.piecesPass,total_fail:e.piecesRejected,net_passed:e.netPiecesForFinishing};}
 if(kind==='finishing'){const e=entry as FinishingEntry;fields={total_qc_passed:e.piecesReceived,total_finished:e.netFinishedPieces,packaging_status:'unpacked',sub_components:[]};}
 const {error}=await supabase.from(kind==='stitching'?'stitching_entries':kind==='qc'?'qc_entries':'finishing_entries').insert({...base,...fields,workflow_payload:{...entry,id:base.id}});if(error)throw error;window.dispatchEvent(new Event('erp-data-changed'));
}
