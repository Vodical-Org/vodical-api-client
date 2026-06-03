/**
 * Source de vérité unique pour le rendu du HTML TipTap
 * dans les exports (Copier, PDF, Email).
 *
 * Les valeurs reproduisent EXACTEMENT le rendu web
 * (`SummaryRenderer` + Tailwind `prose prose-sm`) :
 *   - police par défaut : système (équivalente à la stack `prose` de Tailwind)
 *   - taille de base   : 12px (text-sm prose-sm)
 *   - titres en gras   : h1 bold, h2..h6 semibold
 *   - listes           : padding-left 1.5rem (pl-6), marqueurs noirs
 *
 * IMPORTANT : un miroir Deno existe dans
 * `supabase/functions/_shared/tiptapStyleTokens.ts`.
 * Toute modification ici doit être répercutée là-bas.
 */

export const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const BODY_FONT_SIZE_PX = 12;
export const BODY_LINE_HEIGHT = 1.625; // leading-relaxed (web)
export const BODY_COLOR = '#1a1a1a';

/** Tailles des titres en px (h1..h6), alignées sur Tailwind `prose-sm` côté web. */
export const HEADING_SIZES_PX: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 20, // text-xl
  2: 18, // text-lg
  3: 16, // text-base
  4: 14, // text-sm
  5: 13,
  6: 12,
};

/** Graisse des titres : h1 bold (700), h2..h6 semibold (600). */
export const HEADING_WEIGHTS: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 700,
  2: 600,
  3: 600,
  4: 600,
  5: 600,
  6: 600,
};

/** Marges (margin-bottom) des titres en px, miroir des classes `mb-*` de SummaryRenderer. */
export const HEADING_MARGIN_BOTTOM_PX: Record<1 | 2 | 3 | 4 | 5 | 6, number> = {
  1: 12, // mb-3
  2: 8, // mb-2
  3: 8, // mb-2
  4: 4, // mb-1
  5: 4,
  6: 4,
};

/** Tags HTML autorisés par le sanitize TipTap (identique côté client et Deno). */
export const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li',
  'span', 'mark', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col',
] as const;

export const ALLOWED_ATTR = [
  'class', 'style', 'data-color',
  'colspan', 'rowspan', 'width', 'align', 'valign',
] as const;

/**
 * Génère la string `style="…"` à appliquer à une balise donnée.
 * Retourne `null` si la balise ne reçoit pas de style spécifique
 * (les styles existants doivent alors être préservés tels quels).
 */
export function inlineStyleFor(tagName: string): string | null {
  const tag = tagName.toLowerCase();

  if (tag === 'p') {
    return `font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; line-height: ${BODY_LINE_HEIGHT}; margin: 0 0 8px; min-height: 1.5em; color: ${BODY_COLOR}; font-weight: normal;`;
  }

  const headingMatch = /^h([1-6])$/.exec(tag);
  if (headingMatch) {
    const level = parseInt(headingMatch[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const size = HEADING_SIZES_PX[level];
    const weight = HEADING_WEIGHTS[level];
    const mb = HEADING_MARGIN_BOTTOM_PX[level];
    return `font-family: ${FONT_STACK}; font-size: ${size}px; line-height: 1.3; font-weight: ${weight}; margin: 0 0 ${mb}px; color: ${BODY_COLOR};`;
  }

  if (tag === 'ul' || tag === 'ol') {
    const listStyle = tag === 'ol' ? 'decimal' : 'disc';
    return `font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; list-style-type: ${listStyle}; margin: 0 0 8px; padding-left: 24px; color: ${BODY_COLOR};`;
  }

  if (tag === 'li') {
    return `font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; line-height: ${BODY_LINE_HEIGHT}; padding-left: 4px; margin: 0; color: ${BODY_COLOR};`;
  }

  if (tag === 'blockquote') {
    return `font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; line-height: ${BODY_LINE_HEIGHT}; margin: 0 0 8px; padding-left: 12px; border-left: 3px solid #d4d4d4; color: ${BODY_COLOR};`;
  }

  if (tag === 'strong') return 'font-weight: 600;';
  if (tag === 'em') return 'font-style: italic;';
  if (tag === 'u') return 'text-decoration: underline;';
  if (tag === 's') return 'text-decoration: line-through;';

  if (tag === 'table') {
    return `border-collapse: collapse; width: 100%; margin: 0 0 8px; font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; color: ${BODY_COLOR};`;
  }
  if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot' || tag === 'tr' || tag === 'colgroup' || tag === 'col') {
    return null;
  }
  if (tag === 'th') {
    return `border: 1px solid #d4d4d4; padding: 6px 8px; background-color: #f5f5f5; font-weight: 600; text-align: left; vertical-align: top; font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; color: ${BODY_COLOR};`;
  }
  if (tag === 'td') {
    return `border: 1px solid #d4d4d4; padding: 6px 8px; vertical-align: top; font-family: ${FONT_STACK}; font-size: ${BODY_FONT_SIZE_PX}px; color: ${BODY_COLOR};`;
  }

  // span / mark : on préserve les styles existants tels quels (couleur, taille,
  // surlignage personnalisé). On retourne null pour ne RIEN écraser.
  return null;
}
