'use client';
import React, { useState, useEffect } from 'react';
import { X, Plus, User, Pencil, Trash2, CheckCircle, XCircle, Search, Eye } from 'lucide-react';
import { stitchingVoucherService, StitchOperator } from '@/lib/services/stitchingVoucherService';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeTable } from '@/lib/hooks/useRealtimeTable';

const DEPARTMENTS = ['Stitching', 'Cutting', 'Embroidery', 'Finishing', 'QC', 'Packing', 'Other'];
const PROCESSES = ['Main Stitching', 'Overlocking', 'Button Stitching', 'Finishing', 'Checking', 'Packing', 'Other'];

interface OperatorForm {
  operatorCode: string;
  operatorName: string;
  department: string;
  process: string;
  isActive: boolean;
  remarks: string;
}

const EMPTY_FORM: OperatorForm = {
  operatorCode: '',
  operatorName: '',
  department: 'Stitching',
  process: '',
  isActive: true,
  remarks: '',
};

export default function OperatorMasterContent() {
  const { username } = useAuth();
  const [operators, setOperators] = useState<StitchOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOp, setEditingOp] = useState<StitchOperator | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StitchOperator | null>(null);
  const [viewTarget, setViewTarget] = useState<StitchOperator | null>(null);
  const [form, setForm] = useState<OperatorForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => { loadOperators(); }, []);

  // Real-time subscription — reload whenever stitch_operators table changes
  useRealtimeTable('stitch_operators', loadOperators);

  async function loadOperators() {
    setLoading(true);
    const data = await stitchingVoucherService.getOperators();
    setOperators(data);
    setLoading(false);
  }

  const filtered = operators.filter((op) => {
    const matchSearch = !search ||
      op.operatorName.toLowerCase().includes(search.toLowerCase()) ||
      op.operatorCode.toLowerCase().includes(search.toLowerCase()) ||
      (op.department || '').toLowerCase().includes(search.toLowerCase());
    const matchActive =
      filterActive === 'all' ||
      (filterActive === 'active' && op.isActive) ||
      (filterActive === 'inactive' && !op.isActive);
    return matchSearch && matchActive;
  });

  function openCreate() {
    setEditingOp(null);
    setForm({ ...EMPTY_FORM });
    setError(null);
    setShowModal(true);
  }

  function openEdit(op: StitchOperator) {
    setEditingOp(op);
    setForm({
      operatorCode: op.operatorCode,
      operatorName: op.operatorName,
      department: op.department,
      process: op.process || '',
      isActive: op.isActive,
      remarks: op.remarks || '',
    });
    setError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.operatorCode.trim() || !form.operatorName.trim()) {
      setError('Operator Code and Name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingOp) {
        const updated = await stitchingVoucherService.updateOperator(editingOp.id, {
          operatorCode: form.operatorCode.trim(),
          operatorName: form.operatorName.trim(),
          department: form.department,
          process: form.process || undefined,
          isActive: form.isActive,
          remarks: form.remarks || undefined,
        }, username);
        if (!updated) { setError('Failed to update operator.'); return; }
      } else {
        const created = await stitchingVoucherService.createOperator({
          operatorCode: form.operatorCode.trim(),
          operatorName: form.operatorName.trim(),
          department: form.department,
          process: form.process || undefined,
          isActive: form.isActive,
          remarks: form.remarks || undefined,
        }, username);
        if (!created) { setError('Failed to create operator. Code may already exist.'); return; }
      }
      setShowModal(false);
      await loadOperators();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const ok = await stitchingVoucherService.deleteOperator(deleteTarget.id);
    if (ok) { setDeleteTarget(null); await loadOperators(); }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-700 text-foreground">Operator Master</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage stitching operators — used in Issue &amp; Receive vouchers for accountability</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Add Operator
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Total Operators</p>
          <p className="text-2xl font-700 text-primary mt-1">{operators.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Active</p>
          <p className="text-2xl font-700 text-success mt-1">{operators.filter((o) => o.isActive).length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-500">Inactive</p>
          <p className="text-2xl font-700 text-muted-foreground mt-1">{operators.filter((o) => !o.isActive).length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, code, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-sm w-full"
          />
        </div>
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-600 transition-colors capitalize ${filterActive === f ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <User size={15} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Operators</span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Code</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Operator Name</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground">Process</th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Status</th>
                <th className="text-center px-4 py-3 text-xs font-600 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Loading operators...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground">
                    <User size={36} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-500">No operators found</p>
                    <p className="text-xs mt-1">Add operators to assign them to Issue &amp; Receive vouchers</p>
                  </td>
                </tr>
              ) : (
                filtered.map((op) => (
                  <tr key={op.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-600 text-primary text-xs">{op.operatorCode}</td>
                    <td className="px-4 py-3 font-600 text-foreground">{op.operatorName}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{op.department}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{op.process || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {op.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success-bg text-success text-xs font-600">
                          <CheckCircle size={10} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-600">
                          <XCircle size={10} /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setViewTarget(op)} className="p-1.5 rounded-lg hover:bg-info/10 text-muted-foreground hover:text-info transition-colors" title="View">
                          <Eye size={13} />
                        </button>
                        <button onClick={() => openEdit(op)} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors" title="Edit">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget(op)} className="p-1.5 rounded-lg hover:bg-danger-bg text-muted-foreground hover:text-danger transition-colors" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">{editingOp ? 'Edit Operator' : 'Add Operator'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {error && <div className="text-xs text-danger bg-danger-bg border border-danger-border rounded-lg px-3 py-2">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Operator Code *</label>
                  <input type="text" required value={form.operatorCode} onChange={(e) => setForm({ ...form, operatorCode: e.target.value })} className="input-field text-sm" placeholder="OP-001" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Operator Name *</label>
                  <input type="text" required value={form.operatorName} onChange={(e) => setForm({ ...form, operatorName: e.target.value })} className="input-field text-sm" placeholder="Full name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="input-field text-sm">
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-600 text-muted-foreground">Process</label>
                  <select value={form.process} onChange={(e) => setForm({ ...form, process: e.target.value })} className="input-field text-sm">
                    <option value="">-- Select Process --</option>
                    {PROCESSES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs font-600 text-muted-foreground">Status</label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.isActive ? 'bg-success' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className={`text-xs font-600 ${form.isActive ? 'text-success' : 'text-muted-foreground'}`}>{form.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-600 text-muted-foreground">Remarks</label>
                <textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} className="input-field text-sm resize-none" placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : editingOp ? 'Update' : 'Add Operator'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">Operator Details</h2>
              <button onClick={() => setViewTarget(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-600 text-muted-foreground">Operator Code</span>
                  <span className="text-sm font-700 text-primary">{viewTarget.operatorCode}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-600 text-muted-foreground">Operator Name</span>
                  <span className="text-sm font-600 text-foreground">{viewTarget.operatorName}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-600 text-muted-foreground">Department</span>
                  <span className="text-sm text-foreground">{viewTarget.department || '—'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-600 text-muted-foreground">Process</span>
                  <span className="text-sm text-foreground">{viewTarget.process || '—'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-600 text-muted-foreground">Status</span>
                {viewTarget.isActive ? (
                  <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full bg-success-bg text-success text-xs font-600">
                    <CheckCircle size={10} /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-600">
                    <XCircle size={10} /> Inactive
                  </span>
                )}
              </div>
              {viewTarget.remarks && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-600 text-muted-foreground">Remarks</span>
                  <span className="text-sm text-foreground">{viewTarget.remarks}</span>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setViewTarget(null)} className="btn-secondary flex-1">Close</button>
                <button onClick={() => { setViewTarget(null); openEdit(viewTarget); }} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Pencil size={13} /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-2xl shadow-modal w-full max-w-sm p-6 flex flex-col gap-4">
            <h3 className="text-base font-700 text-foreground">Delete Operator?</h3>
            <p className="text-sm text-muted-foreground">
              Delete <span className="font-600 text-foreground">{deleteTarget.operatorName}</span> ({deleteTarget.operatorCode})? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleDelete} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-danger text-white rounded-lg text-sm font-600 hover:opacity-90 transition-opacity">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
