/**
 * Géométrie A4 — source unique de vérité partagée par le viewer/les éditeurs à
 * l'écran ET par l'export PDF, pour un rendu WYSIWYG « façon Word ».
 *
 * L'écran rend en 96 dpi (px), le PDF en 72 dpi (pt) : 1px = 0.75pt.
 * Toutes les valeurs px sont dérivées des pt (÷ DPI_FACTOR) pour que la feuille
 * écran mise à l'échelle 0.75 corresponde exactement à la page PDF.
 */

export const DPI_FACTOR = 0.75; // pt par px (72 / 96)
const PT_PER_CM = 72 / 2.54; // ≈ 28.3465

export interface Box {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const PAGE_PT = { width: 595.28, height: 841.89 } as const; // A4 en points
export const PAGE_PT_TUPLE: [number, number] = [PAGE_PT.width, PAGE_PT.height];

export const PAGE_PX = {
  width: Math.round(PAGE_PT.width / DPI_FACTOR), // 794
  height: Math.round(PAGE_PT.height / DPI_FACTOR), // 1123
} as const;

// Marges calibrées (référence : Arial 10pt) pour viser ~81 caractères par ligne
// et ~52 lignes par page. Empiriquement Arial 10 ≈ 5,6 pt/caractère → colonne de
// ~453 pt (= A4 595,28 − 2×2,5 cm). 52 lignes ↔ interligne 1,34 (voir plus bas).
export const MARGIN_CM: Box = { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 };

export const MARGIN_PT: Box = {
  top: MARGIN_CM.top * PT_PER_CM,
  right: MARGIN_CM.right * PT_PER_CM,
  bottom: MARGIN_CM.bottom * PT_PER_CM,
  left: MARGIN_CM.left * PT_PER_CM,
};

export const MARGIN_PX: Box = {
  top: MARGIN_PT.top / DPI_FACTOR,
  right: MARGIN_PT.right / DPI_FACTOR,
  bottom: MARGIN_PT.bottom / DPI_FACTOR,
  left: MARGIN_PT.left / DPI_FACTOR,
};

export const BODY_FONT_SIZE_PT = 11;
// Interligne calibré pour ~52 lignes par page en taille 10 :
// hauteur utile ≈ 700 pt / (10 × 1.34) ≈ 52,2 → 52 lignes pleines.
export const DEFAULT_LINE_HEIGHT = 1.34;

export const CONTENT_WIDTH_PX = PAGE_PX.width - MARGIN_PX.left - MARGIN_PX.right;
export const CONTENT_HEIGHT_PX = PAGE_PX.height - MARGIN_PX.top - MARGIN_PX.bottom;
export const CONTENT_WIDTH_PT = PAGE_PT.width - MARGIN_PT.left - MARGIN_PT.right;
export const CONTENT_HEIGHT_PT = PAGE_PT.height - MARGIN_PT.top - MARGIN_PT.bottom;
