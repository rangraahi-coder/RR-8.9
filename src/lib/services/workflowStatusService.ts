import { createClient } from '@/lib/supabase/client';

export type WorkflowManualStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface WorkflowStatusRecord {
  jobCardId: string;
  stageKey: string;
  status: WorkflowManualStatus;
}

/**
 * Fetch all workflow statuses for a list of job card IDs.
 * Returns a map: `${jobCardId}__${stageKey}` → status
 */
export async function fetchWorkflowStatuses(
  jobCardIds: string[]
): Promise<Record<string, WorkflowManualStatus>> {
  if (!jobCardIds.length) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from('job_card_workflow_statuses')
    .select('job_card_id, stage_key, status')
    .in('job_card_id', jobCardIds);

  if (error || !data) return {};

  const map: Record<string, WorkflowManualStatus> = {};
  for (const row of data) {
    map[`${row.job_card_id}__${row.stage_key}`] = row.status as WorkflowManualStatus;
  }
  return map;
}

/**
 * Upsert a single workflow status for a job card + stage.
 * Uses ON CONFLICT (job_card_id, stage_key) DO UPDATE.
 */
export async function upsertWorkflowStatus(
  jobCardId: string,
  stageKey: string,
  status: WorkflowManualStatus
): Promise<void> {
  const supabase = createClient();
  await supabase
    .from('job_card_workflow_statuses')
    .upsert(
      {
        job_card_id: jobCardId,
        stage_key: stageKey,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job_card_id,stage_key' }
    ).throwOnError();
}

