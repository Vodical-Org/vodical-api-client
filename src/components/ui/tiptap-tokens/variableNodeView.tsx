import React, { useRef, useEffect, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { User, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VariableFormat, VariableLength, VariableType, NameFormat, DateFormat } from './variableNode';
import { emitVariableSelection, getSelectedVariable, subscribeToVariableSelection } from './variableSelectionContext';

export default function VariableNodeView(props: any) {
  const { node, updateAttributes, deleteNode, selected } = props;
  const { id, name, format, length, instructions, variableType, nameFormat, dateFormat } = node.attrs as {
    id: string;
    name: string;
    format: VariableFormat;
    length: VariableLength;
    instructions: string;
    variableType: VariableType;
    nameFormat: NameFormat;
    dateFormat: DateFormat;
  };

  const chipRef = useRef<HTMLSpanElement>(null);
  const [isSelected, setIsSelected] = useState(() => getSelectedVariable()?.id === id);

  // Sync the chip's "selected" state with the global selection bus.
  useEffect(() => {
    const unsubscribe = subscribeToVariableSelection((variable) => {
      setIsSelected(variable?.id === id);
    });
    return unsubscribe;
  }, [id]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSelected) {
      // Toggle off — clicking the active chip deselects it.
      emitVariableSelection(null);
    } else {
      emitVariableSelection({
        id,
        name,
        format,
        length,
        instructions: instructions || '',
        variableType: variableType || 'text',
        nameFormat: nameFormat || 'auto',
        dateFormat: dateFormat || 'auto',
        updateAttributes,
        deleteNode,
      });
    }
  };

  // When attributes change while the chip is selected, refresh the panel's view.
  useEffect(() => {
    if (isSelected) {
      emitVariableSelection({
        id,
        name,
        format,
        length,
        instructions: instructions || '',
        variableType: variableType || 'text',
        nameFormat: nameFormat || 'auto',
        dateFormat: dateFormat || 'auto',
        updateAttributes,
        deleteNode,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, length, name, instructions, variableType, nameFormat, dateFormat]);

  // Small icon prefix for person-name / date variables (purely cosmetic).
  const TypeIcon = variableType === 'person-name' ? User : variableType === 'date' ? Calendar : null;

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        ref={chipRef}
        contentEditable={false}
        onClick={handleClick}
        className={cn(
          // Inline layout — no vertical padding so the chip sits on the text baseline.
          'inline-flex items-baseline gap-0.5 rounded px-1 py-0',
          'font-medium text-[1em] leading-[inherit]',
          'cursor-pointer select-none align-baseline',
          'transition-all duration-200',
          // Default state
          !isSelected && [
            'bg-violet-100',
            'text-violet-700',
            'hover:bg-violet-200',
          ],
          // Selected state — ring + glow.
          isSelected && [
            'bg-violet-200',
            'text-violet-800',
            'ring-2 ring-violet-500',
            'shadow-[0_0_12px_rgba(139,92,246,0.5)]',
          ],
          // TipTap's native node selection (light ring when not actively selected by us).
          selected && !isSelected && 'ring-1 ring-violet-300',
        )}
        data-variable-chip
        data-variable-selected={isSelected}
        data-variable-type={variableType || 'text'}
        title={isSelected ? 'Click to deselect' : 'Click to configure'}
      >
        {TypeIcon && <TypeIcon className="w-[0.85em] h-[0.85em] shrink-0 opacity-70 self-center" />}
        <span>[{name}]</span>
      </span>
    </NodeViewWrapper>
  );
}