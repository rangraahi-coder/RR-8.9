'use client';
import React from 'react';
import { User, Clock, Edit3 } from 'lucide-react';
import { formatAuditTimestamp } from '@/lib/auditTrail';

interface AuditBadgeProps {
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  /** compact = single-line pill; default = two-line block */
  variant?: 'compact' | 'block';
  className?: string;
}

const USER_COLORS: Record<string, string> = {
  KPL: 'bg-violet-100 text-violet-700 border-violet-200',
  Ishu: 'bg-blue-100 text-blue-700 border-blue-200',
  Ashish: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Unknown: 'bg-gray-100 text-gray-500 border-gray-200',
};

function userColor(name: string | null | undefined): string {
  if (!name) return USER_COLORS['Unknown'];
  return USER_COLORS[name] ?? 'bg-orange-100 text-orange-700 border-orange-200';
}

export default function AuditBadge({
  createdBy,
  createdAt,
  updatedBy,
  updatedAt,
  variant = 'compact',
  className = '',
}: AuditBadgeProps) {
  const hasUpdate = !!updatedBy && (updatedBy !== createdBy || (!!updatedAt && updatedAt !== createdAt));

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 flex-wrap ${className}`}>
        {createdBy && (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-500 ${userColor(createdBy)}`}>
            <User size={10} />
            {createdBy}
            {createdAt && (
              <span className="opacity-70 font-400 ml-0.5">{formatAuditTimestamp(createdAt)}</span>
            )}
          </span>
        )}
        {hasUpdate && (
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-500 ${userColor(updatedBy)}`}>
            <Edit3 size={10} />
            {updatedBy}
            {updatedAt && (
              <span className="opacity-70 font-400 ml-0.5">{formatAuditTimestamp(updatedAt)}</span>
            )}
          </span>
        )}
      </div>
    );
  }

  // block variant
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {createdBy && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User size={11} className="shrink-0" />
          <span>Created by <span className={`font-600 px-1.5 py-0.5 rounded border ${userColor(createdBy)}`}>{createdBy}</span></span>
          {createdAt && (
            <span className="flex items-center gap-1 opacity-70">
              <Clock size={10} />
              {formatAuditTimestamp(createdAt)}
            </span>
          )}
        </div>
      )}
      {hasUpdate && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Edit3 size={11} className="shrink-0" />
          <span>Edited by <span className={`font-600 px-1.5 py-0.5 rounded border ${userColor(updatedBy)}`}>{updatedBy}</span></span>
          {updatedAt && (
            <span className="flex items-center gap-1 opacity-70">
              <Clock size={10} />
              {formatAuditTimestamp(updatedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
