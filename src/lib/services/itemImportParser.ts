// Item Import Parser for RANGRAAHI WIP format
// Parses the structured Excel data (already extracted) into typed blocks

export type DetailCategory =
  | 'fabric_material' |'product_composition' |'manufacturing_work' |'accessory_raw_material';

export type ReviewStatus = 'ok' | 'needs_review' | 'quantity_required' | 'ambiguous_match';

export interface ParsedDetailLine {
  category: DetailCategory;
  materialName: string;
  materialNameNormalized: string;
  quantity: number | null;
  unit: string;
  secondaryQuantity: number | null;
  secondaryUnit: string;
  notes: string;
  sourceText: string;
  sourceRow: number;
  reviewStatus: ReviewStatus;
  reviewNote: string;
}

export interface ParsedVariantBlock {
  jobCardNo: string;
  styleNo: string;
  setType: string;
  colour: string;
  colourNormalized: string;
  importKey: string;
  sourceRowStart: number;
  sourceRowEnd: number;
  detailLines: ParsedDetailLine[];
  rawAccessoriesLines: string[];
  /** Fabrics listed in the WIP sheet (Fabric 1 / Fabric 2 / Fabric 3) */
  fabrics: string[];
  /** Item note from the WIP sheet */
  itemNote: string;
  /** Image URL for this colour variant (from Excel embedded image or manually set) */
  imageUrl: string;
}

export interface ParsedStyleGroup {
  jobCardNo: string;
  styleNo: string;
  setType: string;
  importKey: string;
  variants: ParsedVariantBlock[];
}

export interface ImportParseResult {
  styleGroups: ParsedStyleGroup[];
  totalBlocks: number;
  totalDetailLines: number;
  missingQuantities: number;
  reviewRequired: number;
  warnings: string[];
}

// ─── Normalization helpers ────────────────────────────────────────────────────

const SPELLING_CORRECTIONS: Record<string, string> = {
  'NACK LACE': 'NECK LACE',
  'NACK': 'NECK',
  'BITTONS': 'BUTTONS',
  'TUSSLE': 'TASSEL',
  'METERS': 'METER',
  'PIECES': 'PCS',
  'PACKET': 'PKT',
  'PACKETS': 'PKT',
  'PKT.': 'PKT',
  'MTR': 'METER',
  'MTR.': 'METER',
  'PCS.': 'PCS',
  'METRE': 'METER',
  'METRES': 'METER',
};

export function normalizeText(text: string): string {
  let t = text.trim().toUpperCase();
  for (const [wrong, right] of Object.entries(SPELLING_CORRECTIONS)) {
    t = t.replace(new RegExp(`\\b${wrong}\\b`, 'g'), right);
  }
  return t.replace(/\s+/g, ' ').trim();
}

export function normalizeColour(colour: string): string {
  return colour.trim().toUpperCase().replace(/\s+/g, ' ');
}

export function normalizeJobCardNo(jcn: string | number): string {
  return String(jcn).trim().replace(/\s+/g, '');
}

export function generateVariantImportKey(jobCardNo: string, colour: string): string {
  return `RANGRAAHI_WIP:${normalizeJobCardNo(jobCardNo)}:${normalizeColour(colour)}`;
}

export function generateStyleImportKey(jobCardNo: string): string {
  return `RANGRAAHI_WIP_STYLE:${normalizeJobCardNo(jobCardNo)}`;
}

// ─── Classification ───────────────────────────────────────────────────────────

const FABRIC_KEYWORDS = [
  'COTTON 60X60', 'COTTON 60×60', 'COTTON 30X30', 'COTTON 30×30',
  'COTTON 40X60', 'COTTON 40×60', 'MALMAL 100X100', 'MALMAL 100×100',
  'COTTON FLEX FABRIC', 'RAYON SLUB', 'PRINTED FABRIC', 'ORGANZA FABRIC',
  'COTTON FLEX', 'RAYON', 'COTTON', 'SILK', 'CHIFFON', 'GEORGETTE',
  'LINEN', 'POLYESTER', 'VISCOSE', 'MODAL', 'SATIN',
];

const COMPOSITION_PATTERNS = [
  /PRINTED KURTA AND/i,
  /SOLID KURTA/i,
  /SINGLE KURTI/i,
  /KURTA AND PANT/i,
  /KURTA AND SOLID/i,
  /KURTA AND PRINTED/i,
  /FARSI/i,
  /SET COMPOSITION/i,
  /^KURTI$/i,
  /^PANT$/i,
  /^DUPATTA$/i,
  /^TOP$/i,
];

const MANUFACTURING_KEYWORDS = [
  'HANDWORK', 'EMB', 'EMBROIDERY', 'NECK EMB', 'NECK AND SLEEVE EMB',
  'NECK EMBROIDERY', 'SLEEVE EMBROIDERY', 'FUSING IN COLLAR', 'FUSING',
  'HAND WORK', 'HAND EMB', 'MACHINE EMB', 'ZARI WORK', 'MIRROR WORK',
  'BLOCK PRINT', 'SCREEN PRINT', 'DIGITAL PRINT',
];

const ACCESSORY_KEYWORDS = [
  'LACE', 'BOTTOM LACE', 'NECK LACE', 'KALI LACE',
  'MOTI', 'SMALL SIZE MOTI', 'BIG SIZE MOTI',
  'BUTTONS', 'BUTTON', 'ZIP', 'ZIPPER',
  'DORI', 'PIPING', 'TASSEL', 'TAGAI',
  'FABRIC MOTI BUTTONS', 'ORGANZA',
];

function classifyLine(normalizedText: string): DetailCategory {
  const upper = normalizedText.toUpperCase();

  // Check composition patterns first (most specific)
  for (const pattern of COMPOSITION_PATTERNS) {
    if (pattern.test(upper)) return 'product_composition';
  }

  // Check manufacturing
  for (const kw of MANUFACTURING_KEYWORDS) {
    if (upper === kw || upper.startsWith(kw + ' ') || upper.endsWith(' ' + kw)) {
      return 'manufacturing_work';
    }
  }
  if (/^EMB\b/.test(upper) || /\bEMB$/.test(upper) || upper === 'EMB') return 'manufacturing_work';
  if (/FUSING/.test(upper)) return 'manufacturing_work';
  if (/HANDWORK|HAND WORK/.test(upper)) return 'manufacturing_work';
  if (/\bEMBROIDERY\b/.test(upper)) return 'manufacturing_work';

  // Check fabric
  for (const kw of FABRIC_KEYWORDS) {
    if (upper.includes(kw)) return 'fabric_material';
  }

  // Check accessory keywords
  for (const kw of ACCESSORY_KEYWORDS) {
    if (upper.includes(kw)) return 'accessory_raw_material';
  }

  if (upper.includes('=')) return 'accessory_raw_material';
  return 'accessory_raw_material';
}

// ─── Quantity parsing ─────────────────────────────────────────────────────────

interface ParsedQuantity {
  quantity: number | null;
  unit: string;
  secondaryQuantity: number | null;
  secondaryUnit: string;
  reviewStatus: ReviewStatus;
  reviewNote: string;
  materialName: string;
}

function parseQuantityFromLine(sourceText: string): ParsedQuantity {
  const normalized = normalizeText(sourceText);
  const eqMatch = normalized.match(/^(.+?)\s*=\s*(.*)$/);
  let materialPart = normalized;
  let quantityPart = '';

  if (eqMatch) {
    materialPart = eqMatch[1].trim();
    quantityPart = eqMatch[2].trim();
  }

  const dualQtyMatch = quantityPart.match(
    /^(\d+(?:\.\d+)?)\s*([A-Z]+)\s*\/\s*(\d+(?:\.\d+)?)\s*([A-Z]+)$/
  );
  if (dualQtyMatch) {
    return {
      materialName: materialPart,
      quantity: parseFloat(dualQtyMatch[1]),
      unit: normalizeUnit(dualQtyMatch[2]),
      secondaryQuantity: parseFloat(dualQtyMatch[3]),
      secondaryUnit: normalizeUnit(dualQtyMatch[4]),
      reviewStatus: 'ok',
      reviewNote: '',
    };
  }

  const singleQtyMatch = quantityPart.match(/^(\d+(?:\.\d+)?)\s*([A-Z]+(?:\s+[A-Z]+)?)$/);
  if (singleQtyMatch) {
    const unitParts = singleQtyMatch[2].split(/\s+/);
    const mainUnit = normalizeUnit(unitParts[0]);
    const notes = unitParts.slice(1).join(' ');
    return {
      materialName: materialPart,
      quantity: parseFloat(singleQtyMatch[1]),
      unit: mainUnit,
      secondaryQuantity: null,
      secondaryUnit: '',
      reviewStatus: 'ok',
      reviewNote: notes ? `Unit qualifier: ${notes}` : '',
    };
  }

  if (eqMatch && quantityPart === '') {
    return {
      materialName: materialPart,
      quantity: null,
      unit: '',
      secondaryQuantity: null,
      secondaryUnit: '',
      reviewStatus: 'quantity_required',
      reviewNote: 'Quantity missing in source',
    };
  }

  if (!eqMatch) {
    return {
      materialName: materialPart,
      quantity: null,
      unit: '',
      secondaryQuantity: null,
      secondaryUnit: '',
      reviewStatus: 'ok',
      reviewNote: '',
    };
  }

  return {
    materialName: materialPart,
    quantity: null,
    unit: '',
    secondaryQuantity: null,
    secondaryUnit: '',
    reviewStatus: 'needs_review',
    reviewNote: `Could not parse quantity from: "${quantityPart}"`,
  };
}

function normalizeUnit(unit: string): string {
  const u = unit.trim().toUpperCase();
  const map: Record<string, string> = {
    METERS: 'METER', METRES: 'METER', MTR: 'METER', 'MTR.': 'METER', METRE: 'METER',
    PIECES: 'PCS', 'PCS.': 'PCS',
    PACKET: 'PKT', PACKETS: 'PKT', 'PKT.': 'PKT',
  };
  return map[u] || u;
}

// ─── Set-type component helper ────────────────────────────────────────────────
// Returns product_composition lines for a given set type

function setTypeComponents(setType: string, itemNote: string): string[] {
  const st = setType.toUpperCase().trim();
  if (st === '3PCS' || st === '3-PIECE' || st === '3OCS') {
    return ['KURTI', 'PANT', 'DUPATTA'];
  }
  if (st === '2PCS' || st === '2-PIECE') {
    // 2-piece sets in this file are Kurta + Farsi (bottom)
    return ['KURTI', 'FARSI PANT'];
  }
  if (st === 'SINGLE KURTI' || st === 'SINGLE TOP') {
    return ['KURTI'];
  }
  if (st === 'SINGLE PANT') {
    return ['PANT'];
  }
  // Fallback: derive from item note
  if (/KURTA AND PANT/i.test(itemNote)) return ['KURTI', 'PANT'];
  if (/KURTA AND FARSI/i.test(itemNote)) return ['KURTI', 'FARSI PANT'];
  return [];
}

// ─── Raw data extracted from RANGRAAHI_WIP-1785846928470.xlsx ────────────────
// Each block = one colour variant (each colour is a separate item per business rule)
// Job Card number is reference only — identity is styleNo + colour
// Set type components are auto-generated as product_composition lines

export const RANGRAAHI_WIP_RAW_BLOCKS: Array<{
  jobCardNo: string;
  styleNo: string;
  setType: string;
  colour: string;
  fabrics: string[];
  itemNote: string;
  rowStart: number;
  rowEnd: number;
  accessories: string[];
  imageUrl?: string;
}> = [
  // ── JC 68 — Yellow ──────────────────────────────────────────────────────────
  {
    jobCardNo: '68',
    styleNo: '7448SKDYL',
    setType: '3PCS',
    colour: 'YELLOW',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA, PANT & SOLID USE IN NECK',
    rowStart: 2,
    rowEnd: 7,
    accessories: ['BOTTOM LACE', 'NECK LACE', 'KALI LACE', 'SMALL SIZE MOTI', 'BIG SIZE MOTI'],
    imageUrl: '',
  },
  // ── JC 68 — Blue ────────────────────────────────────────────────────────────
  {
    jobCardNo: '68',
    styleNo: '7448SKDBL',
    setType: '3PCS',
    colour: 'BLUE',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA, PANT & SOLID USE IN NECK',
    rowStart: 9,
    rowEnd: 14,
    accessories: ['BOTTOM LACE', 'NECK LACE', 'KALI LACE', 'SMALL SIZE MOTI', 'BIG SIZE MOTI'],
    imageUrl: '',
  },
  // ── JC 69 — Yellow ──────────────────────────────────────────────────────────
  {
    jobCardNo: '69',
    styleNo: '7445SKDYL',
    setType: '3PCS',
    colour: 'YELLOW',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND SOLID PANT',
    rowStart: 16,
    rowEnd: 21,
    accessories: ['LACE', 'ORGANZA', 'BIG SIZE MOTI'],
    imageUrl: '',
  },
  // ── JC 69 — Blue ────────────────────────────────────────────────────────────
  {
    jobCardNo: '69',
    styleNo: '7445SKDBL',
    setType: '3PCS',
    colour: 'BLUE',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND SOLID PANT',
    rowStart: 23,
    rowEnd: 28,
    accessories: ['LACE', 'ORGANZA', 'BIG SIZE MOTI'],
    imageUrl: '',
  },
  // ── JC 70 — Blue ────────────────────────────────────────────────────────────
  {
    jobCardNo: '70',
    styleNo: '7755SKDBL',
    setType: '3PCS',
    colour: 'BLUE',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND SOLID PANT',
    rowStart: 30,
    rowEnd: 35,
    accessories: ['BUTTONS', 'ZIP'],
    imageUrl: '',
  },
  // ── JC 71 — Blue (Single Top) ────────────────────────────────────────────────
  {
    jobCardNo: '71',
    styleNo: '7761TOPBL',
    setType: 'SINGLE TOP',
    colour: 'BLUE',
    fabrics: ['COTTON 60×60'],
    itemNote: 'PRINTED TOP AND FUSING IN COLLAR',
    rowStart: 37,
    rowEnd: 42,
    accessories: ['BUTTONS', 'FUSING IN COLLAR'],
    imageUrl: '',
  },
  // ── JC 72 — Yellow ──────────────────────────────────────────────────────────
  {
    jobCardNo: '72',
    styleNo: '7763SKDYL',
    setType: '3PCS',
    colour: 'YELLOW',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND SOLID PANT',
    rowStart: 44,
    rowEnd: 49,
    accessories: ['BUTTONS', 'DORI'],
    imageUrl: '',
  },
  // ── JC 73 — Blue ────────────────────────────────────────────────────────────
  {
    jobCardNo: '73',
    styleNo: '7763SKDBL',
    setType: '3PCS',
    colour: 'BLUE',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND SOLID PANT',
    rowStart: 51,
    rowEnd: 56,
    accessories: ['BUTTONS', 'DORI'],
    imageUrl: '',
  },
  // ── JC 74 — Yellow ──────────────────────────────────────────────────────────
  {
    jobCardNo: '74',
    styleNo: '7700SKDYL',
    setType: '3PCS',
    colour: 'YELLOW',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND SOLID PANT',
    rowStart: 58,
    rowEnd: 63,
    accessories: ['LACE', 'HANDWORK', 'EMB'],
    imageUrl: '',
  },
  // ── JC 84 — Black (Single Top) ───────────────────────────────────────────────
  {
    jobCardNo: '84',
    styleNo: '1C26KRTAR023',
    setType: 'SINGLE TOP',
    colour: 'BLACK',
    fabrics: ['COTTON 30×30 SLUB'],
    itemNote: '',
    rowStart: 65,
    rowEnd: 70,
    accessories: ['NECK AND SLEEVE EMB'],
    imageUrl: '',
  },
  // ── JC 85 — Wine (Single Top) ────────────────────────────────────────────────
  {
    jobCardNo: '85',
    styleNo: '1C26KRTAR023',
    setType: 'SINGLE TOP',
    colour: 'WINE',
    fabrics: ['COTTON 30×30 SLUB'],
    itemNote: '',
    rowStart: 72,
    rowEnd: 76,
    accessories: ['NECK AND SLEEVE EMB'],
    imageUrl: '',
  },
  // ── JC 91 — Red (Single Kurti) ───────────────────────────────────────────────
  {
    jobCardNo: '91',
    styleNo: 'JKSR1029',
    setType: 'SINGLE KURTI',
    colour: 'RED',
    fabrics: ['COTTON 40×60'],
    itemNote: 'FABRIC BUTTONS',
    rowStart: 78,
    rowEnd: 83,
    accessories: ['BITTONS'],
    imageUrl: '',
  },
  // ── JC 110 — Blue (3PCS) ─────────────────────────────────────────────────────
  {
    jobCardNo: '110',
    styleNo: '1932SKDNB',
    setType: '3PCS',
    colour: 'BLUE',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND PRINTED PANT',
    rowStart: 85,
    rowEnd: 90,
    accessories: ['PIPING', 'DORI', 'FABRIC MOTI BUTTONS', 'HANDWORK'],
    imageUrl: '',
  },
  // ── JC 111 — Rust (3PCS) ─────────────────────────────────────────────────────
  {
    jobCardNo: '111',
    styleNo: '1932SKDRT',
    setType: '3PCS',
    colour: 'RUST',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND PRINTED PANT',
    rowStart: 91,
    rowEnd: 96,
    accessories: ['PIPING', 'DORI', 'FABRIC MOTI BUTTONS', 'HANDWORK'],
    imageUrl: '',
  },
  // ── JC 112 — Wine (3PCS) ─────────────────────────────────────────────────────
  {
    jobCardNo: '112',
    styleNo: '19932SKDBUG',
    setType: '3PCS',
    colour: 'WINE',
    fabrics: ['COTTON 60×60', 'COTTON 60×60', 'MALMAL 100×100'],
    itemNote: 'PRINTED KURTA AND PRINTED PANT',
    rowStart: 98,
    rowEnd: 103,
    accessories: ['PIPING', 'DORI', 'FABRIC MOTI BUTTONS', 'HANDWORK'],
    imageUrl: '',
  },
  // ── JC 115 — Navy Blue + Red Farsi (2PCS) ────────────────────────────────────
  {
    jobCardNo: '115',
    styleNo: '1B26KFPY001',
    setType: '2PCS',
    colour: 'NAVY BLUE KURTA AND RED FARSI',
    fabrics: ['COTTON 60×60', 'COTTON 60×60'],
    itemNote: 'PRINTED KURTA AND SOLID FARSI',
    rowStart: 105,
    rowEnd: 110,
    accessories: ['TASSEL', 'TAGAI'],
    imageUrl: '',
  },
  // ── JC 116 — Rust + Blue Farsi (2PCS) ────────────────────────────────────────
  {
    jobCardNo: '116',
    styleNo: '1B26KFPT001',
    setType: '2PCS',
    colour: 'RUST KURTA AND BLUE FARSI',
    fabrics: ['COTTON 60×60', 'COTTON 60×60'],
    itemNote: 'PRINTED KURTA AND SOLID FARSI',
    rowStart: 112,
    rowEnd: 117,
    accessories: ['TASSEL', 'TAGAI'],
    imageUrl: '',
  },
  // ── JC 117 — Wine + Offwhite Farsi (2PCS) ────────────────────────────────────
  {
    jobCardNo: '117',
    styleNo: '1B26KFPT001',
    setType: '2PCS',
    colour: 'WINE KURTA AND OFFWHITE FARSI',
    fabrics: ['COTTON 60×60', 'COTTON 60×60'],
    itemNote: 'PRINTED KURTA AND SOLID FARSI',
    rowStart: 119,
    rowEnd: 124,
    accessories: ['TASSEL', 'TAGAI'],
    imageUrl: '',
  },
  // ── JC 118 — Red Farsi (Single Pant) ─────────────────────────────────────────
  {
    jobCardNo: '118',
    styleNo: '1A26FSWRR001',
    setType: 'SINGLE PANT',
    colour: 'RED FARSI',
    fabrics: ['COTTON 60×60'],
    itemNote: '',
    rowStart: 126,
    rowEnd: 130,
    accessories: ['TAGAI'],
    imageUrl: '',
  },
  // ── JC 121 — Green (Single Kurti) ────────────────────────────────────────────
  {
    jobCardNo: '121',
    styleNo: '1B24KRTAR0016',
    setType: 'SINGLE KURTI',
    colour: 'GREEN',
    fabrics: ['RAYON SLUB'],
    itemNote: '',
    rowStart: 132,
    rowEnd: 137,
    accessories: ['NECK EMB'],
    imageUrl: '',
  },
  // ── JC 122 — Black (Single Kurti) ────────────────────────────────────────────
  {
    jobCardNo: '122',
    styleNo: '1B24KRTAR0016',
    setType: 'SINGLE KURTI',
    colour: 'BLACK',
    fabrics: ['RAYON SLUB'],
    itemNote: '',
    rowStart: 139,
    rowEnd: 144,
    accessories: ['NECK EMB'],
    imageUrl: '',
  },
  // ── JC 123 — Teal (Single Kurti) ─────────────────────────────────────────────
  {
    jobCardNo: '123',
    styleNo: '1B24KRTAR0016',
    setType: 'SINGLE KURTI',
    colour: 'TEAL',
    fabrics: ['RAYON SLUB'],
    itemNote: '',
    rowStart: 146,
    rowEnd: 151,
    accessories: ['NECK EMB'],
    imageUrl: '',
  },
];

// ─── Mismatch checks ──────────────────────────────────────────────────────────
// JC 68: two colour variants share the same JC number — each has a unique style code.
// This is expected per business rule (colour = separate item, JC is reference only).
// JC 69: same pattern.
// JC 84 & 85: same style code (1C26KRTAR023) but different JC numbers — flagged below.
// JC 116 & 117: same style code (1B26KFPT001) but different JC numbers — flagged below.
// JC 121, 122, 123: same style code (1B24KRTAR0016) but different JC numbers — flagged below.

const STYLE_NO_MISMATCH_FLAGS: string[] = [
  'JC 84 & 85 share style code 1C26KRTAR023 — different JC numbers, different colours (Black / Wine). Verify if these are the same design.',
  'JC 116 & 117 share style code 1B26KFPT001 — different JC numbers, different colour combos (Rust+Blue / Wine+Offwhite). Verify if same design.',
  'JC 121, 122 & 123 share style code 1B24KRTAR0016 — different JC numbers, same design in Green / Black / Teal. Verify if same design.',
  'JC 68 has two colour variants (Yellow: 7448SKDYL, Blue: 7448SKDBL) under the same JC number — treated as separate items per business rule.',
  'JC 69 has two colour variants (Yellow: 7445SKDYL, Blue: 7445SKDBL) under the same JC number — treated as separate items per business rule.',
  'JC 72 (Yellow) and JC 73 (Blue) share the same base style 7763SKD — different JC numbers assigned. Verify if intentional.',
  'JC 110 (Blue: 1932SKDNB) and JC 111 (Rust: 1932SKDRT) appear to be colour variants of the same base design 1932SKD — assigned different JC numbers.',
];

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseRangraahiWIP(): ImportParseResult {
  const styleMap = new Map<string, ParsedStyleGroup>();
  const warnings: string[] = [...STYLE_NO_MISMATCH_FLAGS];
  let totalDetailLines = 0;
  let missingQuantities = 0;
  let reviewRequired = 0;

  for (const block of RANGRAAHI_WIP_RAW_BLOCKS) {
    const jcn = normalizeJobCardNo(block.jobCardNo);
    const colourNorm = normalizeColour(block.colour);
    // Import key uses styleNo + colour so each colour variant is truly unique
    const variantKey = `RANGRAAHI_WIP:${block.styleNo}:${colourNorm}`;
    const styleKey = `RANGRAAHI_WIP_STYLE:${block.styleNo}`;

    // Build detail lines
    const detailLines: ParsedDetailLine[] = [];

    // 1. Fabric lines
    for (let fi = 0; fi < block.fabrics.length; fi++) {
      const fabric = block.fabrics[fi];
      if (!fabric) continue;
      const normalized = normalizeText(fabric);
      detailLines.push({
        category: 'fabric_material',
        materialName: fabric,
        materialNameNormalized: normalized,
        quantity: null,
        unit: '',
        secondaryQuantity: null,
        secondaryUnit: '',
        notes: `Fabric ${fi + 1}`,
        sourceText: fabric,
        sourceRow: block.rowStart,
        reviewStatus: 'ok',
        reviewNote: '',
      });
      totalDetailLines++;
    }

    // 2. Set-type composition lines (Kurti / Pant / Dupatta etc.)
    const components = setTypeComponents(block.setType, block.itemNote);
    for (const comp of components) {
      const normalized = normalizeText(comp);
      detailLines.push({
        category: 'product_composition',
        materialName: comp,
        materialNameNormalized: normalized,
        quantity: null,
        unit: '',
        secondaryQuantity: null,
        secondaryUnit: '',
        notes: `Component of ${block.setType}`,
        sourceText: comp,
        sourceRow: block.rowStart,
        reviewStatus: 'ok',
        reviewNote: '',
      });
      totalDetailLines++;
    }

    // 3. Item note as composition line (if present and not already covered)
    if (block.itemNote) {
      const normalized = normalizeText(block.itemNote);
      detailLines.push({
        category: 'product_composition',
        materialName: block.itemNote,
        materialNameNormalized: normalized,
        quantity: null,
        unit: '',
        secondaryQuantity: null,
        secondaryUnit: '',
        notes: 'Item note from WIP sheet',
        sourceText: block.itemNote,
        sourceRow: block.rowStart,
        reviewStatus: 'ok',
        reviewNote: '',
      });
      totalDetailLines++;
    }

    // 4. Accessories / embellishments
    for (let i = 0; i < block.accessories.length; i++) {
      const raw = block.accessories[i];
      if (!raw || !raw.trim()) continue;

      const normalized = normalizeText(raw);
      const category = classifyLine(normalized);
      const parsed = parseQuantityFromLine(raw);

      const line: ParsedDetailLine = {
        category,
        materialName: parsed.materialName,
        materialNameNormalized: normalizeText(parsed.materialName),
        quantity: parsed.quantity,
        unit: parsed.unit,
        secondaryQuantity: parsed.secondaryQuantity,
        secondaryUnit: parsed.secondaryUnit,
        notes: parsed.reviewNote,
        sourceText: raw,
        sourceRow: block.rowStart + i,
        reviewStatus: parsed.reviewStatus,
        reviewNote: parsed.reviewNote,
      };

      if (parsed.reviewStatus === 'quantity_required' || parsed.reviewStatus === 'needs_review') {
        reviewRequired++;
        if (parsed.quantity === null && category === 'accessory_raw_material') {
          missingQuantities++;
        }
      }

      detailLines.push(line);
      totalDetailLines++;
    }

    const variant: ParsedVariantBlock = {
      jobCardNo: jcn,
      styleNo: block.styleNo,
      setType: block.setType,
      colour: block.colour,
      colourNormalized: colourNorm,
      importKey: variantKey,
      sourceRowStart: block.rowStart,
      sourceRowEnd: block.rowEnd,
      detailLines,
      rawAccessoriesLines: block.accessories,
      fabrics: block.fabrics,
      itemNote: block.itemNote,
      imageUrl: block.imageUrl || '',
    };

    if (!styleMap.has(styleKey)) {
      styleMap.set(styleKey, {
        jobCardNo: jcn,
        styleNo: block.styleNo,
        setType: block.setType,
        importKey: styleKey,
        variants: [],
      });
    }
    styleMap.get(styleKey)!.variants.push(variant);
  }

  const styleGroups = Array.from(styleMap.values());

  return {
    styleGroups,
    totalBlocks: RANGRAAHI_WIP_RAW_BLOCKS.length,
    totalDetailLines,
    missingQuantities,
    reviewRequired,
    warnings,
  };
}

// Generate a stable import key for a detail line
export function generateDetailLineKey(
  variantImportKey: string,
  materialNameNormalized: string,
  quantity: number | null,
  unit: string,
  sourceText: string
): string {
  const qty = quantity !== null ? String(quantity) : 'NULL';
  return `${variantImportKey}:${materialNameNormalized}:${qty}:${unit}:${sourceText.slice(0, 40)}`;
}
