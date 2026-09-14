/**
 * Audit Trail Utility
 * Provides helpers to attach user reference (who + when) to every DB operation.
 * Usage: import { getAuditFields } from '@/lib/auditTrail';
 */

export interface AuditFields {
  created_by: string;
  updated_by: string;
}

/**
 * Returns audit fields for INSERT operations (both created_by and updated_by set to current user).
 */
export function getCreateAudit(username: string | null): AuditFields {
  const user = username ?? 'Unknown';
  return { created_by: user, updated_by: user };
}

/**
 * Returns audit fields for UPDATE operations (only updated_by is set).
 */
export function getUpdateAudit(username: string | null): Pick<AuditFields, 'updated_by'> {
  return { updated_by: username ?? 'Unknown' };
}

/**
 * Formats a timestamp for display in the UI.
 * Returns e.g. "04 Aug 2026, 06:38"
 */
export function formatAuditTimestamp(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if(Number.isNaN(d.getTime()))return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hh}:${mm}`;
  } catch {
    return isoString;
  }
}
