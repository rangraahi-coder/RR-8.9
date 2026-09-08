'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Language } from '@/types/erp';

// ─── Translation Dictionary ───────────────────────────────────────────────────
const translations: Record<string, Record<Language, string>> = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'nav.masters': { en: 'Masters', hi: 'मास्टर' },
  'nav.items': { en: 'Item Master', hi: 'आइटम मास्टर' },
  'nav.accounts': { en: 'Account Master', hi: 'खाता मास्टर' },
  'nav.operators': { en: 'Operator Master', hi: 'ऑपरेटर मास्टर' },
  'nav.sales': { en: 'Sales', hi: 'बिक्री' },
  'nav.orders': { en: 'Sales Orders', hi: 'बिक्री आदेश' },
  'nav.jobcards': { en: 'Job Cards', hi: 'जॉब कार्ड' },
  'nav.procurement': { en: 'Procurement', hi: 'खरीद' },
  'nav.greyfabric': { en: 'Grey Fabric', hi: 'ग्रे कपड़ा' },
  'nav.purchases': { en: 'Purchases', hi: 'खरीद आदेश' },
  'nav.production': { en: 'Production', hi: 'उत्पादन' },
  'nav.dyeing': { en: 'Dyeing & Printing', hi: 'रंगाई और छपाई' },
  'nav.fabric': { en: 'Fabric Inventory', hi: 'कपड़ा भंडार' },
  'nav.cutting': { en: 'Cutting', hi: 'कटाई' },
  'nav.embroidery': { en: 'Embroidery', hi: 'कढ़ाई' },
  'nav.stitching': { en: 'Stitching', hi: 'सिलाई' },
  'nav.qc': { en: 'QC', hi: 'गुणवत्ता जाँच' },
  'nav.contractorfinishing': { en: 'Contractor Finishing', hi: 'ठेकेदार फिनिशिंग' },
  'nav.finishing': { en: 'Finishing Entry', hi: 'फिनिशिंग प्रविष्टि' },
  'nav.finishedgoods': { en: 'Finished Goods', hi: 'तैयार माल' },
  'nav.dispatch': { en: 'Dispatch', hi: 'प्रेषण' },
  'nav.accounts_group': { en: 'Accounts', hi: 'लेखा' },
  'nav.ledger': { en: 'Ledger', hi: 'खाता बही' },
  'nav.printerledger': { en: 'Printer Ledger', hi: 'प्रिंटर खाता' },
  'nav.settings': { en: 'Settings', hi: 'सेटिंग्स' },
  'nav.audit': { en: 'Audit Trail', hi: 'ऑडिट ट्रेल' },

  // Common
  'common.search': { en: 'Search...', hi: 'खोजें...' },
  'common.add': { en: 'Add', hi: 'जोड़ें' },
  'common.edit': { en: 'Edit', hi: 'संपादित करें' },
  'common.delete': { en: 'Delete', hi: 'हटाएं' },
  'common.save': { en: 'Save', hi: 'सहेजें' },
  'common.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'common.close': { en: 'Close', hi: 'बंद करें' },
  'common.view': { en: 'View', hi: 'देखें' },
  'common.export': { en: 'Export', hi: 'निर्यात' },
  'common.import': { en: 'Import', hi: 'आयात' },
  'common.filter': { en: 'Filter', hi: 'फ़िल्टर' },
  'common.status': { en: 'Status', hi: 'स्थिति' },
  'common.date': { en: 'Date', hi: 'तारीख' },
  'common.actions': { en: 'Actions', hi: 'क्रियाएं' },
  'common.total': { en: 'Total', hi: 'कुल' },
  'common.amount': { en: 'Amount', hi: 'राशि' },
  'common.qty': { en: 'Qty', hi: 'मात्रा' },
  'common.name': { en: 'Name', hi: 'नाम' },
  'common.code': { en: 'Code', hi: 'कोड' },
  'common.loading': { en: 'Loading...', hi: 'लोड हो रहा है...' },
  'common.nodata': { en: 'No records found', hi: 'कोई रिकॉर्ड नहीं मिला' },
  'common.confirm_delete': { en: 'Confirm Delete', hi: 'हटाने की पुष्टि करें' },
  'common.are_you_sure': { en: 'Are you sure you want to delete this record? This action cannot be undone.', hi: 'क्या आप वाकई इस रिकॉर्ड को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।' },
  'common.saving': { en: 'Saving...', hi: 'सहेज रहा है...' },
  'common.required': { en: 'This field is required', hi: 'यह फ़ील्ड आवश्यक है' },
  'common.page': { en: 'Page', hi: 'पृष्ठ' },
  'common.of': { en: 'of', hi: 'का' },
  'common.rows': { en: 'rows', hi: 'पंक्तियाँ' },
  'common.per_page': { en: 'Per page', hi: 'प्रति पृष्ठ' },
  'common.showing': { en: 'Showing', hi: 'दिखा रहा है' },
  'common.to': { en: 'to', hi: 'से' },
  'common.entries': { en: 'entries', hi: 'प्रविष्टियाँ' },

  // Dashboard
  'dashboard.title': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'dashboard.today_orders': { en: "Today's Orders", hi: 'आज के आदेश' },
  'dashboard.active_jc': { en: 'Active Job Cards', hi: 'सक्रिय जॉब कार्ड' },
  'dashboard.pending_dispatch': { en: 'Pending Dispatch', hi: 'लंबित प्रेषण' },
  'dashboard.low_stock': { en: 'Low Stock Alerts', hi: 'कम स्टॉक अलर्ट' },
  'dashboard.pipeline': { en: 'Production Pipeline', hi: 'उत्पादन पाइपलाइन' },
  'dashboard.recent_orders': { en: 'Recent Sales Orders', hi: 'हाल के बिक्री आदेश' },
  'dashboard.activity': { en: 'Recent Activity', hi: 'हाल की गतिविधि' },
  'dashboard.stage_summary': { en: 'Stage Summary', hi: 'चरण सारांश' },

  // Sales Orders
  'so.title': { en: 'Sales Orders', hi: 'बिक्री आदेश' },
  'so.new': { en: 'New Sales Order', hi: 'नया बिक्री आदेश' },
  'so.number': { en: 'SO Number', hi: 'एसओ नंबर' },
  'so.customer': { en: 'Customer', hi: 'ग्राहक' },
  'so.delivery_date': { en: 'Delivery Date', hi: 'डिलीवरी तारीख' },
  'so.style': { en: 'Style', hi: 'स्टाइल' },
  'so.convert_jc': { en: 'Convert to Job Card', hi: 'जॉब कार्ड में बदलें' },
  'so.view_detail': { en: 'View Detail', hi: 'विवरण देखें' },
  'so.items': { en: 'Line Items', hi: 'लाइन आइटम' },
  'so.add_item': { en: 'Add Item', hi: 'आइटम जोड़ें' },

  // Job Cards
  'jc.title': { en: 'Job Cards', hi: 'जॉब कार्ड' },
  'jc.new': { en: 'New Job Card', hi: 'नया जॉब कार्ड' },
  'jc.number': { en: 'JC Number', hi: 'जेसी नंबर' },
  'jc.stage': { en: 'Current Stage', hi: 'वर्तमान चरण' },
  'jc.size_ratio': { en: 'Size Ratio', hi: 'साइज अनुपात' },
  'jc.due_date': { en: 'Due Date', hi: 'नियत तारीख' },
  'jc.timeline': { en: 'Production Timeline', hi: 'उत्पादन समयरेखा' },

  // Dispatch
  'dispatch.title': { en: 'Dispatch', hi: 'प्रेषण' },
  'dispatch.new': { en: 'New Dispatch', hi: 'नया प्रेषण' },
  'dispatch.dv_number': { en: 'DV Number', hi: 'डीवी नंबर' },
  'dispatch.vehicle': { en: 'Vehicle Number', hi: 'वाहन नंबर' },
  'dispatch.lr_number': { en: 'LR Number', hi: 'एलआर नंबर' },
  'dispatch.transporter': { en: 'Transporter', hi: 'ट्रांसपोर्टर' },
  'dispatch.challan': { en: 'Print Challan', hi: 'चालान प्रिंट करें' },

  // Purchases
  'purchase.title': { en: 'Purchases', hi: 'खरीद' },
  'purchase.new': { en: 'New Purchase Order', hi: 'नया खरीद आदेश' },
  'purchase.po_number': { en: 'PO Number', hi: 'पीओ नंबर' },
  'purchase.supplier': { en: 'Supplier', hi: 'आपूर्तिकर्ता' },
  'purchase.category': { en: 'Category', hi: 'श्रेणी' },
  'purchase.receive': { en: 'Receive Goods', hi: 'माल प्राप्त करें' },
  'purchase.invoice': { en: 'Invoice Number', hi: 'इनवॉइस नंबर' },
  'purchase.discount': { en: 'Discount', hi: 'छूट' },
  'purchase.tax': { en: 'Tax', hi: 'कर' },

  // Settings
  'settings.title': { en: 'Settings', hi: 'सेटिंग्स' },
  'settings.company': { en: 'Company Profile', hi: 'कंपनी प्रोफ़ाइल' },
  'settings.numbering': { en: 'Numbering Sequences', hi: 'क्रम संख्या' },
  'settings.tax': { en: 'Tax Defaults', hi: 'कर डिफ़ॉल्ट' },
  'settings.units': { en: 'Units', hi: 'इकाइयाँ' },
  'settings.users': { en: 'User Management', hi: 'उपयोगकर्ता प्रबंधन' },
  'settings.language': { en: 'Language', hi: 'भाषा' },
  'settings.diagnostic': { en: 'Diagnostics', hi: 'डायग्नोस्टिक्स' },
  'settings.gstin': { en: 'GSTIN', hi: 'जीएसटीआईएन' },
  'settings.pan': { en: 'PAN', hi: 'पैन' },
};

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  const setLang = useCallback((l: Language) => {
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[key]?.[lang] ?? ({'nav.manufacturing':{en:'Workflow',hi:'वर्कफ़्लो'},'nav.workflow':{en:'Production Workflow',hi:'उत्पादन वर्कफ़्लो'},'nav.stocktracker':{en:'Fabric Stock Tracker',hi:'फैब्रिक स्टॉक'}} as Record<string,Record<string,string>>)[key]?.[lang] ?? key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}