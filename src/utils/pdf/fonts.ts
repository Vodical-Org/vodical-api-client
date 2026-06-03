import { PDFDocument, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type LogicalFamily = 'arial' | 'times' | 'calibri';
export type FontVariantKey = 'regular' | 'bold' | 'italic' | 'bolditalic';

export interface FontVariants {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  bolditalic: PDFFont;
}

export type PdfFontRegistry = Partial<Record<LogicalFamily, FontVariants>> & {
  arial: FontVariants;
};

const ALL_FAMILIES: LogicalFamily[] = ['arial', 'times', 'calibri'];
const VARIANTS: FontVariantKey[] = ['regular', 'bold', 'italic', 'bolditalic'];

function fontUrl(family: LogicalFamily, variant: FontVariantKey): string {
  return `/fonts/${family}-${variant}.ttf`;
}

const bytesCache = new Map<string, ArrayBuffer>();

async function fetchFontBytes(url: string): Promise<ArrayBuffer> {
  const cached = bytesCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Police PDF introuvable: ${url} (${res.status})`);
  const buf = await res.arrayBuffer();
  bytesCache.set(url, buf);
  return buf;
}

/**
 * Normalise une valeur CSS `font-family` vers l'une de nos familles logiques embarquées.
 */
export function resolveFontFamily(cssValue?: string | null): LogicalFamily {
  if (!cssValue) return 'arial';
  const v = cssValue.toLowerCase();
  if (v.includes('calibri') || v.includes('carlito')) return 'calibri';
  if (
    v.includes('times') ||
    v.includes('georgia') ||
    v.includes('serif') ||
    v.includes('liberation serif')
  )
    return 'times';
  // Arial, Helvetica, sans-serif, system-ui, Liberation Sans, Arimo, Inter → arial
  return 'arial';
}

/**
 * Enregistre fontkit puis embarque les polices nécessaires (4 variantes par famille).
 * `arial` est toujours embarquée comme repli.
 */
export async function loadPdfFonts(
  pdfDoc: PDFDocument,
  neededFamilies?: Iterable<LogicalFamily>,
): Promise<PdfFontRegistry> {
  pdfDoc.registerFontkit(fontkit);

  const families = new Set<LogicalFamily>(neededFamilies ?? ALL_FAMILIES);
  families.add('arial'); // repli garanti

  const registry = {} as PdfFontRegistry;

  await Promise.all(
    Array.from(families).map(async (family) => {
      const variants = {} as FontVariants;
      await Promise.all(
        VARIANTS.map(async (variant) => {
          const bytes = await fetchFontBytes(fontUrl(family, variant));
          variants[variant] = await pdfDoc.embedFont(bytes);
        }),
      );
      registry[family] = variants;
    }),
  );

  return registry;
}

/**
 * Sélectionne la bonne variante (gras/italique) d'une famille, avec repli sur `arial`.
 */
export function pickFont(
  registry: PdfFontRegistry,
  family: LogicalFamily,
  bold: boolean,
  italic: boolean,
): PDFFont {
  const variants = registry[family] ?? registry.arial;
  if (bold && italic) return variants.bolditalic;
  if (bold) return variants.bold;
  if (italic) return variants.italic;
  return variants.regular;
}
