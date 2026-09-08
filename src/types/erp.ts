// ─── Core ERP TypeScript Interfaces ───────────────────────────────────────────
// Aligned with actual Supabase schema column names

export type UserRole = 'owner' | 'admin' | 'manager' | 'operator' | 'user';
export type Language = 'en' | 'hi';

// Supabase enum values (snake_case as stored in DB)
export type SOStatus = 'pending' | 'in_production' | 'completed';
export type JCStage = 'cutting' | 'stitching' | 'embroidery' | 'finishing' | 'qc' | 'dispatch_ready' | 'dispatched';
export type PurchaseStatus = 'Ordered' | 'Partial' | 'Received' | 'Cancelled';
export type DispatchStatus = 'dispatched' | 'pending';
export type AccountGroup =
  | 'Sundry Creditors' | 'Sundry Debtors' | 'Contractor' | 'Job Worker' |'Bank Account'| 'Cash Account' | 'Sales Account' | 'Purchase Account' |'Expense Account' | 'Other';
export type DealerType = 'Registered' | 'Un-Registered' | 'Composition';
export type FabricCategory = 'JK' | 'MALMAL' | 'RAYON' | 'YUFTA' | 'KERI_PRINT' | 'OTHER';
export type ItemCategory = 'Kurti' | 'Suit' | 'Dupatta' | 'Fabric' | 'Accessories';
export type PurchaseCategory = 'Fabric' | 'Accessories' | 'Consumables' | 'Packaging';
export type OperatorProcess = 'Cutting' | 'Stitching' | 'Embroidery' | 'Finishing' | 'QC';

// ─── User Profile (matches public.user_profiles) ──────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  username?: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  avatar_url?: string;
}

// ─── Account (matches public.accounts) ────────────────────────────────────────
export interface Account {
  id: string;
  legacy_id?: string;
  name: string;
  parent_group: AccountGroup;
  add1?: string;
  add2?: string;
  add3?: string;
  add4?: string;
  type_of_dealer?: DealerType;
  mob?: string;
  bill_by_bill?: 'Y' | 'N';
  alias?: string;
  op_bal_dr?: number;
  op_bal_cr?: number;
  gstin?: string;
  filing_frequency?: 'Monthly' | 'Quarterly' | 'Not Known' | '';
  created_at?: string;
  updated_at?: string;
}

// ─── Item Styles (matches public.item_styles) ─────────────────────────────────
// Live DB columns: id, job_card_no, design_code, style_no, set_type, import_key, etc.
// There is NO style_code column in the live schema.
export interface ItemStyle {
  id: string;
  job_card_no: string;        // primary identifier in live DB
  design_code?: string;
  style_no?: string;
  set_type?: string;
  import_key?: string;
  primary_image_url?: string;
  linked_job_card_id?: string;
  import_batch_id?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Item Variants (matches public.item_variants) ─────────────────────────────
// Live DB columns: id, style_id, job_card_no, colour, colour_normalized, variant_status, etc.
// There is NO size column in the live schema.
export interface ItemVariant {
  id: string;
  style_id: string;           // FK → item_styles.id
  job_card_no?: string;
  colour: string;             // live DB uses colour (not size)
  colour_normalized?: string;
  variant_status?: 'active' | 'review' | 'linked' | 'created';
  import_key?: string;
  import_batch_id?: string;
  style_no?: string;
  set_type?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Item Detail Lines (matches public.item_detail_lines) ─────────────────────
// Live DB columns: id, variant_id, category, material_name, quantity, unit, etc.
// There is NO style_id column — lines link via variant_id → item_variants.id
export interface ItemDetailLine {
  id: string;
  variant_id: string;         // FK → item_variants.id (NOT style_id)
  category?: 'fabric_material' | 'product_composition' | 'manufacturing_work' | 'accessory_raw_material';
  material_name?: string;
  material_name_normalized?: string;
  quantity?: number;
  unit?: string;
  secondary_quantity?: number;
  secondary_unit?: string;
  notes?: string;
  source_text?: string;
  review_status?: 'ok' | 'needs_review' | 'quantity_required' | 'ambiguous_match';
  import_key?: string;
  import_batch_id?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Sales Order (matches public.sales_orders) ────────────────────────────────
export interface SalesOrder {
  id: string;
  legacy_id?: string;
  order_date: string;
  vch_no: string;
  party_name: string;
  party_type?: 'external' | 'self';
  total_qty?: number;
  total_amount?: number;
  job_card_no?: string;
  status?: SOStatus;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  // joined
  items?: SalesOrderItem[];
}

// ─── Sales Order Items (matches public.sales_order_items) ─────────────────────
export interface SalesOrderItem {
  id: string;
  sales_order_id: string;
  item_name: string;
  param_size?: string;
  qty?: number;
  unit?: string;
}

// ─── Job Card (matches public.job_cards) ──────────────────────────────────────
export interface JobCard {
  id: string;
  legacy_id?: string;
  job_card_no: string;
  style_en?: string;
  style_hi?: string;
  design_code?: string;
  party_name: string;
  contractor?: string;
  stage?: JCStage;
  total_pieces?: number;
  completed_pieces?: number;
  is_blocked?: boolean;
  blockage_reason_en?: string;
  blockage_reason_hi?: string;
  blockage_days?: number;
  due_date?: string;
  po_no?: string;
  created_date?: string;
  colors?: string[];
  sizes?: string[];
  size_ratios?: SizeRatio[] | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  sales_order_id?: string;
  // camelCase mapped fields
  dueDate?: string;
  sizeRatios?: Record<string, number>;
}

export interface SizeRatio {
  size: string;
  ratio: number;
  qty: number;
}

// ─── Grey Fabric Purchase (matches public.grey_fabric_purchases) ───────────────
export interface GreyFabricPurchase {
  id: string;
  purchase_no: string;
  date: string;
  supplier_name: string;
  fabric_name: string;
  fabric_type: string;
  ordered_qty: number;
  received_qty: number;
  unit: string;
  rate_per_unit: number;
  total_amount: number;
  status: string;
  sent_for_dyeing: number;
  sent_for_printing: number;
  balance_in_stock: number;
  remarks?: string;
  discount?: number;
  discount_type?: 'amount' | 'percent';
  gst_slab?: number;
  l_value?: number;
  actual_fabric_qty?: number;
  thaan_lengths?: unknown;
  job_card_id?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Fabric Inventory (matches public.fabric_inventory) ───────────────────────
export interface FabricInventory {
  id: string;
  legacy_id?: string;
  fabric_name: string;
  unit?: string;
  stock_qty?: number;
  category?: FabricCategory;
  status?: string;
  job_card_id?: string;
  inventory_stage: string;
  finished_fabric_name?: string;
  source_module?: string;
  source_receipt_id?: string;
  source_grey_fabric_ref?: string;
  processor_name?: string;
  processing_type?: string;
  received_date?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Cutting Entry (matches public.cutting_entries) ───────────────────────────
export interface CuttingEntry {
  id: string;
  entry_no: string;
  date: string;
  job_card_ref?: string;
  style_name: string;
  style_no?: string;
  cutting_master: string;
  fabric_name: string;
  fabric_roll_id?: string;
  fabric_issued_qty: number;
  fabric_consumed_qty: number;
  fabric_leftover: number;
  unit: string;
  total_pieces_cut: number;
  wastage_qty: number;
  cutting_rejections: number;
  rejection_reason?: string;
  net_pieces_for_stitching: number;
  status: string;
  remarks?: string;
  cutting_price?: number;
  roll_details?: unknown;
  emb_receive_items?: unknown;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Dyeing Processing Entry (matches public.dyeing_processing_entries) ────────
export interface DyeingEntry {
  id: string;
  issue_no: string;
  date: string;
  processor_name: string;
  fabric_name: string;
  issued_qty: number;
  received_qty: number;
  unit: string;
  processing_type: string;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Finished Goods (matches public.finished_goods) ───────────────────────────
export interface FinishedGoods {
  id: string;
  job_card_ref: string;
  style_name?: string;
  party_name?: string;
  item?: string;
  colour?: string;
  size?: string;
  total_pieces: number;
  available_for_dispatch: number;
  dispatched_pieces: number;
  source: string;
  source_voucher_no?: string;
  source_voucher_id?: string;
  date_added: string;
  status: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Dispatch Voucher (matches public.dispatch_vouchers) ──────────────────────
export interface DispatchVoucher {
  id: string;
  dispatch_no: string;
  dispatch_date: string;
  party_name: string;
  job_card_ref?: string;
  style_name?: string;
  finished_goods_id?: string;
  item_name?: string;
  colour?: string;
  size?: string;
  ordered_pieces: number;
  dispatched_pieces: number;
  vehicle_no?: string;
  driver_name?: string;
  invoice_no?: string;
  remarks?: string;
  status: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── Stitch Operator (matches public.stitch_operators) ────────────────────────
export interface StitchOperator {
  id: string;
  operator_code: string;
  operator_name: string;
  department: string;
  process?: string | null;
  is_active: boolean;
  remarks?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ─── Stitch Issue Voucher (matches public.stitch_issue_vouchers) ──────────────
export interface StitchIssueVoucher {
  id: string;
  voucher_no: string;
  date: string;
  job_card_ref?: string;
  operator_id?: string;
  operator_name?: string;
  total_pieces: number;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── Stitch Receive Voucher (matches public.stitch_receive_vouchers) ──────────
export interface StitchReceiveVoucher {
  id: string;
  voucher_no: string;
  date: string;
  job_card_ref?: string;
  operator_id?: string;
  operator_name?: string;
  received_pieces: number;
  rejected_pieces: number;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── QC Entry (matches public.qc_entries) ─────────────────────────────────────
export interface QCEntry {
  id: string;
  entry_no: string;
  date: string;
  job_card_ref?: string;
  total_checked: number;
  passed_pieces: number;
  rejected_pieces: number;
  rework_pieces: number;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── Contractor Issue Voucher (matches public.contractor_issue_vouchers) ───────
export interface ContractorIssueVoucher {
  id: string;
  voucher_no: string;
  date: string;
  job_card_id?: string;
  contractor_name: string;
  total_pieces: number;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── Contractor Receive Voucher (matches public.contractor_receive_vouchers) ───
export interface ContractorReceiveVoucher {
  id: string;
  voucher_no: string;
  date: string;
  job_card_id?: string;
  contractor_name: string;
  received_pieces: number;
  rejected_pieces: number;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── Printer Fabric Issue (matches public.printer_fabric_issues) ───────────────
export interface PrinterFabricIssue {
  id: string;
  issue_no: string;
  date: string;
  printer_account: string;
  fabric_name: string;
  issued_qty: number;
  unit: string;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── Printer Fabric Receipt (matches public.printer_fabric_receipts) ──────────
export interface PrinterFabricReceipt {
  id: string;
  receipt_no: string;
  date: string;
  printer_account: string;
  fabric_name: string;
  received_qty: number;
  unit: string;
  status: string;
  remarks?: string;
  created_by?: string;
  created_at?: string;
}

// ─── Dashboard KPI ────────────────────────────────────────────────────────────
export interface KPIData {
  todayOrders: number;
  todayOrdersTrend: number;
  activeJobCards: number;
  pendingDispatch: number;
  lowStockAlerts: number;
}

export interface PipelineStage {
  stage: string;
  stageHi: string;
  count: number;
  pieces: number;
  color: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  actionHi: string;
  module: string;
  reference: string;
  type: 'create' | 'update' | 'dispatch' | 'alert' | 'complete';
}

// ─── Company Settings ─────────────────────────────────────────────────────────
export interface CompanySettings {
  name: string;
  nameHi: string;
  address: string;
  city: string;
  state: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  logoUrl?: string;
}

export interface NumberingSequence {
  module: string;
  prefix: string;
  startNumber: number;
  currentNumber: number;
  padLength: number;
}

export interface TaxDefault {
  id: string;
  name: string;
  rate: number;
  hsnCode: string;
  category: string;
}