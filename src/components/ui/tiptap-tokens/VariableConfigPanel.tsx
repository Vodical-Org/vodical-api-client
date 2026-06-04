import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVariableSelection } from './variableSelectionContext';
import type { VariableFormat, VariableLength, VariableType, NameFormat, DateFormat } from './variableNode';

const FORMATS: VariableFormat[] = ['auto', 'short', 'bullet', 'paragraph'];
const LENGTHS: VariableLength[] = ['short', 'standard', 'detailed'];
const NAME_FORMATS: Array<{ v: NameFormat; ex: string }> = [
  { v: 'auto', ex: 'as transcribed' },
  { v: 'first-last', ex: 'Jean DUPONT' },
  { v: 'last-first', ex: 'DUPONT Jean' },
  { v: 'last-comma-first', ex: 'DUPONT, Jean' },
  { v: 'first-only', ex: 'Jean' },
  { v: 'last-only', ex: 'DUPONT' },
  { v: 'full-upper', ex: 'JEAN DUPONT' },
];
const DATE_FORMATS: Array<{ v: DateFormat; ex: string }> = [
  { v: 'auto', ex: 'locale' },
  { v: 'dd/mm/yyyy', ex: '11/03/2026' },
  { v: 'mm/dd/yyyy', ex: '03/11/2026' },
  { v: 'long', ex: 'March 11, 2026' },
  { v: 'short', ex: 'Mar 11' },
  { v: 'iso', ex: '2026-03-11' },
  { v: 'time', ex: '14:30' },
];

interface Props { className?: string; }

export function VariableConfigPanel({ className }: Props) {
  const { selectedVariable, clearSelection } = useVariableSelection();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(selectedVariable?.name ?? '');
  const [instr, setInstr] = useState(selectedVariable?.instructions ?? '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedVariable) {
      setNameValue(selectedVariable.name);
      setInstr(selectedVariable.instructions || '');
      setEditingName(false);
    }
  }, [selectedVariable?.id]);

  if (!selectedVariable) return null;
  const { name, format, length, variableType, nameFormat, dateFormat, updateAttributes, deleteNode } = selectedVariable;
  const t: VariableType = variableType || 'text';

  const saveName = () => {
    if (nameValue.trim() && nameValue !== name) updateAttributes({ name: nameValue.trim() });
    else setNameValue(name);
    setEditingName(false);
  };
  const onNameKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') { setNameValue(name); setEditingName(false); }
  };
  const onInstrChange = (v: string) => { setInstr(v); updateAttributes({ instructions: v }); };
  const onDelete = () => { deleteNode(); clearSelection(); };

  const btn = (active: boolean) =>
    cn('px-2 py-1.5 text-xs font-medium rounded-md border transition-all',
      active ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-slate-300 hover:bg-slate-50 text-slate-600');

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-900">Variable</h3>
        <button type="button" onClick={onDelete} className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1.5">Variable name</label>
          {editingName ? (
            <input
              ref={nameRef}
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={onNameKey}
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg border border-violet-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          ) : (
            <button
              type="button"
              onClick={() => { setEditingName(true); setTimeout(() => nameRef.current?.focus(), 50); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-violet-100 border border-violet-200 hover:bg-violet-200 group"
            >
              <span className="text-sm font-medium text-violet-700 truncate">{nameValue}</span>
              <Pencil className="w-3.5 h-3.5 text-violet-400 opacity-50 group-hover:opacity-100" />
            </button>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1.5">Type</label>
          <div className="relative">
            <select
              value={t}
              onChange={(e) => updateAttributes({ variableType: e.target.value as VariableType })}
              className="w-full appearance-none px-3 py-1.5 pr-8 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
            >
              <option value="text">Text</option>
              <option value="person-name">Person name</option>
              <option value="date">Date</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {t === 'text' && (
          <>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Format</label>
              <div className="grid grid-cols-2 gap-1.5">
                {FORMATS.map((v) => (
                  <button key={v} type="button" onClick={() => updateAttributes({ format: v })} className={btn(format === v)}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Length</label>
              <div className="grid grid-cols-3 gap-1">
                {LENGTHS.map((v) => (
                  <button key={v} type="button" onClick={() => updateAttributes({ length: v })} className={btn(length === v)}>{v}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1.5">Instructions (optional)</label>
              <textarea
                value={instr}
                onChange={(e) => onInstrChange(e.target.value)}
                placeholder="Hint for the AI when filling this variable…"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg resize-none border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          </>
        )}

        {t === 'person-name' && (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Name format</label>
            <div className="space-y-1.5">
              {NAME_FORMATS.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updateAttributes({ nameFormat: opt.v })}
                  className={cn('w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border',
                    nameFormat === opt.v ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-slate-300 hover:bg-slate-50 text-slate-600')}
                >
                  <span className="font-medium">{opt.v}</span>
                  <span className="opacity-60">{opt.ex}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {t === 'date' && (
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Date format</label>
            <div className="space-y-1.5">
              {DATE_FORMATS.map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => updateAttributes({ dateFormat: opt.v })}
                  className={cn('w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg border',
                    dateFormat === opt.v ? 'bg-violet-100 border-violet-400 text-violet-700' : 'border-slate-300 hover:bg-slate-50 text-slate-600')}
                >
                  <span className="font-medium">{opt.v}</span>
                  <span className="opacity-60">{opt.ex}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VariableConfigPanel;