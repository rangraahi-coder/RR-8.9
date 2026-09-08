import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricCardProps {
  labelEn: string;
  labelHi: string;
  value: string | number;
  subValue?: string;
  subUnitValue?: string | number;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  icon: React.ReactNode;
  lang?: 'en' | 'hi';
  className?: string;
  children?: React.ReactNode;
}

const VARIANT_STYLES = {
  default: 'bg-white',
  danger: 'bg-white',
  warning: 'bg-white',
  success: 'bg-white',
};

const ICON_VARIANT_STYLES = {
  default: 'bg-muted text-muted-foreground',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  success: 'bg-success/10 text-success',
};

const TREND_COLORS = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted-foreground',
};

export default function MetricCard({
  labelEn,
  labelHi,
  value,
  subValue,
  subUnitValue,
  trend,
  trendValue,
  variant = 'default',
  icon,
  lang = 'hi',
  className = '',
  children,
}: MetricCardProps) {
  const [localLang, setLocalLang] = useState<'en' | 'hi'>(lang);
  const label = localLang === 'hi' ? labelHi : labelEn;
  const displayValue = localLang === 'hi' && subUnitValue !== undefined ? subUnitValue : value;

  return (
    <div className={`card-surface p-5 ${VARIANT_STYLES[variant]} ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <p className="section-label">{label}</p>
        <div className="flex items-center gap-2">
          {/* Total PC / Total Unit toggle */}
          <div className="flex items-center rounded-xl overflow-hidden bg-muted text-xs font-600">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocalLang('en'); }}
              className={`px-2.5 py-1 transition-colors duration-150 font-body ${localLang === 'en' ? 'bg-primary text-white rounded-xl' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Total PC
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocalLang('hi'); }}
              className={`px-2.5 py-1 transition-colors duration-150 font-body ${localLang === 'hi' ? 'bg-primary text-white rounded-xl' : 'bg-transparent text-muted-foreground hover:text-foreground'}`}
            >
              Sub Unit
            </button>
          </div>
          <span className={`p-2 rounded-xl ${ICON_VARIANT_STYLES[variant]}`}>
            {icon}
          </span>
        </div>
      </div>
      <div className="flex items-end gap-3">
        <p className="text-3xl font-800 text-foreground tabular-nums leading-none font-display">{displayValue}</p>
        {subValue && <p className="text-sm text-muted-foreground font-500 mb-0.5 font-body">{subValue}</p>}
      </div>
      {trend && trendValue && (
        <div className={`flex items-center gap-1 mt-2 ${TREND_COLORS[trend]}`}>
          {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span className="text-xs font-600 font-body">{trendValue}</span>
        </div>
      )}
      {children}
    </div>
  );
}