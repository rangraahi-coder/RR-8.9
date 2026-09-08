import { supabase } from '@/lib/supabase/client';
type UpsertStylePayload = Record<string, unknown>;
type UpsertVariantPayload = Record<string, unknown>;
interface UpsertItemStyleFullResult { style_id: string; variant_ids: string[]; }

type SavePayload = { style: UpsertStylePayload; variants: UpsertVariantPayload[] };
type PendingSave = { requestId: string; payload: SavePayload };
let inFlight = false;

export class PendingItemSaveError extends Error {
  constructor(message: string) { super(message); this.name = 'PendingItemSaveError'; }
}

async function context() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in before saving an item.');
  const key = `kurtierp:original-item:create:${data.user.id}`;
  let storage: Storage;
  try {
    storage = window.sessionStorage;
    const probe = `${key}:probe`;
    storage.setItem(probe, '1'); storage.removeItem(probe);
  } catch {
    throw new Error('Browser session storage is unavailable. Enable it before saving so retries remain safe.');
  }
  return { key, storage };
}

function readPending(storage: Storage, key: string): PendingSave | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingSave;
    if (typeof value.requestId !== 'string' || !value.payload?.style || !Array.isArray(value.payload.variants)) throw new Error();
    return value;
  } catch {
    throw new Error('The pending save record cannot be read. Do not resubmit this item until its saved state has been checked.');
  }
}

function definitelyRejected(code?: string) {
  // Authoritative database/API rejection means this transaction did not commit.
  // Unknown transport, timeout and gateway errors must retain the original request.
  return !!code && (/^(22|23|28|40|42)/.test(code) || code === 'P0001' || code === 'PGRST202');
}

async function send(pending: PendingSave, storage: Storage, key: string): Promise<UpsertItemStyleFullResult> {
  try {
    const { data, error } = await supabase.rpc('create_original_item', {
      p_request_id: pending.requestId,
      p_style: pending.payload.style,
      p_variants: pending.payload.variants,
    });
    if (error) {
      if (definitelyRejected(error.code)) {
        storage.removeItem(key);
        throw new Error(error.code === 'PGRST202'
          ? 'The item-save database update is not installed yet. Install the reviewed migration before using this form.'
          : error.message);
      }
      throw new PendingItemSaveError('Save confirmation was not received. Recover the previous save before starting another one.');
    }
    const result = data as UpsertItemStyleFullResult;
    if (!result?.style_id || !Array.isArray(result.variant_ids)) {
      throw new PendingItemSaveError('The save response was incomplete. Recover the previous save to confirm its result.');
    }
    // If cleanup fails, leaving the receipt locally is safe: recovery replays it.
    try { storage.removeItem(key); } catch { /* retained request cannot duplicate */ }
    return result;
  } catch (error) {
    if (error instanceof PendingItemSaveError) throw error;
    // A definite rejection removed the local pending entry above.
    if (!storage.getItem(key)) throw error;
    throw new PendingItemSaveError('Connection interrupted. Recover the previous save; do not create another copy.');
  }
}

export async function saveOriginalItem(
  style: UpsertStylePayload, variants: UpsertVariantPayload[]
): Promise<UpsertItemStyleFullResult> {
  if (inFlight) throw new Error('An item save is already in progress.');
  inFlight = true;
  try {
    const { key, storage } = await context();
    const payload: SavePayload = JSON.parse(JSON.stringify({ style, variants }));
    let pending = readPending(storage, key);
    if (pending && JSON.stringify(pending.payload) !== JSON.stringify(payload)) {
      throw new PendingItemSaveError('A previous save has not been confirmed. Recover it first; your current changes have not been sent.');
    }
    if (!pending) {
      pending = { requestId: crypto.randomUUID(), payload };
      // Persist BEFORE sending, so navigation/refresh retains the original identity.
      storage.setItem(key, JSON.stringify(pending));
    }
    return await send(pending, storage, key);
  } finally { inFlight = false; }
}

export async function recoverPendingItemSave(): Promise<UpsertItemStyleFullResult> {
  if (inFlight) throw new Error('An item save is already in progress.');
  inFlight = true;
  try {
    const { key, storage } = await context();
    const pending = readPending(storage, key);
    if (!pending) throw new Error('No pending item save was found.');
    return await send(pending, storage, key);
  } finally { inFlight = false; }
}
