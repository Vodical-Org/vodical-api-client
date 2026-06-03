import { toast } from "sonner";
import i18next from "i18next";
import { parseHtmlToBlocks, collectFamilies, Block, Run } from "./pdf/parseHtml";
import type { FlowRequest, WorkerResponse } from "./pdf/pdfWorker";
import { PAGE_PT_TUPLE, MARGIN_PT, BODY_FONT_SIZE_PT } from "./pageGeometry";

interface PDFGenerationOptions {
  content: string;
  fileName?: string;
}

const A4: [number, number] = PAGE_PT_TUPLE;
const MARGIN = MARGIN_PT;
const BODY_FONT_SIZE = BODY_FONT_SIZE_PT;

/**
 * Génère un nom de fichier PDF propre à partir d'un nom et d'une date
 */
export function buildPdfFileName(name: string, dateStr?: string): string {
  const sanitized = name.trim().replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ\s-]/g, '').replace(/\s+/g, '-');
  const date = dateStr ? new Date(dateStr).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  return `${sanitized} - ${date}.pdf`;
}

/** Convertit des octets PDF en base64 (utilisable comme pièce jointe email Resend/Mailgun). */
export function pdfBytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}



function mkRun(text: string, opts: Partial<Run> = {}): Run {
  return {
    text,
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    family: 'arial',
    ...opts,
  };
}

/** Construit des blocs à partir d'un texte brut (transcriptions), en gardant l'emphase des libellés d'interlocuteur. */
function buildPlainTextBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim() === '') continue;
    const speaker = line.match(/^(Interlocuteur\s+.+?):\s*(.*)$/);
    if (speaker) {
      const runs: Run[] = [mkRun(`${speaker[1]}:`, { bold: true, color: '#1e40af' })];
      if (speaker[2]) runs.push(mkRun(` ${speaker[2]}`));
      blocks.push({ type: 'paragraph', align: 'left', indentPx: 0, runs });
    } else {
      blocks.push({ type: 'paragraph', align: 'left', indentPx: 0, runs: [mkRun(line)] });
    }
  }
  return blocks;
}

/**
 * Génère les octets bruts du PDF (sans déclencher de téléchargement).
 * Utilisable pour téléchargement direct ou pour pièce jointe email.
 */
export const generatePDFBytes = async ({ content }: { content: string }): Promise<Uint8Array> => {
  const isHTML = /<(p|h[1-6]|ul|ol|li|strong|em|span|div|br|table)(\s[^>]*)?>/i.test(content);
  const rawBlocks = isHTML ? parseHtmlToBlocks(content) : buildPlainTextBlocks(content);
  let end = rawBlocks.length;
  while (
    end > 0 &&
    rawBlocks[end - 1].type !== 'table' &&
    rawBlocks[end - 1].runs.every(r => r.text.trim() === '')
  ) end--;
  const blocks = rawBlocks.slice(0, end);
  const neededFamilies = Array.from(collectFamilies(blocks));

  const footer = "Document généré par Vodical. Plus d'informations sur vodical.com";
  const msg: FlowRequest = {
    type: 'flow',
    blocks,
    neededFamilies,
    defaultFamily: 'arial',
    defaultFontSize: BODY_FONT_SIZE,
    pageSize: A4,
    margin: MARGIN,
    footer,
  };

  return await new Promise<Uint8Array>((resolve, reject) => {
    const worker = new Worker(new URL('./pdf/pdfWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      if (e.data.success && e.data.bytes) resolve(e.data.bytes);
      else reject(new Error(e.data.error ?? 'Worker failed'));
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
    worker.postMessage(msg);
  });
};

export const generatePDF = async ({
  content,
  fileName,
}: PDFGenerationOptions): Promise<void> => {
  try {
    const bytes = await generatePDFBytes({ content });


    const defaultFileName = `document-${new Date().toISOString().split('T')[0]}.pdf`;
    const finalFileName = fileName || defaultFileName;

    const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });

    // Safari ignores the `download` attribute on blob: URLs and strips the
    // file extension.  Use a data URL instead — it triggers a proper save
    // dialog that preserves the filename (including the .pdf suffix).
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      await new Promise<void>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const a = document.createElement('a');
          a.href = reader.result as string;
          a.download = finalFileName;
          a.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 100);
          resolve();
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } else {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = finalFileName;
      link.rel = 'noopener';
      link.style.cssText = 'position:fixed;top:-9999px;left:-9999px';
      document.body.appendChild(link);
      link.click();

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      };
      window.addEventListener('focus', cleanup, { once: true });
      setTimeout(cleanup, 60_000);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    toast.error(i18next.t("common:toasts.pdf_error"), {
      description: i18next.t("common:toasts.pdf_error_description"),
    });
    throw error;
  }
};
