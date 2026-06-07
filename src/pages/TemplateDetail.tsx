import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Pencil, Save, X, Loader2 } from 'lucide-react';
import type { Editor } from '@tiptap/react';
import { UnifiedEditor } from '../components/ui/unified-editor';
import { A4Sheet } from '../components/ui/A4Sheet';
import { VariableSelectionProvider, useVariableSelection } from '../components/ui/tiptap-tokens/variableSelectionContext';
import { VariableAddPanel } from '../components/ui/tiptap-tokens/VariableAddPanel';
import { VariableConfigPanel } from '../components/ui/tiptap-tokens/VariableConfigPanel';

interface UpdatedSummary {
  templateId: string;
  name: string;
  language: string;
  updatedAt: string;
}

interface Props {
  apiKey: string;
  baseUrl: string;
  templateId: string;
  onUpdated: (updated: UpdatedSummary) => void;
  onDeleted: () => void;
}

/**
 * Center pane of the Templates page. Loads one template and shows it as a
 * read-only preview by default; "Modify" toggles the TipTap editor (with
 * variables) and reveals the side panel for variable add/config + a "Save"
 * button. Save calls PUT /api-v1-templates and bubbles the new metadata up
 * to the parent so the sidebar stays in sync without a full refetch.
 */
export function TemplateDetail(props: Props) {
  return (
    <VariableSelectionProvider>
      <TemplateDetailInner {...props} />
    </VariableSelectionProvider>
  );
}

function TemplateDetailInner({ apiKey, baseUrl, templateId, onUpdated }: Props) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const { addVariableState, selectedVariable } = useVariableSelection();

  // Load template on mount / when the id changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api-v1-templates?id=${templateId}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load template');
        if (cancelled) return;
        setName(data.name || '');
        setLanguage(data.language === 'en' ? 'en' : 'fr');
        setHtml(data.html || '');
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiKey, baseUrl, templateId]);

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
      onUpdated({
        templateId: data.templateId,
        name: data.name,
        language: data.language,
        updatedAt: data.updatedAt,
      });
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Restores the cursor saved by the "+" widget plugin then calls insertVariable.
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
      <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 px-5 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              className="w-full px-3 py-1.5 text-base font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          ) : (
            <h2 className="text-lg font-semibold text-slate-900 truncate">{name}</h2>
          )}
          <p className="text-xs text-slate-500 mt-0.5">
            <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px]">{templateId}</code>
          </p>
        </div>

        {editing && (
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as 'fr' | 'en')}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
          >
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        )}

        {editing ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Modify
          </button>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      {editing ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4 flex-1 min-h-[600px]">
          {/* Gray "desktop" background; the A4 sheet (794 px) is centered and
              scaled down on narrow viewports so the layout never looks
              squeezed when the variable panel is open. */}
          <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 overflow-y-auto max-h-[80vh]">
            <A4Sheet className="mx-auto" withMargins={false} maxScale={1.25}>
              <UnifiedEditor
                content={html ?? ''}
                onChange={setHtml}
                editable
                toolbar="full"
                enableVariables
                className="!border-0 !ring-0 !shadow-none !rounded-none !bg-transparent"
                contentClassName="[&_.ProseMirror]:px-[96px] [&_.ProseMirror]:py-[96px]"
                onEditorReady={(editor) => { editorRef.current = editor; }}
              />
            </A4Sheet>
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
                  Place your cursor on a word boundary to reveal the{' '}
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-white text-[10px] font-bold">+</span>{' '}
                  button and add a variable, or click any existing chip to configure it.
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 overflow-y-auto max-h-[80vh] flex-1">
          {/* Read-only preview rendered with the same editor (TipTap) so dates
              and variable chips look identical to the edit view, just locked.
              Wrapped in <A4Sheet> so it always has the same A4 width as in the
              PDF export. */}
          <A4Sheet className="mx-auto">
            <UnifiedEditor
              content={html ?? ''}
              editable={false}
              toolbar="none"
              enableVariables
              className="!border-0 !ring-0 !shadow-none !rounded-none !bg-transparent"
              contentClassName="[&_.ProseMirror]:p-0"
            />
          </A4Sheet>
        </div>
      )}
    </div>
  );
}