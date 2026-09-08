import React from 'react';

type BadgeVariant =
  | 'cutting' | 'stitching' | 'embroidery' | 'finishing' | 'qc' | 'dispatch_ready' | 'dispatched' | 'blocked' | 'pending' | 'active' | 'completed';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  cutting: 'bg-blue-100/70 text-blue-700',
  stitching: 'bg-violet-100/70 text-violet-700',
  embroidery: 'bg-pink-100/70 text-pink-700',
  finishing: 'bg-amber-100/70 text-amber-700',
  qc: 'bg-cyan-100/70 text-cyan-700',
  dispatch_ready: 'bg-green-100/70 text-green-700',
  dispatched: 'bg-gray-100/70 text-gray-600',
  blocked: 'bg-red-100/70 text-red-700',
  pending: 'bg-orange-100/70 text-orange-700',
  active: 'bg-green-100/70 text-green-700',
  completed: 'bg-gray-100/70 text-gray-600',
};

const BADGE_LABELS_HI: Record<BadgeVariant, string> = {
  cutting: 'कटाई',
  stitching: 'सिलाई',
  embroidery: 'कढ़ाई',
  finishing: 'फिनिशिंग',
  qc: 'QC जांच',
  dispatch_ready: 'भेजने तैयार',
  dispatched: 'भेज दिया',
  blocked: 'रुका हुआ',
  pending: 'बाकी है',
  active: 'चालू',
  completed: 'पूरा',
};

const BADGE_LABELS_EN: Record<BadgeVariant, string> = {
  cutting: 'Cutting',
  stitching: 'Stitching',
  embroidery: 'Embroidery',
  finishing: 'Finishing',
  qc: 'QC Check',
  dispatch_ready: 'Dispatch Ready',
  dispatched: 'Dispatched',
  blocked: 'Blocked',
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
};

interface StatusBadgeProps {
  variant: BadgeVariant;
  lang?: 'en' | 'hi';
  className?: string;
}

export default function StatusBadge({ variant, lang = 'hi', className = '' }: StatusBadgeProps) {
  const label = lang === 'hi' ? BADGE_LABELS_HI[variant] : BADGE_LABELS_EN[variant];
  return (
    <span className={`status-badge font-body ${BADGE_STYLES[variant]} ${className}`}>
      {label}
    </span>
  );
}