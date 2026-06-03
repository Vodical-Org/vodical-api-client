import React, { useState, useRef, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Highlighter,
  Undo2,
  Redo2,
  Calendar,
  Link as LinkIcon,
  IndentIncrease,
  IndentDecrease,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolbarVariant } from './unified-editor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { TableMenu } from './table-menu';

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36];

const FONT_FAMILIES: Array<{ label: string; value: string }> = [
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Calibri', value: 'Calibri, Carlito, sans-serif' },
];

const LINE_HEIGHTS: Array<{ label: string; value: string | null }> = [
  { label: '1', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2', value: '2' },
];

const TEXT_COLORS = [
  '#000000', '#374151', '#6b7280', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#2563eb', '#4f46e5', '#7c3aed',
];

const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fecaca',
  '#fed7aa', '#d1fae5', '#dbeafe', '#fce7f3', '#f3e8ff',
];

const MIXED = '__mixed__' as const;

function getSelectionMarkAttr(
  editor: Editor,
  markType: string,
  attrName: string,
): string | null | typeof MIXED {
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    const marks = editor.state.storedMarks ?? editor.state.selection.$from.marks();
    const mark = marks.find((m: any) => m.type.name === markType);
    return (mark?.attrs?.[attrName] as string) ?? null;
  }
  const values = new Set<string | null>();
  editor.state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (!node.isInline) return;
    const nodeFrom = pos;
    const nodeTo = pos + node.nodeSize;
    if (nodeTo <= from || nodeFrom >= to) return;
    const mark = node.marks.find((m: any) => m.type.name === markType);
    values.add((mark?.attrs?.[attrName] as string) ?? null);
  });
  if (values.size === 0) return null;
  if (values.size === 1) return [...values][0];
  return MIXED;
}

function getComputedFontSizeAtSelection(editor: Editor): string | null {
  try {
    const { view, state } = editor;
    const pos = state.selection.from;
    const domAtPos = view.domAtPos(pos);
    let dom: Node | null = domAtPos.node;
    while (dom && dom.nodeType !== Node.ELEMENT_NODE) dom = dom.parentElement;
    if (!dom) return null;
    return window.getComputedStyle(dom as Element).fontSize || null;
  } catch {
    return null;
  }
}

function getComputedFontFamilyAtSelection(editor: Editor): string | null {
  try {
    const { view, state } = editor;
    const pos = state.selection.from;
    const domAtPos = view.domAtPos(pos);
    let dom: Node | null = domAtPos.node;
    while (dom && dom.nodeType !== Node.ELEMENT_NODE) dom = dom.parentElement;
    if (!dom) return null;
    const computed = window.getComputedStyle(dom as Element).fontFamily;
    if (!computed) return null;
    return matchFontFamily(computed);
  } catch {
    return null;
  }
}

function matchFontFamily(raw: string): string | null {
  const normalise = (s: string) => s.toLowerCase().replace(/['"]/g, '').trim();
  const computedParts = raw.split(',').map(normalise);
  for (const entry of FONT_FAMILIES) {
    const entryParts = entry.value.split(',').map(normalise);
    for (const cp of computedParts) {
      if (!cp) continue;
      for (const ep of entryParts) {
        if (!ep) continue;
        if (cp === ep || cp.includes(ep) || ep.includes(cp)) return entry.value;
      }
    }
  }
  return null;
}

function TBtn({
  active, onClick, title, children, className: cls,
}: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={title}
      className={cn('h-7 w-7 p-0', active && 'bg-primary/15 text-primary', cls)}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function Separator() {
  return <div className="h-4 w-px bg-border mx-1" />;
}

function sanitizeFontSizePx(raw: string) {
  const n = Number.parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (Number.isNaN(n)) return null;
  return Math.min(96, Math.max(8, n));
}

function FontSizeControl({ editor }: { editor: Editor }) {
  const { t } = useTranslation('common');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const handler = () => forceUpdate((n) => n + 1);
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  const sizeAttr = getSelectionMarkAttr(editor, 'textStyle', 'fontSize');
  const isMixed = sizeAttr === MIXED;

  let currentLabel: string;
  if (isMixed) currentLabel = '';
  else if (sizeAttr) currentLabel = String(Math.round(parseFloat(String(sizeAttr))));
  else {
    const computed = getComputedFontSizeAtSelection(editor);
    currentLabel = computed ? String(Math.round(parseFloat(computed))) : '11';
  }

  useEffect(() => {
    if (editing) {
      setValue(currentLabel);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [editing, currentLabel]);

  const commit = () => {
    const n = sanitizeFontSizePx(value);
    if (n == null) {
      setEditing(false);
      return;
    }
    editor.chain().focus().setFontSize(`${n}pt`).run();
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-7 w-[52px] rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        inputMode="numeric"
      />
    );
  }

  return (
    <Select
      value={isMixed ? undefined : currentLabel}
      onValueChange={(v) => {
        const n = sanitizeFontSizePx(v);
        if (n == null) return;
        editor.chain().focus().setFontSize(`${n}pt`).run();
      }}
    >
      <SelectTrigger
        className="h-7 w-[64px] px-2 text-xs"
        title={t('toolbar.font_size')}
        onDoubleClick={() => setEditing(true)}
      >
        <SelectValue placeholder={isMixed ? '' : currentLabel} />
      </SelectTrigger>
      <SelectContent>
        {FONT_SIZES.map((n) => (
          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ColorPicker({
  colors, onSelect, trigger, isOpen, onOpenChange,
}: {
  colors: string[];
  onSelect: (c: string) => void;
  trigger: React.ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const btnRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const dropdownWidth = 216;
      const left = Math.min(rect.left, window.innerWidth - dropdownWidth - 8);
      setPos({ top: rect.bottom + 4, left });
    }
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onOpenChange]);

  return (
    <div ref={btnRef}>
      <div onClick={() => onOpenChange(!isOpen)}>{trigger}</div>
      {isOpen && pos && (
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="p-2 bg-popover shadow-lg rounded-md border z-[9999] grid grid-cols-5 gap-3 min-w-[200px]"
        >
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className="w-7 h-7 rounded-full border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              onClick={() => { onSelect(c); onOpenChange(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LineHeightPicker({
  editor, value, onValueChange,
}: {
  editor: Editor;
  value: string;
  onValueChange: (v: string) => void;
}) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    const handler = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popoverRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const apply = (v: string) => {
    onValueChange(v);
    editor.chain().focus().setLineHeight(v).run();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title={t('toolbar.line_height')}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center h-7 rounded-md px-1.5 gap-1 hover:bg-accent transition-colors',
          open && 'bg-primary/15',
        )}
      >
        <span className="text-xs">↕</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {open && pos && (
        <div
          ref={popoverRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="p-1 bg-popover shadow-lg rounded-md border z-[9999] w-[140px]"
        >
          {LINE_HEIGHTS.map((lh) => {
            const v = lh.value ?? '1.5';
            const isActive = value === v;
            return (
              <button
                key={lh.label}
                type="button"
                className={cn(
                  'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted',
                  isActive && 'bg-muted',
                )}
                onClick={() => apply(v)}
              >
                {lh.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

interface ToolbarProps {
  editor: Editor;
  variant: ToolbarVariant;
}

export function UnifiedToolbar({ editor, variant }: ToolbarProps) {
  const { t } = useTranslation('common');
  const [textColorOpen, setTextColorOpen] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [lineHeight, setLineHeight] = useState('1.5');

  const [fontFamily, setFontFamily] = useState('Arial');
  const [fontFamilyMixed, setFontFamilyMixed] = useState(false);

  useEffect(() => {
    const handler = () => {
      const val = getSelectionMarkAttr(editor, 'textStyle', 'fontFamily');
      if (val === MIXED) {
        setFontFamilyMixed(true);
      } else {
        setFontFamilyMixed(false);
        if (val) {
          setFontFamily(String(val));
        } else {
          const computed = getComputedFontFamilyAtSelection(editor);
          setFontFamily(computed ?? 'Arial');
        }
      }
    };
    editor.on('selectionUpdate', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  // Row 1: Text style
  const row1 = (
    <div className="flex items-center gap-0.5 flex-wrap">
      <Select
        value={fontFamilyMixed ? undefined : fontFamily}
        onValueChange={(v) => {
          setFontFamily(v);
          setFontFamilyMixed(false);
          editor.chain().focus().setFontFamily(v).run();
        }}
      >
        <SelectTrigger className="h-7 w-[140px] px-2 text-xs" title={t('toolbar.font')}>
          <SelectValue placeholder={fontFamilyMixed ? '' : t('toolbar.font')} />
        </SelectTrigger>
        <SelectContent>
          {FONT_FAMILIES.map((f) => (
            <SelectItem key={f.label} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FontSizeControl editor={editor} />

      <Separator />

      <TBtn active={editor.isActive('bold')} title={t('toolbar.bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('italic')} title={t('toolbar.italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('underline')} title={t('toolbar.underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('strike')} title={t('toolbar.strikethrough')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-3.5 w-3.5" />
      </TBtn>

      <Separator />

      <ColorPicker
        colors={TEXT_COLORS}
        onSelect={(c) => editor.chain().focus().setColor(c).run()}
        isOpen={textColorOpen}
        onOpenChange={(o) => { setTextColorOpen(o); if (o) setHighlightOpen(false); }}
        trigger={
          <TBtn title={t('toolbar.text_color')} active={textColorOpen} onClick={() => {}}>
            <Palette className="h-3.5 w-3.5" />
          </TBtn>
        }
      />

      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        onSelect={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
        isOpen={highlightOpen}
        onOpenChange={(o) => { setHighlightOpen(o); if (o) setTextColorOpen(false); }}
        trigger={
          <TBtn title={t('toolbar.highlight')} active={highlightOpen || editor.isActive('highlight')} onClick={() => {}}>
            <Highlighter className="h-3.5 w-3.5" />
          </TBtn>
        }
      />

      <Separator />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs"
        title={t('toolbar.clear_formatting')}
        onClick={() =>
          editor
            .chain()
            .focus()
            .unsetAllMarks()
            .clearNodes()
            .setFontFamily('Arial')
            .setFontSize('11pt')
            .run()
        }
      >
        A⌫
      </Button>
    </div>
  );

  // Row 2: Paragraph + insert
  const row2 = (
    <div className="flex items-center gap-0.5 flex-wrap">
      <TBtn
        title={t('toolbar.undo')}
        onClick={() => editor.chain().focus().undo().run()}
        className={!editor.can().undo() ? 'opacity-40 pointer-events-none' : undefined}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        title={t('toolbar.redo')}
        onClick={() => editor.chain().focus().redo().run()}
        className={!editor.can().redo() ? 'opacity-40 pointer-events-none' : undefined}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </TBtn>

      <Separator />

      <TBtn active={editor.isActive('bulletList')} title={t('toolbar.bullet_list')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('orderedList')} title={t('toolbar.ordered_list')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-3.5 w-3.5" />
      </TBtn>

      <Separator />

      <TBtn title={t('toolbar.outdent')} onClick={() => editor.chain().focus().outdent().run()}>
        <IndentDecrease className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn title={t('toolbar.indent')} onClick={() => editor.chain().focus().indent().run()}>
        <IndentIncrease className="h-3.5 w-3.5" />
      </TBtn>

      <Separator />

      <TBtn active={editor.isActive({ textAlign: 'left' })} title={t('toolbar.align_left')} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive({ textAlign: 'center' })} title={t('toolbar.align_center')} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive({ textAlign: 'right' })} title={t('toolbar.align_right')} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="h-3.5 w-3.5" />
      </TBtn>

      <Separator />

      <TBtn
        active={editor.isActive('link')}
        title={t('toolbar.link')}
        onClick={() => {
          const prev = editor.getAttributes('link')?.href as string | undefined;
          const url = window.prompt('URL', prev ?? '');
          if (url === null) return;
          const trimmed = url.trim();
          if (!trimmed) {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
        }}
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </TBtn>

      <TBtn
        title={t('toolbar.date')}
        onClick={() => (editor as any).chain().focus().insertVodicalDate?.({ format: 'fr_short' }).run()}
      >
        <Calendar className="h-3.5 w-3.5" />
      </TBtn>

      <Separator />

      <LineHeightPicker editor={editor} value={lineHeight} onValueChange={setLineHeight} />

      <Separator />

      <TableMenu editor={editor} />
    </div>
  );

  if (variant === 'full') {
    return (
      <div className="sticky top-0 z-10">
        <div className="py-1.5 px-2 border-b border-border bg-muted/30 space-y-1">
          {row1}
          {row2}
        </div>
      </div>
    );
  }

  // Compact variant for medium/minimal
  return (
    <div className="flex items-center px-2 py-1.5 border-b border-border bg-muted/30 sticky top-0 z-10 flex-wrap gap-0.5">
      <TBtn
        title={t('toolbar.undo')}
        onClick={() => editor.chain().focus().undo().run()}
        className={!editor.can().undo() ? 'opacity-40 pointer-events-none' : undefined}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn
        title={t('toolbar.redo')}
        onClick={() => editor.chain().focus().redo().run()}
        className={!editor.can().redo() ? 'opacity-40 pointer-events-none' : undefined}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </TBtn>
      <Separator />
      <TBtn active={editor.isActive('bold')} title={t('toolbar.bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('italic')} title={t('toolbar.italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </TBtn>
      <TBtn active={editor.isActive('underline')} title={t('toolbar.underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-3.5 w-3.5" />
      </TBtn>
    </div>
  );
}
