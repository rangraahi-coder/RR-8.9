'use client';
import React, { useState,useEffect,useCallback,useRef } from 'react';
import { Plus, X, CheckCircle2, Wrench } from 'lucide-react';
import { StitchingEntry, QCEntry, FinishingEntry } from '../data/productionData';
import {cuttingService} from '@/lib/services/cuttingService';
import {loadLegacyWorkflow,saveLegacyWorkflow} from '@/lib/services/legacyWorkflowService';
import {useRealtimeTable} from '@/lib/hooks/useRealtimeTable';
import {toast} from 'sonner';

interface ProductionWorkflowContentProps {
  lang?: 'en' | 'hi';
}

type ActiveStage = 'stitching' | 'qc' | 'finishing';

export default function ProductionWorkflowContent({ lang = 'en' }: ProductionWorkflowContentProps) {
  const saveRef=useRef(false);
  const [CUTTING_ENTRIES,setCuttingEntries]=useState<Awaited<ReturnType<typeof cuttingService.getAll>>>([]);
  const load=useCallback(async()=>{try{const [data,cutting]=await Promise.all([loadLegacyWorkflow(),cuttingService.getAll()]);setStitchingEntries(data.stitching);setQcEntries(data.qc);setFinishingEntries(data.finishing);setCuttingEntries(cutting);}catch(e){toast.error((e as Error).message||'Workflow data unavailable',{id:'workflow-load'});}},[]);
  useEffect(()=>{void load();},[load]);
  useRealtimeTable('stitching_entries',load);useRealtimeTable('qc_entries',load);useRealtimeTable('finishing_entries',load);useRealtimeTable('cutting_entries',load);
  const persist=async(kind:'stitching'|'qc'|'finishing',entry:StitchingEntry|QCEntry|FinishingEntry)=>{if(saveRef.current)return false;saveRef.current=true;try{await saveLegacyWorkflow(kind,entry);await load();return true;}catch(e){toast.error((e as Error).message||'Save failed');return false;}finally{saveRef.current=false;}};
  const [activeStage, setActiveStage] = useState<ActiveStage>('stitching');
  const [stitchingEntries, setStitchingEntries] = useState<StitchingEntry[]>([]);
  const [qcEntries, setQcEntries] = useState<QCEntry[]>([]);
  const [finishingEntries, setFinishingEntries] = useState<FinishingEntry[]>([]);
  const [showModal, setShowModal] = useState(false);

  const [stitchForm, setStitchForm] = useState({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', contractor: '', piecesReceived: '', piecesCompleted: '', stitchingDefects: '', productionLoss: '', remarks: '' });
  const [qcForm, setQcForm] = useState({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', inspector: '', piecesReceived: '', piecesPass: '', piecesRejected: '', piecesRework: '', rejectionReason: '', reworkReason: '', remarks: '' });
  const [finishForm, setFinishForm] = useState({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', contractor: '', piecesReceived: '', piecesCompleted: '', finishingLoss: '', remarks: '' });

  const stages = [
    { id: 'stitching' as ActiveStage, label: 'Stitching', icon: <Wrench size={14} />, color: 'bg-blue-100 text-blue-700' },
    { id: 'qc' as ActiveStage, label: 'Quality Control', icon: <CheckCircle2 size={14} />, color: 'bg-green-100 text-green-700' },
    { id: 'finishing' as ActiveStage, label: 'Finishing', icon: <CheckCircle2 size={14} />, color: 'bg-purple-100 text-purple-700' },
  ];

  const handleStitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const received = parseInt(stitchForm.piecesReceived) || 0;
    const completed = parseInt(stitchForm.piecesCompleted) || 0;
    const defects = parseInt(stitchForm.stitchingDefects) || 0;
    const loss = parseInt(stitchForm.productionLoss) || 0;

    if(!stitchForm.jobCardRef||received<0||completed<0||defects<0||loss<0||completed>received||defects+loss>completed){toast.error('Check job card and stitching quantities');return;}
    // Carry sub-component details from matching cutting entry
    const matchedCutting = CUTTING_ENTRIES.find(
      (c) => c.jobCardRef === stitchForm.jobCardRef || c.styleName === stitchForm.styleName
    );

    const entry: StitchingEntry = {
      id: `st-${Date.now()}`,
      entryNo: `ST-${String(stitchingEntries.length + 1).padStart(4, '0')}`,
      date: stitchForm.date,
      jobCardRef: stitchForm.jobCardRef,
      styleName: stitchForm.styleName,
      contractor: stitchForm.contractor,
      piecesReceived: received,
      piecesCompleted: completed,
      stitchingDefects: defects,
      productionLoss: loss,
      netPiecesForQC: completed - defects - loss,
      subComponentDetails: matchedCutting?.subComponentDetails,
      status: 'completed',
      remarks: stitchForm.remarks,
    };
    if(!await persist('stitching',entry))return;
    setShowModal(false);
    setStitchForm({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', contractor: '', piecesReceived: '', piecesCompleted: '', stitchingDefects: '', productionLoss: '', remarks: '' });
  };

  const handleQCSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const received = parseInt(qcForm.piecesReceived) || 0;
    const pass = parseInt(qcForm.piecesPass) || 0;
    const rejected = parseInt(qcForm.piecesRejected) || 0;
    const rework = parseInt(qcForm.piecesRework) || 0;
    if(!qcForm.jobCardRef||received<0||pass<0||rejected<0||rework<0||pass+rejected+rework>received){toast.error('Check job card and QC quantities');return;}
    const entry: QCEntry = {
      id: `qc-${Date.now()}`,
      entryNo: `QC-${String(qcEntries.length + 1).padStart(4, '0')}`,
      date: qcForm.date,
      jobCardRef: qcForm.jobCardRef,
      styleName: qcForm.styleName,
      inspector: qcForm.inspector,
      piecesReceived: received,
      piecesPass: pass,
      piecesRejected: rejected,
      piecesRework: rework,
      rejectionReason: qcForm.rejectionReason,
      reworkReason: qcForm.reworkReason,
      netPiecesForFinishing: pass,
      status: 'completed',
      remarks: qcForm.remarks,
    };
    if(!await persist('qc',entry))return;
    setShowModal(false);
    setQcForm({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', inspector: '', piecesReceived: '', piecesPass: '', piecesRejected: '', piecesRework: '', rejectionReason: '', reworkReason: '', remarks: '' });
  };

  const handleFinishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const received = parseInt(finishForm.piecesReceived) || 0;
    const completed = parseInt(finishForm.piecesCompleted) || 0;
    const loss = parseInt(finishForm.finishingLoss) || 0;
    if(!finishForm.jobCardRef||received<0||completed<0||loss<0||completed>received||loss>completed){toast.error('Check job card and finishing quantities');return;}
    const entry: FinishingEntry = {
      id: `fin-${Date.now()}`,
      entryNo: `FIN-${String(finishingEntries.length + 1).padStart(4, '0')}`,
      date: finishForm.date,
      jobCardRef: finishForm.jobCardRef,
      styleName: finishForm.styleName,
      contractor: finishForm.contractor,
      piecesReceived: received,
      piecesCompleted: completed,
      finishingLoss: loss,
      netFinishedPieces: completed - loss,
      status: 'completed',
      remarks: finishForm.remarks,
    };
    if(!await persist('finishing',entry))return;
    setShowModal(false);
    setFinishForm({ date: new Date().toISOString().split('T')[0], jobCardRef: '', styleName: '', contractor: '', piecesReceived: '', piecesCompleted: '', finishingLoss: '', remarks: '' });
  };

  const totalStitched = stitchingEntries.reduce((s, e) => s + e.netPiecesForQC, 0);
  const totalQCPass = qcEntries.reduce((s, e) => s + e.piecesPass, 0);
  const totalQCReject = qcEntries.reduce((s, e) => s + e.piecesRejected, 0);
  const totalFinished = finishingEntries.reduce((s, e) => s + e.netFinishedPieces, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Production Workflow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Stitching → Quality Control → Finishing — Steps 5, 6 & 7</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={14} />
          New {activeStage === 'stitching' ? 'Stitching' : activeStage === 'qc' ? 'QC' : 'Finishing'} Entry
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Stitched (Net)</p>
          <p className="text-2xl font-700 text-blue-600 mt-1">{totalStitched.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces for QC</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">QC Pass</p>
          <p className="text-2xl font-700 text-success mt-1">{totalQCPass.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces approved</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">QC Rejected</p>
          <p className="text-2xl font-700 text-danger mt-1">{totalQCReject.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Pieces rejected</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Finished Goods</p>
          <p className="text-2xl font-700 text-purple-600 mt-1">{totalFinished.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted-foreground">Ready for dispatch</p>
        </div>
      </div>

      {/* Stage Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-600 transition-colors border-b-2 ${
                activeStage === stage.id ? 'border-primary text-primary bg-primary/5' : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {stage.icon}
              {stage.label}
            </button>
          ))}
        </div>

        {/* Stitching Table */}
        {activeStage === 'stitching' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Contractor</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Completed</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Defects</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Loss</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">For QC</th>
                </tr>
              </thead>
              <tbody>
                {stitchingEntries.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-16 text-muted-foreground"><Wrench size={36} className="mx-auto mb-3 opacity-20" /><p className="text-sm font-500">No stitching entries yet</p></td></tr>
                ) : (
                  stitchingEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-600 text-primary text-xs">{e.entryNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.date}</td>
                      <td className="px-4 py-3"><div className="font-500 text-foreground">{e.styleName}</div>{e.jobCardRef && <div className="text-xs text-muted-foreground">JC: {e.jobCardRef}</div>}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{e.contractor}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{e.piecesReceived}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{e.piecesCompleted}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{e.stitchingDefects}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{e.productionLoss}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{e.netPiecesForQC}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* QC Table */}
        {activeStage === 'qc' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Inspector</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Pass ✓</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Rejected ✗</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Rework ↺</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">For Finishing</th>
                </tr>
              </thead>
              <tbody>
                {qcEntries.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-16 text-muted-foreground"><CheckCircle2 size={36} className="mx-auto mb-3 opacity-20" /><p className="text-sm font-500">No QC entries yet</p></td></tr>
                ) : (
                  qcEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-600 text-primary text-xs">{e.entryNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.date}</td>
                      <td className="px-4 py-3"><div className="font-500 text-foreground">{e.styleName}</div>{e.jobCardRef && <div className="text-xs text-muted-foreground">JC: {e.jobCardRef}</div>}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{e.inspector}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{e.piecesReceived}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{e.piecesPass}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{e.piecesRejected}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-warning">{e.piecesRework}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{e.netPiecesForFinishing}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Finishing Table */}
        {activeStage === 'finishing' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Entry No</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Style / Job Card</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Contractor</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Received</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Completed</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Finishing Loss</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground">Net Finished</th>
                </tr>
              </thead>
              <tbody>
                {finishingEntries.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-muted-foreground"><CheckCircle2 size={36} className="mx-auto mb-3 opacity-20" /><p className="text-sm font-500">No finishing entries yet</p></td></tr>
                ) : (
                  finishingEntries.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-600 text-primary text-xs">{e.entryNo}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.date}</td>
                      <td className="px-4 py-3"><div className="font-500 text-foreground">{e.styleName}</div>{e.jobCardRef && <div className="text-xs text-muted-foreground">JC: {e.jobCardRef}</div>}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{e.contractor}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{e.piecesReceived}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">{e.piecesCompleted}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-danger">{e.finishingLoss}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-700 text-success">{e.netFinishedPieces}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">
                New {activeStage === 'stitching' ? 'Stitching' : activeStage === 'qc' ? 'QC Inspection' : 'Finishing'} Entry
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>

            {/* Stitching Form */}
            {activeStage === 'stitching' && (
              <form onSubmit={handleStitchSubmit} className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Date *</label><input type="date" required value={stitchForm.date} onChange={(e) => setStitchForm({ ...stitchForm, date: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Job Card Ref</label><input type="text" placeholder="JC-0001" value={stitchForm.jobCardRef} onChange={(e) => setStitchForm({ ...stitchForm, jobCardRef: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Style Name *</label><input type="text" required placeholder="Style name" value={stitchForm.styleName} onChange={(e) => setStitchForm({ ...stitchForm, styleName: e.target.value })} className="input-field text-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Contractor *</label><input type="text" required placeholder="Contractor name" value={stitchForm.contractor} onChange={(e) => setStitchForm({ ...stitchForm, contractor: e.target.value })} className="input-field text-sm" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Pieces Received *</label><input type="number" required min="0" placeholder="0" value={stitchForm.piecesReceived} onChange={(e) => setStitchForm({ ...stitchForm, piecesReceived: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Pieces Completed *</label><input type="number" required min="0" placeholder="0" value={stitchForm.piecesCompleted} onChange={(e) => setStitchForm({ ...stitchForm, piecesCompleted: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Stitching Defects</label><input type="number" min="0" placeholder="0" value={stitchForm.stitchingDefects} onChange={(e) => setStitchForm({ ...stitchForm, stitchingDefects: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Production Loss</label><input type="number" min="0" placeholder="0" value={stitchForm.productionLoss} onChange={(e) => setStitchForm({ ...stitchForm, productionLoss: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Remarks</label><textarea rows={2} placeholder="Optional notes..." value={stitchForm.remarks} onChange={(e) => setStitchForm({ ...stitchForm, remarks: e.target.value })} className="input-field text-sm resize-none" /></div>
                <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Save Entry</button></div>
              </form>
            )}

            {/* QC Form */}
            {activeStage === 'qc' && (
              <form onSubmit={handleQCSubmit} className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Date *</label><input type="date" required value={qcForm.date} onChange={(e) => setQcForm({ ...qcForm, date: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Job Card Ref</label><input type="text" placeholder="JC-0001" value={qcForm.jobCardRef} onChange={(e) => setQcForm({ ...qcForm, jobCardRef: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Style Name *</label><input type="text" required placeholder="Style name" value={qcForm.styleName} onChange={(e) => setQcForm({ ...qcForm, styleName: e.target.value })} className="input-field text-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Inspector Name *</label><input type="text" required placeholder="QC Inspector" value={qcForm.inspector} onChange={(e) => setQcForm({ ...qcForm, inspector: e.target.value })} className="input-field text-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Pieces Received *</label><input type="number" required min="0" placeholder="0" value={qcForm.piecesReceived} onChange={(e) => setQcForm({ ...qcForm, piecesReceived: e.target.value })} className="input-field text-sm" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-success">Pass ✓</label><input type="number" min="0" placeholder="0" value={qcForm.piecesPass} onChange={(e) => setQcForm({ ...qcForm, piecesPass: e.target.value })} className="input-field text-sm border-success-border" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-danger">Rejected ✗</label><input type="number" min="0" placeholder="0" value={qcForm.piecesRejected} onChange={(e) => setQcForm({ ...qcForm, piecesRejected: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-warning">Rework ↺</label><input type="number" min="0" placeholder="0" value={qcForm.piecesRework} onChange={(e) => setQcForm({ ...qcForm, piecesRework: e.target.value })} className="input-field text-sm" /></div>
                </div>
                {(parseInt(qcForm.piecesRejected) || 0) > 0 && (
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Rejection Reason</label><input type="text" placeholder="e.g. Stitching defect, size issue" value={qcForm.rejectionReason} onChange={(e) => setQcForm({ ...qcForm, rejectionReason: e.target.value })} className="input-field text-sm" /></div>
                )}
                {(parseInt(qcForm.piecesRework) || 0) > 0 && (
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Rework Reason</label><input type="text" placeholder="e.g. Minor stitching fix needed" value={qcForm.reworkReason} onChange={(e) => setQcForm({ ...qcForm, reworkReason: e.target.value })} className="input-field text-sm" /></div>
                )}
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Remarks</label><textarea rows={2} placeholder="Optional notes..." value={qcForm.remarks} onChange={(e) => setQcForm({ ...qcForm, remarks: e.target.value })} className="input-field text-sm resize-none" /></div>
                <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Save QC Entry</button></div>
              </form>
            )}

            {/* Finishing Form */}
            {activeStage === 'finishing' && (
              <form onSubmit={handleFinishSubmit} className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Date *</label><input type="date" required value={finishForm.date} onChange={(e) => setFinishForm({ ...finishForm, date: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Job Card Ref</label><input type="text" placeholder="JC-0001" value={finishForm.jobCardRef} onChange={(e) => setFinishForm({ ...finishForm, jobCardRef: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Style Name *</label><input type="text" required placeholder="Style name" value={finishForm.styleName} onChange={(e) => setFinishForm({ ...finishForm, styleName: e.target.value })} className="input-field text-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Contractor *</label><input type="text" required placeholder="Contractor name" value={finishForm.contractor} onChange={(e) => setFinishForm({ ...finishForm, contractor: e.target.value })} className="input-field text-sm" /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Pieces Received *</label><input type="number" required min="0" placeholder="0" value={finishForm.piecesReceived} onChange={(e) => setFinishForm({ ...finishForm, piecesReceived: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Pieces Completed *</label><input type="number" required min="0" placeholder="0" value={finishForm.piecesCompleted} onChange={(e) => setFinishForm({ ...finishForm, piecesCompleted: e.target.value })} className="input-field text-sm" /></div>
                  <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Finishing Loss</label><input type="number" min="0" placeholder="0" value={finishForm.finishingLoss} onChange={(e) => setFinishForm({ ...finishForm, finishingLoss: e.target.value })} className="input-field text-sm" /></div>
                </div>
                <div className="flex flex-col gap-1.5"><label className="text-xs font-600 text-muted-foreground">Remarks</label><textarea rows={2} placeholder="Optional notes..." value={finishForm.remarks} onChange={(e) => setFinishForm({ ...finishForm, remarks: e.target.value })} className="input-field text-sm resize-none" /></div>
                <div className="flex gap-3 pt-2"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button><button type="submit" className="btn-primary flex-1">Save Entry</button></div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
