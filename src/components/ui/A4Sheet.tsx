import React, { useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * A simplified A4Sheet (mirroring the visual style of Vodical's transcription
 * view) — a white sheet of paper with Word-style margins, scaled down to fit
 * the current container width while preserving A4 proportions and on-screen
 * text sizing.
 *
 * No multi-page pagination logic — the sheet stretches vertically to fit the
 * actual content.
 *
 * Reference: vodical/src/components/ui/A4Sheet.tsx (original, 92 lines).
 */

// Canonical A4 size in CSS pixels at 96dpi: 210mm × 297mm.
const A4_WIDTH_PX = 794;
const A4_MIN_HEIGHT_PX = 1123;

// Approx. Word default margins (2.54 cm = 96 px).
const MARGIN_PX = { top: 96, right: 96, bottom: 96, left: 96 };

interface A4SheetProps {
  children: React.ReactNode;
  className?: string;
  /** Apply the standard 2.54 cm inner padding. Default true. */
  withMargins?: boolean;
  /**
   * Maximum scale applied when the wrapper is wider than 794 px.
   * Default is `1` (the sheet keeps its real A4 CSS size). Pass e.g. `1.5`
   * to let the sheet grow up to 1.5× on large monitors so the text is more
   * legible — proportions are preserved (uniform CSS transform: scale(...)).
   */
  maxScale?: number;
}

export function A4Sheet({ children, className, withMargins = true, maxScale = 1 }: A4SheetProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const sheet = sheetRef.current;
    if (!wrapper || !sheet) return;

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!wrapper.isConnected || !sheet.isConnected) return;
        const scale = Math.min(maxScale, wrapper.clientWidth / A4_WIDTH_PX);
        sheet.style.setProperty('--a4-scale', String(scale));

        // Wrapper height = scaled content height
        wrapper.style.height = `${sheet.scrollHeight * scale}px`;

        // Center horizontally (compensate for scale origin top-left).
        const offset = Math.max(0, (wrapper.clientWidth - A4_WIDTH_PX * scale) / 2);
        sheet.style.marginLeft = `${offset}px`;
      });
    };

    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    ro.observe(sheet);
    const mo = new MutationObserver(update);
    mo.observe(sheet, { childList: true, subtree: true });
    update();
    return () => {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [maxScale]);

  return (
    <div ref={wrapperRef} className={cn('w-full overflow-hidden', className)}>
      <div
        ref={sheetRef}
        className="bg-white shadow-sm border border-slate-200 origin-top-left"
        style={{
          width: A4_WIDTH_PX,
          minHeight: A4_MIN_HEIGHT_PX,
          transform: 'scale(var(--a4-scale, 1))',
          paddingTop: withMargins ? MARGIN_PX.top : 0,
          paddingBottom: withMargins ? MARGIN_PX.bottom : 0,
          paddingLeft: withMargins ? MARGIN_PX.left : 0,
          paddingRight: withMargins ? MARGIN_PX.right : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}