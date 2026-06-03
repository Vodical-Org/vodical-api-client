import { LogicalFamily, resolveFontFamily } from './fonts';

export interface Run {
  text: string; // '\n' = saut de ligne forcé
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  family: LogicalFamily;
  color?: string; // valeur CSS (hex ou rgb())
  fontSizePx?: number; // taille explicite (sinon défaut du bloc)
  highlight?: string; // couleur de fond (surlignage)
}

export type BlockType = 'paragraph' | 'heading' | 'listItem' | 'blockquote' | 'table';
export type Align = 'left' | 'center' | 'right' | 'justify';

export interface ListMarker {
  kind: 'bullet' | 'number';
  index?: number;
}

export interface TableCellData {
  isHeader: boolean;
  blocks: Block[];
}
export interface TableRowData {
  cells: TableCellData[];
}
export interface TableData {
  rows: TableRowData[];
  columnCount: number;
}

export interface Block {
  type: BlockType;
  align: Align;
  indentPx: number;
  runs: Run[];
  lineHeight?: number; // multiplicateur
  headingSize?: number; // taille par défaut pour un titre
  listMarker?: ListMarker;
  table?: TableData;
}

interface Ctx {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  family: LogicalFamily;
  color?: string;
  fontSizePx?: number;
  highlight?: string;
}

interface BlockMeta {
  type: BlockType;
  align: Align;
  indentPx: number;
  lineHeight?: number;
  headingSize?: number;
  listMarker?: ListMarker;
}

// Tailles alignées sur le rendu web (Tailwind `prose-sm` dans SummaryRenderer).
// Le web utilise des px sur un body de 12px ; le PDF utilise des pt sur un body de 11pt.
// On conserve la même proportion : pdf_pt = web_px * (11/12).
const HEADING_SIZES: Record<number, number> = { 1: 18, 2: 16, 3: 15, 4: 13, 5: 12, 6: 11 };
const LIST_INDENT = 18;
const QUOTE_INDENT = 16;

const BLOCK_TAGS = new Set([
  'p', 'div', 'ul', 'ol', 'li', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'table',
]);

/** Convertit un éventuel markdown inline en HTML, sans toucher aux spans existants. */
function normalizeForParse(html: string): string {
  // Contenu sans balise (texte/markdown brut) : préserver les retours à la ligne.
  let s = html;
  if (!/<[a-z][\s\S]*>/i.test(s)) {
    s = s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    s = `<p>${s}</p>`;
  }
  return s
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n<>]+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/__([^_\n<>]+?)__/g, '<u>$1</u>')
    .replace(/~~([^~\n<>]+?)~~/g, '<s>$1</s>');
}

function parsePx(value?: string | null): number | undefined {
  if (!value) return undefined;
  const m = value.match(/([\d.]+)\s*px/i);
  if (m) return parseFloat(m[1]); // treat px label as pt so "11" in editor = 11 in PDF
  const pt = value.match(/([\d.]+)\s*pt/i);
  if (pt) return parseFloat(pt[1]);
  const em = value.match(/([\d.]+)\s*em/i);
  if (em) return parseFloat(em[1]) * 16; // 1em = 16px → 16pt
  return undefined;
}

function readAlign(el: HTMLElement): Align | undefined {
  const a = el.style.textAlign;
  if (a === 'left' || a === 'center' || a === 'right' || a === 'justify') return a;
  return undefined;
}

function readLineHeight(el: HTMLElement): number | undefined {
  const lh = el.style.lineHeight;
  if (!lh || lh === 'normal') return undefined;
  const n = parseFloat(lh);
  return Number.isFinite(n) ? n : undefined;
}

function readIndent(el: HTMLElement): number {
  const dataIndent = el.getAttribute('data-indent');
  if (dataIndent) {
    const lvl = parseInt(dataIndent, 10);
    if (Number.isFinite(lvl)) return lvl * 24;
  }
  return parsePx(el.style.paddingLeft) ?? 0;
}

function deriveCtx(el: HTMLElement, ctx: Ctx): Ctx {
  const next: Ctx = { ...ctx };
  const tag = el.tagName.toLowerCase();

  if (tag === 'strong' || tag === 'b') next.bold = true;
  if (tag === 'em' || tag === 'i') next.italic = true;
  if (tag === 'u') next.underline = true;
  if (tag === 's' || tag === 'strike' || tag === 'del') next.strike = true;
  if (tag === 'mark') {
    next.highlight =
      el.getAttribute('data-color') || el.style.backgroundColor || '#fff3a3';
  }

  const st = el.style;
  if (st) {
    const fw = st.fontWeight;
    if (fw && (fw === 'bold' || fw === 'bolder' || parseInt(fw, 10) >= 600)) next.bold = true;
    if (st.fontStyle === 'italic') next.italic = true;
    const td = `${st.textDecoration || ''} ${(st as CSSStyleDeclaration & { textDecorationLine?: string }).textDecorationLine || ''}`;
    if (td.includes('underline')) next.underline = true;
    if (td.includes('line-through')) next.strike = true;
    if (st.color) next.color = st.color;
    const fs = parsePx(st.fontSize);
    if (fs) next.fontSizePx = fs;
    if (st.fontFamily) next.family = resolveFontFamily(st.fontFamily);
    const bg = st.backgroundColor;
    if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') next.highlight = bg;
  }

  return next;
}

function runFromCtx(text: string, ctx: Ctx): Run {
  return {
    text,
    bold: ctx.bold,
    italic: ctx.italic,
    underline: ctx.underline,
    strike: ctx.strike,
    family: ctx.family,
    color: ctx.color,
    fontSizePx: ctx.fontSizePx,
    highlight: ctx.highlight,
  };
}

function walkInline(node: Node, ctx: Ctx, runs: Run[]): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.textContent || '').replace(/\s+/g, ' ');
    if (t) runs.push(runFromCtx(t, ctx));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  if (el.tagName.toLowerCase() === 'br') {
    runs.push(runFromCtx('\n', ctx));
    return;
  }
  const next = deriveCtx(el, ctx);
  for (const child of Array.from(el.childNodes)) walkInline(child, next, runs);
}

function parseContainer(el: HTMLElement, ctx: Ctx, meta: BlockMeta, blocks: Block[]): void {
  let buffer: Run[] = [];

  const flush = () => {
    if (buffer.some((r) => r.text.trim() !== '' || r.text === '\n')) {
      blocks.push({ ...meta, runs: buffer });
    }
    buffer = [];
  };

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent || '').replace(/\s+/g, ' ');
      if (t.trim()) buffer.push(runFromCtx(t, ctx));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const ce = child as HTMLElement;
    const tag = ce.tagName.toLowerCase();
    if (tag === 'br') {
      buffer.push(runFromCtx('\n', ctx));
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      flush();
      handleBlockElement(ce, ctx, meta, blocks);
    } else {
      walkInline(ce, deriveCtx(ce, ctx), buffer);
    }
  }

  flush();
}

function handleBlockElement(el: HTMLElement, ctx: Ctx, parentMeta: BlockMeta, blocks: Block[]): void {
  const tag = el.tagName.toLowerCase();
  const align = readAlign(el) ?? parentMeta.align;
  const lineHeight = readLineHeight(el) ?? parentMeta.lineHeight;
  const indentPx = parentMeta.indentPx + readIndent(el);

  if (tag === 'ul' || tag === 'ol') {
    let idx = 1;
    for (const child of Array.from(el.children)) {
      if (child.tagName.toLowerCase() !== 'li') continue;
      const marker: ListMarker =
        tag === 'ol' ? { kind: 'number', index: idx } : { kind: 'bullet' };
      idx += 1;
      const liMeta: BlockMeta = {
        type: 'listItem',
        align,
        lineHeight,
        indentPx: indentPx + LIST_INDENT,
        listMarker: marker,
      };
      parseContainer(child as HTMLElement, ctx, liMeta, blocks);
    }
    return;
  }

  if (tag === 'table') {
    const rows: TableRowData[] = [];
    let columnCount = 0;
    // Collecte des <tr> dans thead/tbody/tfoot ou en enfants directs
    const trs: HTMLElement[] = [];
    const collectTr = (node: HTMLElement) => {
      for (const c of Array.from(node.children)) {
        const t = c.tagName.toLowerCase();
        if (t === 'tr') trs.push(c as HTMLElement);
        else if (t === 'thead' || t === 'tbody' || t === 'tfoot') collectTr(c as HTMLElement);
      }
    };
    collectTr(el);
    for (const tr of trs) {
      const cells: TableCellData[] = [];
      for (const c of Array.from(tr.children)) {
        const t = c.tagName.toLowerCase();
        if (t !== 'td' && t !== 'th') continue;
        const cellBlocks: Block[] = [];
        const cellMeta: BlockMeta = { type: 'paragraph', align: 'left', indentPx: 0 };
        parseContainer(c as HTMLElement, { ...ctx, bold: t === 'th' ? true : ctx.bold }, cellMeta, cellBlocks);
        // Si la cellule est vide, on ajoute un bloc paragraphe vide pour préserver la hauteur
        if (cellBlocks.length === 0) {
          cellBlocks.push({ type: 'paragraph', align: 'left', indentPx: 0, runs: [runFromCtx(' ', ctx)] });
        }
        cells.push({ isHeader: t === 'th', blocks: cellBlocks });
      }
      if (cells.length) {
        rows.push({ cells });
        if (cells.length > columnCount) columnCount = cells.length;
      }
    }
    if (rows.length === 0 || columnCount === 0) return;
    blocks.push({
      type: 'table',
      align: 'left',
      indentPx,
      runs: [],
      table: { rows, columnCount },
    });
    return;
  }

  if (tag === 'blockquote') {
    const meta: BlockMeta = {
      type: 'blockquote',
      align,
      lineHeight,
      indentPx: indentPx + QUOTE_INDENT,
    };
    parseContainer(el, ctx, meta, blocks);
    return;
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag[1], 10);
    const meta: BlockMeta = {
      type: 'heading',
      align,
      lineHeight,
      indentPx,
      headingSize: HEADING_SIZES[level],
    };
    parseContainer(el, { ...ctx, bold: true }, meta, blocks);
    return;
  }

  // p, div, ou tout autre conteneur de bloc
  const meta: BlockMeta = { type: 'paragraph', align, lineHeight, indentPx };
  const before = blocks.length;
  parseContainer(el, ctx, meta, blocks);
  // Préserver les paragraphes vides (espacement vertical du rendu web).
  // On utilise un saut de ligne explicite : le moteur de mise en page traite
  // '\n' comme un retour de ligne et produit une ligne vide de la bonne hauteur,
  // alors qu'un simple espace serait ignoré (pas d'espace en début de ligne).
  if (blocks.length === before && (tag === 'p' || tag === 'div')) {
    blocks.push({ ...meta, runs: [runFromCtx('\n', ctx)] });
  }
}

/** Parse du HTML Tiptap en blocs + runs portant tout le style (couleur, taille, police, etc.). */
export function parseHtmlToBlocks(html: string): Block[] {
  if (!html || !html.trim()) return [];
  const div = document.createElement('div');
  div.innerHTML = normalizeForParse(html);

  const blocks: Block[] = [];
  const rootCtx: Ctx = {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    family: 'arial',
  };
  const rootMeta: BlockMeta = { type: 'paragraph', align: 'left', indentPx: 0 };
  parseContainer(div, rootCtx, rootMeta, blocks);
  return blocks;
}

/** Familles de polices réellement utilisées (pour n'embarquer que le nécessaire). */
export function collectFamilies(blocks: Block[]): Set<LogicalFamily> {
  const set = new Set<LogicalFamily>();
  const walk = (bs: Block[]) => {
    for (const b of bs) {
      for (const r of b.runs) set.add(r.family);
      if (b.table) {
        for (const row of b.table.rows) {
          for (const cell of row.cells) walk(cell.blocks);
        }
      }
    }
  };
  walk(blocks);
  return set;
}
