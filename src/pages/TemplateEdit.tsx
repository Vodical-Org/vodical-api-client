import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { UnifiedEditor } from '../components/ui/unified-editor';
import { VariableSelectionProvider, useVariableSelection } from '../components/ui/tiptap-tokens/variableSelectionContext';
import { VariableAddPanel } from '../components/ui/tiptap-tokens/VariableAddPanel';
import { VariableConfigPanel } from '../components/ui/tiptap-tokens/VariableConfigPanel';

interface Props {
  apiKey: string;
  baseUrl: string;
  templateId: string;
  onBack: () => void;
}

/**
 * Editor for an existing template. The HTML body is fetched from
 * `GET /api-v1-templates?id=…`, edited locally with the TipTap-based
 * `UnifiedEditor` (variables enabled), then PUT back on save.
 */
export function TemplateEdit(props: Props) {
  return (
    <VariableSelectionProvider>
      <TemplateEditInner {...props} />
    </VariableSelectionProvider>
  );
}

function TemplateEditInner({ apiKey, baseUrl, templateId, onBack }: Props) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const { addVariableState, selectedVariable } = useVariableSelection();

  // Load template once
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api-v1-templates?id=${templateId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load template');
        if (cancelled) return;
        setName(data.name || '');
        setLanguage((data.language === 'en' ? 'en' : 'fr'));
        setHtml(data.html || '');
      } catch (err: any) {
        toast.error(err.message);
        onBack();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey, baseUrl, templateId, onBack]);

  const handleSave = async () => {
    if (html == null) return;
    if (!name.trim()) {
      toast.error('Template name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/api-v1-templates?id=${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ html, name, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success('Template saved');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  // The "+" widget plugin saves a cursor position; when the user picks a name in
  // the side panel we restore it and call the editor's `insertVariable` command.
  const handleInsertVariable = (variableName: string) => {
    const editor = editorRef.current;
    if (!editor || !addVariableState) return;
    editor
      .chain()
      .focus()
      .setTextSelection(addVariableState.cursorPosition)
      .insertContent(' ')
      .run();
    (editor as any).chain().focus().insertVariable({ name: variableName }).run();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to templates
        </button>

        <div className="flex-1 max-w-md">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Template name"
            className="w-full px-3 py-2 text-sm font-medium border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
          />
        </div>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      {/* Editor + side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 min-h-[640px]">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <UnifiedEditor
            content={html ?? ''}
            onChange={setHtml}
            editable
            toolbar="full"
            enableVariables
            className="h-full min-h-[640px]"
            contentClassName="min-h-[600px]"
            onEditorReady={(editor) => { editorRef.current = editor; }}
          />
        </div>

        <aside className="bg-white rounded-xl border border-slate-200 overflow-hidden h-[640px] flex flex-col">
          {addVariableState?.isOpen ? (
            <VariableAddPanel onInsertVariable={handleInsertVariable} />
          ) : selectedVariable ? (
            <VariableConfigPanel />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3">
                <span className="text-xl">✨</span>
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">Variables side panel</p>
              <p className="text-xs text-slate-500 leading-relaxed">
                Place your cursor on a word boundary in the editor: a small{' '}
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-white text-[10px] font-bold">+</span>{' '}
                will appear. Click it to add a new variable, or click any existing chip to configure it.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}