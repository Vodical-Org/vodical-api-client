/// <reference lib="webworker" />
// Runs in a Web Worker — no DOM access allowed here.
import { PDFDocument, rgb } from 'pdf-lib';
import { loadPdfFonts, type LogicalFamily } from './fonts';
import { drawRichTextFlow, drawRichTextInBox } from './layout';
import type { Block } from './parseHtml';
import { PAGE_PT_TUPLE } from '../pageGeometry';

export interface FlowRequest {
  type: 'flow';
  blocks: Block[];
  neededFamilies: LogicalFamily[];
  defaultFamily: LogicalFamily;
  defaultFontSize: number;
  pageSize: [number, number];
  margin: { top: number; right: number; bottom: number; left: number };
  footer: string;
}

export interface BoxZone {
  blocks: Block[];
  x: number;
  y: number;
  width: number;
  defaultFontSize: number;
  defaultFamily: LogicalFamily;
  pageIndex: number;
}

export interface NativeRequest {
  type: 'native';
  templateUrl: string | null; // null = blank A4
  isImageTemplate: boolean;
  fileExtension: string;
  zones: BoxZone[];
  neededFamilies: LogicalFamily[];
}

export type WorkerRequest = FlowRequest | NativeRequest;

export interface WorkerResponse {
  success: boolean;
  bytes?: Uint8Array;
  error?: string;
}

async function handleFlow(msg: FlowRequest): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts = await loadPdfFonts(pdfDoc, msg.neededFamilies);

  const pages = drawRichTextFlow(pdfDoc, msg.blocks, {
    fonts,
    defaultFamily: msg.defaultFamily,
    defaultFontSize: msg.defaultFontSize,
    pageSize: msg.pageSize,
    margin: msg.margin,
  });

  const footerFont = fonts.arial.regular;
  for (const page of pages) {
    page.drawText(msg.footer, {
      x: msg.margin.left,
      y: 28,
      size: 9,
      font: footerFont,
      color: rgb(0.39, 0.39, 0.39),
    });
  }

  return pdfDoc.save();
}

async function handleNative(msg: NativeRequest): Promise<Uint8Array> {
  let pdfDoc: any;

  if (!msg.templateUrl) {
    pdfDoc = await PDFDocument.create();
    pdfDoc.addPage(PAGE_PT_TUPLE);
  } else if (msg.isImageTemplate) {
    const imageResponse = await fetch(msg.templateUrl);
    if (!imageResponse.ok) throw new Error(`Image load failed: ${imageResponse.status}`);
    const imageBytes = await imageResponse.arrayBuffer();
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage(PAGE_PT_TUPLE);
    const image =
      msg.fileExtension === 'png'
        ? await pdfDoc.embedPng(imageBytes)
        : await pdfDoc.embedJpg(imageBytes);
    const { width: pw, height: ph } = page.getSize();
    page.drawImage(image, { x: 0, y: 0, width: pw, height: ph });
  } else {
    const pdfResponse = await fetch(msg.templateUrl);
    if (!pdfResponse.ok) throw new Error(`PDF load failed: ${pdfResponse.status}`);
    const pdfBytes = await pdfResponse.arrayBuffer();
    pdfDoc = await PDFDocument.load(pdfBytes);
  }

  const fonts = await loadPdfFonts(pdfDoc, msg.neededFamilies);
  const pages = pdfDoc.getPages();

  for (const zone of msg.zones) {
    if (zone.pageIndex >= pages.length) continue;
    const page = pages[zone.pageIndex];
    drawRichTextInBox(page, zone.blocks, {
      x: zone.x,
      y: zone.y,
      width: zone.width,
      defaultFontSize: zone.defaultFontSize,
      defaultFamily: zone.defaultFamily,
      fonts,
    });
  }

  return pdfDoc.save();
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  try {
    const bytes =
      e.data.type === 'flow'
        ? await handleFlow(e.data)
        : await handleNative(e.data);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage(
      { success: true, bytes } satisfies WorkerResponse,
      [bytes.buffer],
    );
  } catch (err: any) {
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({
      success: false,
      error: err?.message ?? String(err),
    } satisfies WorkerResponse);
  }
};
