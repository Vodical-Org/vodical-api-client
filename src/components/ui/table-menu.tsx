import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import {
  Table as TableIcon,
  ChevronDown,
  BetweenHorizontalStart,
  BetweenHorizontalEnd,
  BetweenVerticalStart,
  BetweenVerticalEnd,
  TableCellsMerge,
  TableCellsSplit,
  Heading,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const MAX = 10;
const MIN_ROWS = 6;
const MIN_COLS = 8;

export function TableMenu({ editor }: { editor: Editor }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<{ rows: number; cols: number }>({ rows: 0, cols: 0 });
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

  const inTable = editor.isActive('table');

  const run = (fn: () => void, close = false) => {
    fn();
    if (close) setOpen(false);
  };

  const displayRows = Math.min(MAX, Math.max(MIN_ROWS, hover.rows + 1));
  const displayCols = Math.min(MAX, Math.max(MIN_COLS, hover.cols + 1));

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setHover({ rows: 0, cols: 0 });
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t('toolbar.table')}
          className={cn(
            'inline-flex items-center gap-0.5 h-7 px-1.5 rounded-md hover:bg-accent transition-colors',
            (open || inTable) && 'bg-primary/15 text-primary',
          )}
        >
          <TableIcon className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-auto p-2">
        {!inTable ? (
          <div className="select-none">
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${displayCols}, 16px)` }}
              onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
            >
              {Array.from({ length: displayRows }).map((_, r) =>
                Array.from({ length: displayCols }).map((_, c) => {
                  const rows = r + 1;
                  const cols = c + 1;
                  const active = rows <= hover.rows && cols <= hover.cols;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      className={cn(
                        'h-4 w-4 rounded-[2px] border',
                        active
                          ? 'border-primary bg-primary/30'
                          : 'border-border bg-muted/40 hover:border-primary/50',
                      )}
                      onMouseEnter={() => setHover({ rows, cols })}
                      onClick={() =>
                        run(() => {
                          editor
                            .chain()
                            .focus()
                            .insertTable({ rows, cols, withHeaderRow: true })
                            .run();
                        }, true)
                      }
                    />
                  );
                }),
              )}
            </div>
            <div className="mt-1.5 text-center text-xs text-muted-foreground">
              {hover.rows > 0 ? `${hover.cols} × ${hover.rows}` : t('toolbar.table_insert')}
            </div>
          </div>
        ) : (
          <div className="flex flex-col min-w-[200px]">
            <OpItem
              icon={<BetweenHorizontalStart className="h-4 w-4" />}
              label={t('toolbar.table_row_above')}
              onClick={() => run(() => editor.chain().focus().addRowBefore().run())}
            />
            <OpItem
              icon={<BetweenHorizontalEnd className="h-4 w-4" />}
              label={t('toolbar.table_row_below')}
              onClick={() => run(() => editor.chain().focus().addRowAfter().run())}
            />
            <OpItem
              icon={<BetweenVerticalStart className="h-4 w-4" />}
              label={t('toolbar.table_col_before')}
              onClick={() => run(() => editor.chain().focus().addColumnBefore().run())}
            />
            <OpItem
              icon={<BetweenVerticalEnd className="h-4 w-4" />}
              label={t('toolbar.table_col_after')}
              onClick={() => run(() => editor.chain().focus().addColumnAfter().run())}
            />
            <Divider />
            <OpItem
              icon={<Trash2 className="h-4 w-4" />}
              label={t('toolbar.table_delete_row')}
              onClick={() => run(() => editor.chain().focus().deleteRow().run())}
            />
            <OpItem
              icon={<Trash2 className="h-4 w-4" />}
              label={t('toolbar.table_delete_col')}
              onClick={() => run(() => editor.chain().focus().deleteColumn().run())}
            />
            <Divider />
            <OpItem
              icon={<TableCellsMerge className="h-4 w-4" />}
              label={t('toolbar.table_merge')}
              onClick={() => run(() => editor.chain().focus().mergeCells().run())}
            />
            <OpItem
              icon={<TableCellsSplit className="h-4 w-4" />}
              label={t('toolbar.table_split')}
              onClick={() => run(() => editor.chain().focus().splitCell().run())}
            />
            <OpItem
              icon={<Heading className="h-4 w-4" />}
              label={t('toolbar.table_header_row')}
              onClick={() => run(() => editor.chain().focus().toggleHeaderRow().run())}
            />
            <Divider />
            <OpItem
              icon={<X className="h-4 w-4" />}
              label={t('toolbar.table_delete')}
              destructive
              onClick={() => run(() => editor.chain().focus().deleteTable().run(), true)}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function OpItem({
  icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm text-left transition-colors hover:bg-accent',
        destructive && 'text-destructive hover:bg-destructive/10',
      )}
    >
      <span className={cn('shrink-0', destructive ? 'text-destructive' : 'text-muted-foreground')}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-muted -mx-2" />;
}

export default TableMenu;