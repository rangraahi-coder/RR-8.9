'use client';
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobCardSummary {
  id: string;
  jobCardNo: string;
  jobCardRef: string;
  sizeRatios: Record<string,number>;
  dueDate: string;
  styleEn: string;
  designCode: string;
  partyName: string;
  poNo: string;
  stage: string;
  totalPieces: number;
  completedPieces: number;
  isBlocked: boolean;
  updatedAt: string;
  colors: string[];
  sizes: string[];
}

export interface SalesOrderSummary {
  id: string;
  vchNo: string;
  partyName: string;
  status: string;
  totalQty: number;
  totalAmount: number;
  updatedAt: string;
}

export interface AccountSummary {
  id: string;
  name: string;
  parentGroup: string;
}

export interface CuttingMetrics {
  totalEntries: number;
  totalPiecesCut: number;
  pendingEntries: number;
}

export interface StitchingMetrics {
  totalIssued: number;
  totalReceived: number;
  pendingPieces: number;
  activeOperators: number;
}

export interface QCMetrics {
  totalEntries: number;
  totalPassed: number;
  totalFailed: number;
  passRate: number;
}

export interface EmbroideryMetrics {
  totalIssueVouchers: number;
  totalReceiveVouchers: number;
  pendingVouchers: number;
}

export interface DyeingMetrics {
  totalEntries: number;
  pendingEntries: number;
  completedEntries: number;
}

export interface FinishingMetrics {
  totalEntries: number;
  pendingEntries: number;
  completedEntries: number;
}

export interface FabricInventoryMetrics {
  totalRolls: number;
  totalMeters: number;
  lowStockCount: number;
}

export interface RealtimeDataState {
  // Job Cards
  jobCards: JobCardSummary[];
  jobCardsLoading: boolean;
  // Sales Orders
  salesOrders: SalesOrderSummary[];
  salesOrdersLoading: boolean;
  // Accounts
  accounts: AccountSummary[];
  accountsLoading: boolean;
  // Derived counters (always fresh)
  totalJobCards: number;
  blockedJobCards: number;
  activeJobCards: number;
  totalSalesOrders: number;
  totalAccounts: number;
  // Quantity KPIs
  totalPieces: number;   // sum of job_cards.total_pieces (main unit qty)
  totalUnits: number;    // sum of all sub-component quantities (cutting_sub_components)
  // Module metrics
  cuttingMetrics: CuttingMetrics;
  stitchingMetrics: StitchingMetrics;
  qcMetrics: QCMetrics;
  embroideryMetrics: EmbroideryMetrics;
  handworkMetrics: EmbroideryMetrics;
  dyeingMetrics: DyeingMetrics;
  finishingMetrics: FinishingMetrics;
  fabricInventoryMetrics: FabricInventoryMetrics;
  metricsLoading: boolean;
  // Notifications: recent changes (last 10 events)
  recentEvents: RealtimeEvent[];
  // Item Variants (for Item Master screen)
  itemVariantsLoading: boolean;
  // Fabric Inventory (for Fabric Inventory screen)
  fabricInventoryLoading: boolean;
  // Manual refresh
  refreshAll: () => void;
  refreshJobCards: () => void;
  refreshSalesOrders: () => void;
  refreshAccounts: () => void;
  refreshItemVariants: () => void;
  refreshFabricInventory: () => void;
  refreshModuleMetrics: () => void;
}

export interface RealtimeEvent {
  id: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  recordId: string;
  label: string;
  timestamp: Date;
}

// ── Context ───────────────────────────────────────────────────────────────────

const RealtimeDataContext = createContext<RealtimeDataState | null>(null);

export function useRealtimeData(): RealtimeDataState {
  const ctx = useContext(RealtimeDataContext);
  if (!ctx) {
    throw new Error('useRealtimeData must be used inside <RealtimeDataProvider>');
  }
  return ctx;
}

const DEFAULT_CUTTING: CuttingMetrics = { totalEntries: 0, totalPiecesCut: 0, pendingEntries: 0 };
const DEFAULT_STITCHING: StitchingMetrics = { totalIssued: 0, totalReceived: 0, pendingPieces: 0, activeOperators: 0 };
const DEFAULT_QC: QCMetrics = { totalEntries: 0, totalPassed: 0, totalFailed: 0, passRate: 0 };
const DEFAULT_EMBROIDERY: EmbroideryMetrics = { totalIssueVouchers: 0, totalReceiveVouchers: 0, pendingVouchers: 0 };
const DEFAULT_DYEING: DyeingMetrics = { totalEntries: 0, pendingEntries: 0, completedEntries: 0 };
const DEFAULT_FINISHING: FinishingMetrics = { totalEntries: 0, pendingEntries: 0, completedEntries: 0 };
const DEFAULT_FABRIC: FabricInventoryMetrics = { totalRolls: 0, totalMeters: 0, lowStockCount: 0 };

// ── Provider ──────────────────────────────────────────────────────────────────

export function RealtimeDataProvider({ children }: { children: React.ReactNode }) {
  const {sessionStatus}=useAuth();
  const [jobCards, setJobCards] = useState<JobCardSummary[]>([]);
  const [jobCardsLoading, setJobCardsLoading] = useState(true);

  const [salesOrders, setSalesOrders] = useState<SalesOrderSummary[]>([]);
  const [salesOrdersLoading, setSalesOrdersLoading] = useState(true);

  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);

  const [itemVariantsLoading, setItemVariantsLoading] = useState(false);
  const [fabricInventoryLoading, setFabricInventoryLoading] = useState(false);

  // Sub-component total units (sum of all cutting_sub_components.total_pieces)
  const [totalUnits, setTotalUnits] = useState<number>(0);

  // Module metrics
  const [cuttingMetrics, setCuttingMetrics] = useState<CuttingMetrics>(DEFAULT_CUTTING);
  const [stitchingMetrics, setStitchingMetrics] = useState<StitchingMetrics>(DEFAULT_STITCHING);
  const [qcMetrics, setQcMetrics] = useState<QCMetrics>(DEFAULT_QC);
  const [handworkMetrics,setHandworkMetrics]=useState<EmbroideryMetrics>(DEFAULT_EMBROIDERY);
  const [embroideryMetrics, setEmbroideryMetrics] = useState<EmbroideryMetrics>(DEFAULT_EMBROIDERY);
  const [dyeingMetrics, setDyeingMetrics] = useState<DyeingMetrics>(DEFAULT_DYEING);
  const [finishingMetrics, setFinishingMetrics] = useState<FinishingMetrics>(DEFAULT_FINISHING);
  const [fabricInventoryMetrics, setFabricInventoryMetrics] = useState<FabricInventoryMetrics>(DEFAULT_FABRIC);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchJobCards = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('job_cards')
        .select('id, job_card_no, style_en, design_code, party_name, po_no, stage, total_pieces, completed_pieces, is_blocked, updated_at, colors, sizes, size_ratios, due_date')
        .order('updated_at', { ascending: false });
      if(error)throw error;
      if (data) {
        setJobCards(
          data.map((r: any) => ({
            id: r.id,
            jobCardNo: r.job_card_no,
            jobCardRef: r.job_card_no,
            sizeRatios: r.size_ratios || {},
            dueDate: r.due_date || '',
            styleEn: r.style_en || '',
            designCode: r.design_code || '',
            partyName: r.party_name,
            poNo: r.po_no || '',
            stage: r.stage,
            totalPieces: r.total_pieces || 0,
            completedPieces: r.completed_pieces || 0,
            isBlocked: r.is_blocked || false,
            updatedAt: r.updated_at || '',
            colors: r.colors || [],
            sizes: r.sizes || [],
          }))
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Job Cards could not refresh',{id:'job-cards-refresh'});
    } finally {
      setJobCardsLoading(false);
    }
  }, []);

  const fetchSalesOrders = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, vch_no, party_name, status, total_qty, total_amount, updated_at')
        .order('updated_at', { ascending: false });
      if(error)throw error;
      if (data) {
        setSalesOrders(
          data.map((r: any) => ({
            id: r.id,
            vchNo: r.vch_no,
            partyName: r.party_name,
            status: r.status,
            totalQty: r.total_qty || 0,
            totalAmount: Number(r.total_amount) || 0,
            updatedAt: r.updated_at || '',
          }))
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ERP data could not refresh',{id:'erp-refresh'});
    } finally {
      setSalesOrdersLoading(false);
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('accounts')
        .select('id, name, parent_group')
        .order('name', { ascending: true });
      if(error)throw error;
      if (data) {
        setAccounts(
          data.map((r: any) => ({
            id: r.id,
            name: r.name,
            parentGroup: r.parent_group,
          }))
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ERP data could not refresh',{id:'erp-refresh'});
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const fetchModuleMetrics = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const supabase = createClient();

      // Run all queries in parallel
      const [
        cuttingRes,
        stitchIssueRes,
        stitchReceiveRes,
        stitchOperatorsRes,
        qcRes,
        embIssueRes,
        embReceiveRes,
        dyeingRes,
        finishingRes,
        fabricRes,
        subComponentsRes,
      ] = await Promise.all([
        supabase.from('cutting_entries').select('id, total_pieces, status'),
        supabase.from('stitch_issue_vouchers').select('id, total_pieces'),
        supabase.from('stitch_receive_vouchers').select('id, total_pieces_received'),
        supabase.from('stitch_operators').select('id').eq('is_active', true),
        supabase.from('qc_entries').select('id, status, total_pieces_received, total_pass, total_fail'),
        supabase.from('emb_issue_vouchers').select('id, status, process_type'),
        supabase.from('emb_receive_vouchers').select('id, issue_voucher_id'),
        supabase.from('dyeing_processing_entries').select('id, status'),
        supabase.from('finishing_entries').select('id, status'),
        supabase.from('fabric_inventory').select('id, stock_qty, unit'),
        supabase.from('cutting_sub_components').select('total_pieces'),
      ]);

      const failed=[cuttingRes,stitchIssueRes,stitchReceiveRes,stitchOperatorsRes,qcRes,embIssueRes,embReceiveRes,dyeingRes,finishingRes,fabricRes,subComponentsRes].find(r=>r.error);
      if(failed?.error)throw failed.error;

      // Total Units: sum of all sub-component quantities
      if (!subComponentsRes.error && subComponentsRes.data) {
        const subTotal = subComponentsRes.data.reduce((s: number, r: any) => s + (r.total_pieces || 0), 0);
        setTotalUnits(subTotal);
      }

      // Cutting
      if (!cuttingRes.error && cuttingRes.data) {
        const rows = cuttingRes.data;
        setCuttingMetrics({
          totalEntries: rows.length,
          totalPiecesCut: rows.reduce((s: number, r: any) => s + (r.total_pieces || 0), 0),
          pendingEntries: rows.filter((r: any) => r.status === 'pending' || !r.status).length,
        });
      }

      // Stitching
      const issuedPieces = (stitchIssueRes.data || []).reduce((s: number, r: any) => s + (r.total_pieces || 0), 0);
      const receivedPieces = (stitchReceiveRes.data || []).reduce((s: number, r: any) => s + (r.total_pieces_received || 0), 0);
      setStitchingMetrics({
        totalIssued: issuedPieces,
        totalReceived: receivedPieces,
        pendingPieces: Math.max(0, issuedPieces - receivedPieces),
        activeOperators: (stitchOperatorsRes.data || []).length,
      });

      // QC
      if (!qcRes.error && qcRes.data) {
        const rows = qcRes.data;
        const passed = rows.reduce((s: number, r: any) => s + (r.total_pass || 0), 0);
        const failed = rows.reduce((s: number, r: any) => s + (r.total_fail || 0), 0);
        const total = passed + failed;
        setQcMetrics({
          totalEntries: rows.length,
          totalPassed: passed,
          totalFailed: failed,
          passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        });
      }

      // Separate process metrics while retaining shared stock and voucher lineage.
      if (!embIssueRes.error && embIssueRes.data) {
        for(const handwork of [false,true]){
          const issued=embIssueRes.data.filter((r:any)=>handwork?r.process_type==='handwork':r.process_type!=='handwork');
          const ids=new Set(issued.map((r:any)=>r.id));
          const metrics={totalIssueVouchers:issued.length,totalReceiveVouchers:(embReceiveRes.data||[]).filter((r:any)=>ids.has(r.issue_voucher_id)).length,
            pendingVouchers:issued.filter((r:any)=>!['fully_received','closed','cancelled'].includes(r.status)).length};
          if(handwork)setHandworkMetrics(metrics);else setEmbroideryMetrics(metrics);
        }
      }

      // Dyeing
      if (!dyeingRes.error && dyeingRes.data) {
        const rows = dyeingRes.data;
        setDyeingMetrics({
          totalEntries: rows.length,
          pendingEntries: rows.filter((r: any) => r.status === 'pending' || !r.status).length,
          completedEntries: rows.filter((r: any) => r.status === 'completed').length,
        });
      }

      // Finishing (using cutting_entries with finishing stage as proxy)
      if (!finishingRes.error && finishingRes.data) {
        const rows = finishingRes.data;
        setFinishingMetrics({
          totalEntries: rows.length,
          pendingEntries: rows.filter((r: any) => r.status === 'in_progress').length,
          completedEntries: rows.filter((r: any) => r.status === 'completed').length,
        });
      }

      // Fabric Inventory
      if (!fabricRes.error && fabricRes.data) {
        const rows = fabricRes.data;
        const totalMeters = rows.reduce((s: number, r: any) => s + (Number(r.stock_qty) || 0), 0);
        const LOW_STOCK_THRESHOLD = 50;
        setFabricInventoryMetrics({
          totalRolls: rows.length,
          totalMeters: Math.round(totalMeters),
          lowStockCount: rows.filter((r: any) => (Number(r.stock_qty) || 0) < LOW_STOCK_THRESHOLD).length,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ERP data could not refresh',{id:'erp-refresh'});
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchJobCards();
    fetchSalesOrders();
    fetchAccounts();
    fetchModuleMetrics();
  }, [fetchJobCards, fetchSalesOrders, fetchAccounts, fetchModuleMetrics]);

  // ── Item Variants refresh (signals loading to Item Master screen) ─────────
  const refreshItemVariants = useCallback(() => {
    setItemVariantsLoading(true);
    setTimeout(() => setItemVariantsLoading(false), 300);
  }, []);

  // ── Fabric Inventory refresh (signals loading to Fabric Inventory screen) ─
  const refreshFabricInventory = useCallback(() => {
    setFabricInventoryLoading(true);
    setTimeout(() => setFabricInventoryLoading(false), 300);
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    if(sessionStatus!=='signed-in'){setJobCards([]);setSalesOrders([]);setAccounts([]);setRecentEvents([]);return;}
    refreshAll();
    const refresh=()=>{if(document.visibilityState==='visible')refreshAll();};
    const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('online',refresh);window.addEventListener('erp-data-changed',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);window.removeEventListener('erp-data-changed',refresh);};
  }, [refreshAll,sessionStatus]);

  // ── Real-time subscriptions ───────────────────────────────────────────────

  const fetchJobCardsRef = useRef(fetchJobCards);
  const fetchSalesOrdersRef = useRef(fetchSalesOrders);
  const fetchAccountsRef = useRef(fetchAccounts);
  const fetchModuleMetricsRef = useRef(fetchModuleMetrics);
  const refreshItemVariantsRef = useRef(refreshItemVariants);
  const refreshFabricInventoryRef = useRef(refreshFabricInventory);

  useEffect(() => {
    fetchJobCardsRef.current = fetchJobCards;
    fetchSalesOrdersRef.current = fetchSalesOrders;
    fetchAccountsRef.current = fetchAccounts;
    fetchModuleMetricsRef.current = fetchModuleMetrics;
    refreshItemVariantsRef.current = refreshItemVariants;
    refreshFabricInventoryRef.current = refreshFabricInventory;
  });

  useEffect(() => {
    const supabase = createClient();

    if(sessionStatus!=='signed-in')return;
    const channel = supabase
      .channel('global_erp_realtime_'+crypto.randomUUID())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_cards' }, (payload) => {
        fetchJobCardsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        const label = record?.job_card_no ? `Job Card ${record.job_card_no}` : 'Job Card updated';
        setRecentEvents((prev) => [
          { id: `${Date.now()}-jc`, table: 'job_cards', eventType: payload.eventType as any, recordId: record?.id || '', label, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, (payload) => {
        fetchSalesOrdersRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        const label = record?.vch_no ? `Sales Order ${record.vch_no}` : 'Sales Order updated';
        setRecentEvents((prev) => [
          { id: `${Date.now()}-so`, table: 'sales_orders', eventType: payload.eventType as any, recordId: record?.id || '', label, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, () => {
        fetchAccountsRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_variants' }, () => {
        refreshItemVariantsRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_styles' }, () => {
        refreshItemVariantsRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_compositions' }, () => {
        refreshItemVariantsRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fabric_inventory' }, () => {
        refreshFabricInventoryRef.current();
        fetchModuleMetricsRef.current();
        setRecentEvents((prev) => [
          { id: `${Date.now()}-fi`, table: 'fabric_inventory', eventType: 'UPDATE', recordId: '', label: 'Fabric Inventory updated', timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cutting_entries' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-ce`, table: 'cutting_entries', eventType: payload.eventType as any, recordId: record?.id || '', label: `Cutting Entry ${record?.entry_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stitch_issue_vouchers' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-si`, table: 'stitch_issue_vouchers', eventType: payload.eventType as any, recordId: record?.id || '', label: `Stitch Issue ${record?.voucher_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stitch_receive_vouchers' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-sr`, table: 'stitch_receive_vouchers', eventType: payload.eventType as any, recordId: record?.id || '', label: `Stitch Receive ${record?.voucher_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qc_entries' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-qc`, table: 'qc_entries', eventType: payload.eventType as any, recordId: record?.id || '', label: `QC Entry ${record?.entry_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emb_issue_vouchers' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-ei`, table: 'emb_issue_vouchers', eventType: payload.eventType as any, recordId: record?.id || '', label: `Emb Issue ${record?.voucher_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emb_receive_vouchers' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-er`, table: 'emb_receive_vouchers', eventType: payload.eventType as any, recordId: record?.id || '', label: `Emb Receive ${record?.voucher_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dyeing_processing_entries' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-dp`, table: 'dyeing_processing_entries', eventType: payload.eventType as any, recordId: record?.id || '', label: `Dyeing Entry ${record?.entry_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_card_workflow_statuses' }, (payload) => {
        // Workflow status changes (PP, Pattern, Size Set, etc.) — refresh job cards to propagate to dashboard
        fetchJobCardsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          {
            id: `${Date.now()}-wfs`,
            table: 'job_card_workflow_statuses',
            eventType: payload.eventType as any,
            recordId: record?.job_card_id || '',
            label: `Workflow status updated: ${record?.stage_key || ''} → ${record?.status || ''}`,
            timestamp: new Date(),
          },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grey_fabric_purchases' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-gf`, table: 'grey_fabric_purchases', eventType: payload.eventType as any, recordId: record?.id || '', label: `Grey Fabric ${record?.purchase_no || 'entry updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printer_fabric_issues' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-pfi`, table: 'printer_fabric_issues', eventType: payload.eventType as any, recordId: record?.id || '', label: `Printer Fabric Issue ${record?.issue_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'printer_fabric_receipts' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-pfr`, table: 'printer_fabric_receipts', eventType: payload.eventType as any, recordId: record?.id || '', label: `Printer Fabric Receipt ${record?.receipt_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contractor_issue_vouchers' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-civ`, table: 'contractor_issue_vouchers', eventType: payload.eventType as any, recordId: record?.id || '', label: `Contractor Issue ${record?.voucher_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contractor_receive_vouchers' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-crv`, table: 'contractor_receive_vouchers', eventType: payload.eventType as any, recordId: record?.id || '', label: `Contractor Receive ${record?.voucher_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finished_goods' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-fg`, table: 'finished_goods', eventType: payload.eventType as any, recordId: record?.id || '', label: `Finished Goods ${record?.job_card_ref || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'embroidery_accessory_entries' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-ea`, table: 'embroidery_accessory_entries', eventType: payload.eventType as any, recordId: record?.id || '', label: `Embroidery Entry ${record?.entry_no || 'updated'}`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cutting_sub_components' }, () => {
        fetchModuleMetricsRef.current();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cutting_stock' }, (payload) => {
        fetchModuleMetricsRef.current();
        const record = (payload.new && Object.keys(payload.new).length > 0) ? payload.new as any : (payload.old as any);
        setRecentEvents((prev) => [
          { id: `${Date.now()}-cs`, table: 'cutting_stock', eventType: payload.eventType as any, recordId: record?.id || '', label: `Cutting Stock updated`, timestamp: new Date() },
          ...prev.slice(0, 9),
        ]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionStatus]);

  // ── Derived counters ──────────────────────────────────────────────────────

  const totalJobCards = jobCards.length;
  const blockedJobCards = jobCards.filter((j) => j.isBlocked).length;
  const activeJobCards = jobCards.filter((j) => j.stage !== 'dispatched').length;
  const totalSalesOrders = salesOrders.length;
  const totalAccounts = accounts.length;
  // Total Pieces = sum of main-unit quantities from job cards
  const totalPieces = jobCards.reduce((s, j) => s + (j.totalPieces || 0), 0);

  return (
    <RealtimeDataContext.Provider
      value={{
        jobCards,
        jobCardsLoading,
        salesOrders,
        salesOrdersLoading,
        accounts,
        accountsLoading,
        totalJobCards,
        blockedJobCards,
        activeJobCards,
        totalSalesOrders,
        totalAccounts,
        totalPieces,
        totalUnits,
        cuttingMetrics,
        stitchingMetrics,
        qcMetrics,
        embroideryMetrics,handworkMetrics,
        dyeingMetrics,
        finishingMetrics,
        fabricInventoryMetrics,
        metricsLoading,
        recentEvents,
        itemVariantsLoading,
        fabricInventoryLoading,
        refreshAll,
        refreshJobCards: fetchJobCards,
        refreshSalesOrders: fetchSalesOrders,
        refreshAccounts: fetchAccounts,
        refreshItemVariants,
        refreshFabricInventory,
        refreshModuleMetrics: fetchModuleMetrics,
      }}
    >
      {children}
    </RealtimeDataContext.Provider>
  );
}
