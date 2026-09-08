'use client';
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Package,
  Wrench,
  Scissors,
  ShoppingBag,
  RefreshCw,
  ArrowLeft,
  Clock,
  ChevronDown,
  ChevronRight,
  Play,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { previewItemImport, executeItemImport, getImportBatches } from '@/lib/services/itemImportService';
import type { ImportPreviewResult, ImportFinalResult } from '@/lib/services/itemImportService';

const CATEGORY_META = {
  fabric_material: { label: 'Fabric / Material', icon: <Scissors size={12} />, color: 'bg-blue-100 text-blue-700' },
  product_composition: { label: 'Product Composition', icon: <Package size={12} />, color: 'bg-purple-100 text-purple-700' },
  manufacturing_work: { label: 'Manufacturing Work', icon: <Wrench size={12} />, color: 'bg-orange-100 text-orange-700' },
  accessory_raw_material: { label: 'Accessory / Raw Material', icon: <ShoppingBag size={12} />, color: 'bg-green-100 text-green-700' },
};

export default function ItemImportContent() {
  const [step, setStep] = useState<'idle' | 'previewing' | 'preview_ready' | 'importing' | 'done'>('idle');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [result, setResult] = useState<ImportFinalResult | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [pastBatches, setPastBatches] = useState<unknown[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [activeTab, setActiveTab] = useState<'preview' | 'result' | 'history'>('preview');

  useEffect(() => {
    loadBatches();
  }, []);

  async function loadBatches() {
    setLoadingBatches(true);
    const batches = await getImportBatches();
    setPastBatches(batches);
    setLoadingBatches(false);
  }

  async function handlePreview() {
    setStep('previewing');
    try {
      const data = await previewItemImport();
      setPreview(data);
      setStep('preview_ready');
      setActiveTab('preview');
    } catch (err) {
      console.error(err);
      setStep('idle');
    }
  }

  async function handleImport() {
    setStep('importing');
    try {
      const data = await executeItemImport();
      setResult(data);
      setStep('done');
      setActiveTab('result');
      loadBatches();
    } catch (err) {
      console.error(err);
      setStep('preview_ready');
    }
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const matchLevelBadge = (level: string) => {
    const map: Record<string, string> = {
      exact_variant: 'bg-green-100 text-green-700',
      parent_match: 'bg-blue-100 text-blue-700',
      new_record: 'bg-gray-100 text-gray-600',
      ambiguous: 'bg-orange-100 text-orange-700',
    };
    const labels: Record<string, string> = {
      exact_variant: 'Linked to Existing',
      parent_match: 'Parent Matched',
      new_record: 'New Record',
      ambiguous: 'Ambiguous',
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[level] || 'bg-gray-100 text-gray-600'}`}>
        {labels[level] || level}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/item-master" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Item Master Import</h1>
          <p className="text-sm text-muted-foreground">Import RANGRAAHI WIP items — preview first, then execute</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">RANGRAAHI WIP Import</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Parses the embedded WIP sheet data and upserts all colour variants with full detail lines into the database.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              disabled={step === 'previewing' || step === 'importing'}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'previewing' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Eye size={14} />
              )}
              {step === 'previewing' ? 'Previewing…' : 'Preview'}
            </button>
            <button
              onClick={handleImport}
              disabled={step !== 'preview_ready'}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === 'importing' ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              {step === 'importing' ? 'Importing…' : step === 'done' ? 'Re-Import' : 'Execute Import'}
            </button>
          </div>
        </div>

        {step === 'idle' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
            Click <strong>Preview</strong> to see what will be imported before committing to the database.
          </div>
        )}
      </div>

      {/* Tabs */}
      {(step === 'preview_ready' || step === 'done') && (
        <div className="flex gap-1 border-b border-border">
          {(['preview', 'result', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'result' ? 'Import Result' : tab === 'history' ? 'History' : 'Preview'}
            </button>
          ))}
        </div>
      )}

      {/* Preview tab */}
      {activeTab === 'preview' && preview && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total Blocks', value: preview.totalBlocks, color: 'text-foreground' },
              { label: 'New Variants', value: preview.newVariantsToCreate, color: 'text-blue-600' },
              { label: 'Existing Matched', value: preview.existingVariantsMatched, color: 'text-green-600' },
              { label: 'Needs Review', value: preview.reviewRequired, color: preview.reviewRequired > 0 ? 'text-yellow-600' : 'text-green-600' },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={15} className="text-yellow-600" />
                <span className="text-sm font-semibold text-yellow-800">Warnings ({preview.warnings.length})</span>
              </div>
              {preview.warnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-800">• {w}</p>
              ))}
            </div>
          )}

          {/* Style groups */}
          <div className="space-y-2">
            {preview.styleGroups.map((group) => {
              const isOpen = expandedGroups.has(group.importKey);
              return (
                <div key={group.importKey} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleGroup(group.importKey)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      <span className="font-semibold text-sm">JC {group.jobCardNo}</span>
                      {matchLevelBadge(group.matchLevel)}
                    </div>
                    <span className="text-xs text-muted-foreground">{group.variants.length} variant{group.variants.length !== 1 ? 's' : ''}</span>
                  </button>
                  {isOpen && (
                    <div className="divide-y divide-border">
                      {group.variants.map((v) => (
                        <div key={v.importKey} className="px-4 py-3 flex items-center justify-between text-sm">
                          <div className="flex items-center gap-3">
                            <span className="font-medium text-foreground">{v.colour}</span>
                            {matchLevelBadge(v.matchLevel)}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{v.detailLinesCount} lines</span>
                            {v.reviewCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                <AlertTriangle size={9} />
                                {v.reviewCount} review
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Result tab */}
      {activeTab === 'result' && result && (
        <div className="space-y-4">
          <div className={`border rounded-xl p-5 ${result.errors.length === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.errors.length === 0 ? (
                <CheckCircle2 size={18} className="text-green-600" />
              ) : (
                <AlertTriangle size={18} className="text-yellow-600" />
              )}
              <span className={`font-semibold text-sm ${result.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'}`}>
                {result.errors.length === 0 ? 'Import Completed Successfully' : `Import Completed with ${result.errors.length} Error(s)`}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Parents Created', value: result.parentsCreated },
                { label: 'Variants Created', value: result.variantsCreated },
                { label: 'Items Updated', value: result.itemsUpdated },
                { label: 'BOM Lines Created', value: result.bomLinesCreated },
              ].map((s) => (
                <div key={s.label} className="bg-white/60 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{s.value}</p>
                  <p className="text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={15} className="text-red-600" />
                <span className="text-sm font-semibold text-red-800">Errors</span>
              </div>
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-800">• {e}</p>
              ))}
            </div>
          )}

          <Link
            href="/item-master"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Package size={14} />
            View Item Master
          </Link>
        </div>
      )}

      {/* History tab */}
      {(activeTab === 'history' || (!preview && !result)) && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Import History</h2>
          </div>
          {loadingBatches ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <RefreshCw size={14} className="animate-spin" />
              Loading history…
            </div>
          ) : pastBatches.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">No import batches found. History will appear here after the first import.</div>
          ) : (
            <div className="space-y-2">
              {(pastBatches as Array<Record<string, unknown>>).map((batch, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg text-sm">
                  <div>
                    <span className="font-medium text-foreground">{String(batch.source_file || 'Unknown file')}</span>
                    <span className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${String(batch.status).includes('error') ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {String(batch.status || 'unknown')}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">{String(batch.created_at ? new Date(batch.created_at as string).toLocaleDateString('en-IN') : '')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
