import { PDFDocument, PDFFont, PDFPage, rgb, RGB } from 'pdf-lib';
import { Block } from './parseHtml';
import { LogicalFamily, PdfFontRegistry, pickFont } from './fonts';
import { PAGE_PT_TUPLE, MARGIN_PT, DEFAULT_LINE_HEIGHT as GEOM_LINE_HEIGHT } from '../pageGeometry';

const DEFAULT_LINE_HEIGHT = GEOM_LINE_HEIGHT;
const ASCENT_RATIO = 0.8;
const A4: [number, number] = PAGE_PT_TUPLE;

// Strip non-BMP characters (emoji, etc.) and lone surrogates that TTF fonts
// typically don't embed — pdf-lib throws "beyond buffer length" for these.
function toSafeText(text: string): string {
  return text.replace(/[^\x00-￿]/gu, '').replace(/[\uD800-\uDFFF]/g, '');
}

const NAMED_COLORS: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  yellow: [255, 255, 0],
  orange: [255, 165, 0],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

export function parseCssColor(css?: string): RGB | undefined {
  if (!css) return undefined;
  const s = css.trim().toLowerCase();
  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return rgb(r / 255, g / 255, b / 255);
    }
    return undefined;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    if (p.length >= 3 && p.every((n) => Number.isFinite(n)))
      return rgb(p[0] / 255, p[1] / 255, p[2] / 255);
  }
  const named = NAMED_COLORS[s];
  if (named) return rgb(named[0] / 255, named[1] / 255, named[2] / 255);
  return undefined;
}

interface Item {
  text: string;
  isSpace: boolean;
  font: PDFFont;
  size: number;
  color: RGB;
  highlight?: RGB;
  underline: boolean;
  strike: boolean;
  width: number;
}

interface PlacedRun {
  text: string;
  font: PDFFont;
  size: number;
  color: RGB;
  x: number; // offset depuis la gauche de la boîte
  width: number;
  underline: boolean;
  strike: boolean;
  highlight?: RGB;
}

interface Line {
  kind?: 'line';
  runs: PlacedRun[];
  height: number;
  ascent: number;
  spaceBefore: number;
}

interface TableCellRender {
  lines: Line[];
  isHeader: boolean;
  contentHeight: number;
}

interface TableRowRender {
  kind: 'table-row';
  height: number;
  spaceBefore: number;
  left: number; // décalage depuis bord gauche de la boîte (= indentPx)
  totalWidth: number;
  columnWidths: number[];
  cells: TableCellRender[];
}

type RenderItem = Line | TableRowRender;

interface LayoutCtx {
  fonts: PdfFontRegistry;
  defaultFamily: LogicalFamily;
  defaultFontSize: number;
  width: number;
}

const TABLE_CELL_PADDING = 4; // pt
const TABLE_BORDER_THICKNESS = 0.5;
const TABLE_BORDER_COLOR = rgb(212 / 255, 212 / 255, 212 / 255);
const TABLE_HEADER_BG = rgb(245 / 255, 245 / 255, 245 / 255);
const TABLE_VERTICAL_MARGIN = 6; // pt avant/après tableau

function hardBreakWord(
  text: string,
  font: PDFFont,
  size: number,
  availWidth: number,
  base: Omit<Item, 'text' | 'width' | 'isSpace'>,
): Item[] {
  const out: Item[] = [];
  let cur = '';
  const flush = () => {
    if (cur) out.push({ ...base, text: cur, isSpace: false, width: font.widthOfTextAtSize(cur, size) });
    cur = '';
  };
  for (const ch of text) {
    const test = cur + ch;
    if (font.widthOfTextAtSize(test, size) > availWidth && cur) {
      flush();
      cur = ch;
    } else {
      cur = test;
    }
  }
  flush();
  return out;
}

function layoutOneBlock(block: Block, ctx: LayoutCtx, notFirst: boolean): Line[] {
  const blockDefaultSize =
    block.type === 'heading' ? block.headingSize ?? ctx.defaultFontSize : ctx.defaultFontSize;
  const lhMult = block.lineHeight ?? DEFAULT_LINE_HEIGHT;

  // Puce / numéro de liste
  let markerSlot = 0;
  let markerPlaced: PlacedRun | undefined;
  if (block.listMarker) {
    const mtext = block.listMarker.kind === 'number' ? `${block.listMarker.index ?? 1}.` : '•';
    const mfont = pickFont(ctx.fonts, 'arial', false, false);
    const mwidth = mfont.widthOfTextAtSize(mtext, blockDefaultSize);
    markerSlot = Math.max(16, mwidth + 6);
    markerPlaced = {
      text: mtext,
      font: mfont,
      size: blockDefaultSize,
      color: rgb(0, 0, 0),
      x: block.indentPx,
      width: mwidth,
      underline: false,
      strike: false,
    };
  }

  const contentLeft = block.indentPx + markerSlot;
  const availWidth = Math.max(10, ctx.width - contentLeft);

  // Tokenisation
  const tokens: Array<Item | { break: true }> = [];
  for (const run of block.runs) {
    if (run.text === '\n') {
      tokens.push({ break: true });
      continue;
    }
    const size = run.fontSizePx ?? blockDefaultSize;
    const font = pickFont(ctx.fonts, run.family, run.bold, run.italic);
    const color = parseCssColor(run.color) ?? rgb(0, 0, 0);
    const highlight = parseCssColor(run.highlight);
    const base = { font, size, color, highlight, underline: run.underline, strike: run.strike };
    for (const part of toSafeText(run.text).split(/(\s+)/)) {
      if (part === '') continue;
      const isSpace = /^\s+$/.test(part);
      const text = isSpace ? ' ' : part;
      tokens.push({ ...base, text, isSpace, width: font.widthOfTextAtSize(text, size) });
    }
  }

  // Découpage en lignes (word-wrap)
  const rawLines: Item[][] = [];
  let cur: Item[] = [];
  let curWidth = 0;
  const flush = () => {
    rawLines.push(cur);
    cur = [];
    curWidth = 0;
  };

  for (const tk of tokens) {
    if ('break' in tk) {
      flush();
      continue;
    }
    if (tk.isSpace) {
      if (cur.length === 0) continue; // pas d'espace en début de ligne
      cur.push(tk);
      curWidth += tk.width;
      continue;
    }
    if (tk.width > availWidth) {
      const chunks = hardBreakWord(tk.text, tk.font, tk.size, availWidth, tk);
      for (let i = 0; i < chunks.length; i += 1) {
        const c = chunks[i];
        if (curWidth + c.width > availWidth && cur.some((it) => !it.isSpace)) flush();
        cur.push(c);
        curWidth += c.width;
        if (i < chunks.length - 1) flush();
      }
      continue;
    }
    if (curWidth + tk.width > availWidth && cur.some((it) => !it.isSpace)) flush();
    cur.push(tk);
    curWidth += tk.width;
  }
  if (cur.length) flush();
  if (rawLines.length === 0) return [];

  // Construction des lignes + alignement
  const lines: Line[] = [];
  for (let li = 0; li < rawLines.length; li += 1) {
    let items = rawLines[li];
    while (items.length && items[items.length - 1].isSpace) items = items.slice(0, -1);

    const isLast = li === rawLines.length - 1;
    const natural = items.reduce((s, it) => s + it.width, 0);
    const maxSize = items.length ? Math.max(...items.map((it) => it.size)) : blockDefaultSize;
    const height = maxSize * lhMult;
    const ascent = maxSize * ASCENT_RATIO;

    let startX = contentLeft;
    let spaceExtra = 0;
    if (block.align === 'right') startX = contentLeft + (availWidth - natural);
    else if (block.align === 'center') startX = contentLeft + (availWidth - natural) / 2;
    else if (block.align === 'justify' && !isLast) {
      const spaces = items.filter((it) => it.isSpace).length;
      if (spaces > 0) spaceExtra = (availWidth - natural) / spaces;
    }

    let x = Math.max(0, startX);
    const placed: PlacedRun[] = [];
    for (const it of items) {
      if (it.text !== '') {
        placed.push({
          text: it.text,
          font: it.font,
          size: it.size,
          color: it.color,
          x,
          width: it.width,
          underline: it.underline && !it.isSpace,
          strike: it.strike && !it.isSpace,
          highlight: it.highlight,
        });
      }
      x += it.width + (it.isSpace ? spaceExtra : 0);
    }

    if (li === 0 && markerPlaced) placed.unshift(markerPlaced);

    lines.push({
      runs: placed,
      height,
      ascent,
      spaceBefore: li === 0 && notFirst ? maxSize * 0.35 : 0,
    });
  }
  return lines;
}

function layoutTable(block: Block, ctx: LayoutCtx, notFirst: boolean): TableRowRender[] {
  if (!block.table) return [];
  const { rows, columnCount } = block.table;
  const tableLeft = block.indentPx;
  const totalWidth = Math.max(40, ctx.width - tableLeft);
  // Largeurs équiréparties
  const colWidth = totalWidth / columnCount;
  const columnWidths = Array.from({ length: columnCount }, () => colWidth);

  const out: TableRowRender[] = [];
  rows.forEach((row, rowIdx) => {
    // Compléter les cellules manquantes par des vides pour rester aligné
    const cells: TableCellRender[] = [];
    let maxContent = 0;
    for (let i = 0; i < columnCount; i += 1) {
      const cell = row.cells[i];
      const innerWidth = Math.max(10, columnWidths[i] - 2 * TABLE_CELL_PADDING);
      if (!cell) {
        cells.push({ lines: [], isHeader: false, contentHeight: 0 });
        continue;
      }
      const cellLines = layoutBlocksInternal(cell.blocks, {
        fonts: ctx.fonts,
        defaultFamily: ctx.defaultFamily,
        defaultFontSize: ctx.defaultFontSize,
        width: innerWidth,
      }).filter((it): it is Line => (it as TableRowRender).kind !== 'table-row');
      const content = cellLines.reduce((s, l) => s + l.spaceBefore + l.height, 0);
      if (content > maxContent) maxContent = content;
      cells.push({ lines: cellLines, isHeader: cell.isHeader, contentHeight: content });
    }
    const rowHeight = maxContent + 2 * TABLE_CELL_PADDING;
    out.push({
      kind: 'table-row',
      height: rowHeight,
      spaceBefore: rowIdx === 0 ? (notFirst ? TABLE_VERTICAL_MARGIN : 0) : 0,
      left: tableLeft,
      totalWidth,
      columnWidths,
      cells,
    });
  });
  // Marge après le tableau : reportée sur l'item suivant via son `spaceBefore`
  // serait plus propre, mais on l'ajoute simplement à la dernière ligne.
  if (out.length > 0) {
    out[out.length - 1] = { ...out[out.length - 1], height: out[out.length - 1].height + TABLE_VERTICAL_MARGIN };
  }
  return out;
}

function layoutBlocksInternal(blocks: Block[], ctx: LayoutCtx): RenderItem[] {
  const out: RenderItem[] = [];
  blocks.forEach((block, i) => {
    if (block.type === 'table') {
      out.push(...layoutTable(block, ctx, i > 0));
    } else {
      out.push(...layoutOneBlock(block, ctx, i > 0));
    }
  });
  return out;
}

function layoutBlocks(blocks: Block[], ctx: LayoutCtx): RenderItem[] {
  return layoutBlocksInternal(blocks, ctx);
}

function drawLine(page: PDFPage, line: Line, boxLeft: number, baseline: number): void {
  // 1) surlignages d'abord (derrière le texte)
  for (const r of line.runs) {
    if (!r.highlight || !r.text.trim()) continue;
    page.drawRectangle({
      x: boxLeft + r.x,
      y: baseline - r.size * 0.22,
      width: r.width,
      height: r.size * 1.05,
      color: r.highlight,
    });
  }
  // 2) texte + décorations
  for (const r of line.runs) {
    if (r.text === '') continue;
    const x = boxLeft + r.x;
    if (r.text.trim() !== '') {
      try {
        page.drawText(r.text, { x, y: baseline, size: r.size, font: r.font, color: r.color });
      } catch {
        // Skip text containing characters not supported by the embedded font
      }
    }
    const thickness = Math.max(0.5, r.size * 0.05);
    if (r.underline) {
      const uy = baseline - r.size * 0.12;
      page.drawLine({ start: { x, y: uy }, end: { x: x + r.width, y: uy }, thickness, color: r.color });
    }
    if (r.strike) {
      const sy = baseline + r.size * 0.28;
      page.drawLine({ start: { x, y: sy }, end: { x: x + r.width, y: sy }, thickness, color: r.color });
    }
  }
}

export interface DrawBoxOptions {
  x: number;
  y: number; // bord supérieur de la boîte (coords PDF, origine en bas)
  width: number;
  fonts: PdfFontRegistry;
  defaultFamily: LogicalFamily;
  defaultFontSize: number;
}

function drawTableRow(page: PDFPage, row: TableRowRender, boxLeft: number, topY: number): void {
  // 1) Fond des cellules d'en-tête
  let x = boxLeft + row.left;
  row.cells.forEach((cell, i) => {
    const w = row.columnWidths[i];
    if (cell.isHeader) {
      page.drawRectangle({
        x,
        y: topY - row.height,
        width: w,
        height: row.height,
        color: TABLE_HEADER_BG,
      });
    }
    x += w;
  });

  // 2) Bordures de cellules
  x = boxLeft + row.left;
  row.cells.forEach((_, i) => {
    const w = row.columnWidths[i];
    const cellTop = topY;
    const cellBottom = topY - row.height;
    page.drawLine({ start: { x, y: cellTop }, end: { x: x + w, y: cellTop }, thickness: TABLE_BORDER_THICKNESS, color: TABLE_BORDER_COLOR });
    page.drawLine({ start: { x, y: cellBottom }, end: { x: x + w, y: cellBottom }, thickness: TABLE_BORDER_THICKNESS, color: TABLE_BORDER_COLOR });
    page.drawLine({ start: { x, y: cellTop }, end: { x, y: cellBottom }, thickness: TABLE_BORDER_THICKNESS, color: TABLE_BORDER_COLOR });
    page.drawLine({ start: { x: x + w, y: cellTop }, end: { x: x + w, y: cellBottom }, thickness: TABLE_BORDER_THICKNESS, color: TABLE_BORDER_COLOR });
    x += w;
  });

  // 3) Texte des cellules
  let cellLeft = boxLeft + row.left;
  row.cells.forEach((cell, i) => {
    const innerLeft = cellLeft + TABLE_CELL_PADDING;
    let cursorTop = topY - TABLE_CELL_PADDING;
    for (const line of cell.lines) {
      cursorTop -= line.spaceBefore;
      const baseline = cursorTop - line.ascent;
      drawLine(page, line, innerLeft, baseline);
      cursorTop -= line.height;
    }
    cellLeft += row.columnWidths[i];
  });
}

function isTableRow(item: RenderItem): item is TableRowRender {
  return (item as TableRowRender).kind === 'table-row';
}

/** Mode zone : dessine dans une boîte à largeur fixe. Le débordement vertical n'est PAS coupé. */
export function drawRichTextInBox(page: PDFPage, blocks: Block[], opts: DrawBoxOptions): number {
  const items = layoutBlocks(blocks, {
    fonts: opts.fonts,
    defaultFamily: opts.defaultFamily,
    defaultFontSize: opts.defaultFontSize,
    width: opts.width,
  });
  let cursorTop = opts.y;
  for (const item of items) {
    cursorTop -= item.spaceBefore;
    if (isTableRow(item)) {
      drawTableRow(page, item, opts.x, cursorTop);
      cursorTop -= item.height;
    } else {
      const baseline = cursorTop - item.ascent;
      drawLine(page, item, opts.x, baseline);
      cursorTop -= item.height;
    }
  }
  return cursorTop;
}

export interface DrawFlowOptions {
  fonts: PdfFontRegistry;
  defaultFamily: LogicalFamily;
  defaultFontSize: number;
  pageSize?: [number, number];
  margin?: { top: number; right: number; bottom: number; left: number };
}

/** Mode flux : crée autant de pages A4 que nécessaire (pagination). Renvoie les pages utilisées. */
export function drawRichTextFlow(
  pdfDoc: PDFDocument,
  blocks: Block[],
  opts: DrawFlowOptions,
): PDFPage[] {
  const pageSize = opts.pageSize ?? A4;
  const margin = opts.margin ?? MARGIN_PT;
  const [pageW, pageH] = pageSize;
  const contentWidth = pageW - margin.left - margin.right;

  const items = layoutBlocks(blocks, {
    fonts: opts.fonts,
    defaultFamily: opts.defaultFamily,
    defaultFontSize: opts.defaultFontSize,
    width: contentWidth,
  });

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage(pageSize);
  pages.push(page);
  let cursorTop = pageH - margin.top;

  for (const item of items) {
    cursorTop -= item.spaceBefore;
    if (cursorTop - item.height < margin.bottom && cursorTop < pageH - margin.top) {
      page = pdfDoc.addPage(pageSize);
      pages.push(page);
      cursorTop = pageH - margin.top;
    }
    if (isTableRow(item)) {
      drawTableRow(page, item, margin.left, cursorTop);
    } else {
      const baseline = cursorTop - item.ascent;
      drawLine(page, item, margin.left, baseline);
    }
    cursorTop -= item.height;
  }

  return pages;
}
