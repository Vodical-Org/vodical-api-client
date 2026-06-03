import React, { useMemo, useRef, useState, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Calendar, ChevronDown, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { DATE_TOKEN_FORMATS, type DateTokenFormat } from './dateToken';

function getExampleFor(format: DateTokenFormat, d: Date) {
  const found = DATE_TOKEN_FORMATS.find((f) => f.value === format);
  return found?.example(d) ?? DATE_TOKEN_FORMATS[0].example(d);
}

export default function DateTokenView(props: any) {
  const format = (props?.node?.attrs?.format ?? 'fr_short') as DateTokenFormat;
  const updateAttributes = props?.updateAttributes as (attrs: any) => void;
  const deleteNode = props?.deleteNode as () => void;

  const [open, setOpen] = useState(false);
  const chipRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isEditable = props?.editor?.isEditable ?? true;

  const now = useMemo(() => new Date(), []);
  const preview = useMemo(() => getExampleFor(format, now), [format, now]);

  if (!isEditable) {
    return (
      <NodeViewWrapper as="span" className="inline">
        <span
          contentEditable={false}
          className="tabular-nums"
          data-vodical-token="date"
          data-format={format}
        >
          {preview}
        </span>
      </NodeViewWrapper>
    );
  }

  const today = now;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (chipRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const getPopoverStyle = (): React.CSSProperties => {
    const el = chipRef.current;
    if (!el) return { position: 'fixed', top: 0, left: 0 };
    const r = el.getBoundingClientRect();
    const width = 260;
    let left = r.left;
    const top = r.bottom + 6;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
    if (left < 8) left = 8;
    return { position: 'fixed', top, left, width };
  };

  return (
    <NodeViewWrapper as="span" className="inline-flex align-baseline">
      <span
        ref={chipRef}
        contentEditable={false}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30',
          'px-1.5 py-0.5 text-[11px] leading-none text-foreground/80',
          'hover:bg-muted/50 select-none',
        )}
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1"
          title="Variable : date"
        >
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground/80">Date</span>
          <span className="text-muted-foreground/70">·</span>
          <span className="text-muted-foreground/80 tabular-nums">{preview}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/60" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            deleteNode?.();
          }}
          className="ml-0.5 inline-flex items-center justify-center rounded-sm hover:bg-background/60"
          title="Supprimer"
        >
          <X className="w-3 h-3 text-muted-foreground/70" />
        </button>
      </span>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[9999] rounded-lg border border-border bg-popover shadow-lg p-2 pointer-events-auto"
            style={getPopoverStyle()}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <div className="text-[11px] font-medium text-foreground mb-2">Format de date</div>
            <div className="grid gap-1">
              {DATE_TOKEN_FORMATS.map((f) => {
                const ex = f.example(today);
                const active = f.value === format;
                return (
                  <button
                    key={f.value}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs',
                      'hover:bg-accent/50 transition-colors',
                      active ? 'bg-accent/40' : '',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateAttributes?.({ format: f.value });
                      setOpen(false);
                    }}
                  >
                    <span className="text-foreground/80">{f.labelFr}</span>
                    <span className="text-muted-foreground tabular-nums">{ex}</span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  );
}