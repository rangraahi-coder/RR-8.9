'use client';
import { useRef, useState } from 'react';
import { erpErrorMessage } from '@/lib/erpError';

export interface DeleteRecordSummary { id: string; reference: string; details: string; }

/** Targets are a snapshot taken when the user opens the dialog. */
export default function RecordDeleteDialog({ records, lang, onCancel, onConfirm }: {
  records: DeleteRecordSummary[];
  lang: 'en' | 'hi';
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function confirm() {
    if (inFlight.current || confirmation !== 'DELETE' || !records.length) return;
    inFlight.current = true; setBusy(true); setError(null);
    try { await onConfirm(); }
    catch (e) { setError(erpErrorMessage(e)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="record-delete-title" className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-card border border-border p-5 shadow-2xl">
      <h2 id="record-delete-title" className="font-bold text-lg">{lang === 'hi' ? 'इन एंट्रीज़ को हटाएं?' : 'Delete these records?'}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{lang === 'hi' ? 'नीचे हर एंट्री की पहचान जाँच लें। हटाना स्थायी है।' : 'Check each record below. Deletion is permanent.'}</p>
      <ul className="my-4 space-y-2 max-h-60 overflow-y-auto">
        {records.map(r => <li key={r.id} className="rounded-lg border border-border p-3 text-sm break-words">
          <strong>{r.reference}</strong><p>{r.details}</p><p className="text-xs text-muted-foreground">Entry ID: {r.id}</p>
        </li>)}
      </ul>
      <label className="block text-sm" htmlFor="delete-confirmation">{lang === 'hi' ? 'पुष्टि के लिए DELETE लिखें' : 'Type DELETE to confirm'} ({records.length})</label>
      <input id="delete-confirmation" autoComplete="off" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background p-3" />
      {error && <p role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 break-words">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy} onClick={onCancel} className="btn-secondary disabled:opacity-50">{lang === 'hi' ? 'रद्द करें' : 'Cancel'}</button>
        <button type="button" disabled={busy || confirmation !== 'DELETE' || !records.length} onClick={() => void confirm()} className="rounded-lg bg-red-600 px-4 py-2 text-white disabled:opacity-50">{busy ? (lang === 'hi' ? 'हटाया जा रहा है…' : 'Deleting…') : (lang === 'hi' ? 'स्थायी रूप से हटाएं' : 'Delete permanently')}</button>
      </div>
    </section>
  </div>;
}
