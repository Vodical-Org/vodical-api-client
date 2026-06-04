import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVariableSelection } from './variableSelectionContext';

interface VariableAddPanelProps {
  /** Called when the user picks a variable name to insert at the saved cursor. */
  onInsertVariable: (name: string) => void;
}

/**
 * Side-panel for adding a new variable. Shown when the user clicks the floating
 * "+" widget inside the editor (managed via `variableSelectionContext`).
 */
export function VariableAddPanel({ onInsertVariable }: VariableAddPanelProps) {
  const { addVariableState, closeAddVariablePanel } = useVariableSelection();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addVariableState?.isOpen && inputRef.current) {
      // Slight delay so the panel is mounted before we steal focus.
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [addVariableState?.isOpen]);

  const handleInsert = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      onInsertVariable(trimmed);
      setInputValue('');
      closeAddVariablePanel();
    },
    [onInsertVariable, closeAddVariablePanel],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInsert(inputValue);
    }
    if (e.key === 'Escape') {
      closeAddVariablePanel();
    }
  };

  const handleClose = () => {
    setInputValue('');
    closeAddVariablePanel();
  };

  if (!addVariableState?.isOpen) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-slate-900">Add a variable</h3>
            <p className="text-xs text-slate-500">
              Define a placeholder the AI will fill from the source.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors shrink-0"
            title="Close"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Variable name</label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. Patient name, Diagnosis, Date of birth…"
            className={cn(
              'w-full px-3 py-2.5 text-sm rounded-lg',
              'border border-slate-300 bg-white',
              'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent',
              'placeholder:text-slate-400',
            )}
          />
          <p className="text-[11px] text-slate-500 mt-1.5">
            Press <kbd className="px-1 bg-slate-100 rounded">Enter</kbd> to insert,{' '}
            <kbd className="px-1 bg-slate-100 rounded">Esc</kbd> to cancel.
          </p>
        </div>

        {inputValue.trim() && (
          <button
            type="button"
            onClick={() => handleInsert(inputValue)}
            className={cn(
              'w-full py-2.5 px-4 rounded-lg text-sm font-medium',
              'bg-violet-500 hover:bg-violet-600 text-white',
              'transition-colors',
            )}
          >
            Add [{inputValue.trim()}]
          </button>
        )}
      </div>
    </div>
  );
}

export default VariableAddPanel;