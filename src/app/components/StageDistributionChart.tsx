'use client';
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const STAGE_DATA = [
  { stageEn: 'Cutting', stageHi: 'कटाई', pieces: 0, color: '#3B82F6' },
  { stageEn: 'Stitching', stageHi: 'सिलाई', pieces: 0, color: '#7C3AED' },
  { stageEn: 'Embroidery', stageHi: 'कढ़ाई', pieces: 0, color: '#EC4899' },
  { stageEn: 'Finishing', stageHi: 'फिनिशिंग', pieces: 0, color: '#D97706' },
  { stageEn: 'QC', stageHi: 'QC जांच', pieces: 0, color: '#0891B2' },
  { stageEn: 'Dispatch Ready', stageHi: 'भेजने तैयार', pieces: 0, color: '#15803D' },
];

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl shadow-elevated px-4 py-3">
        <p className="text-xs font-600 text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-800 text-foreground tabular-nums">{payload[0].value.toLocaleString('en-IN')}</p>
        <p className="text-xs text-muted-foreground">pieces</p>
      </div>
    );
  }
  return null;
}

export default function StageDistributionChart({ lang }: { lang: 'en' | 'hi' }) {
  const data = STAGE_DATA.map((d) => ({
    name: lang === 'hi' ? d.stageHi : d.stageEn,
    pieces: d.pieces,
    color: d.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={36}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--muted-foreground)', fontWeight: 500 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fontFamily: 'var(--font-sans)', fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.5 }} />
        <Bar dataKey="pieces" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-stage-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}