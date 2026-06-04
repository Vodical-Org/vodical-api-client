import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Trash2, Plus, FileText, Loader2 } from 'lucide-react';
import { TemplateCreate } from './TemplateCreate';
import { TemplateDetail } from './TemplateDetail';

interface Props { apiKey: string; baseUrl: string; }

interface TemplateSummary {
  templateId: string;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

type Mode =
  | { kind: 'browse'; selectedId: string | null }
  | { kind: 'create' };

/**
 * Templates page: persistent left sidebar with the list of templates,
 * center pane shows the currently-selected template (read-only preview by
 * default; the user clicks "Modify" to switch the right pane into the TipTap
 * editor with variables enabled). A single "+ New" button at the top of the
 * sidebar swaps the center pane to the AI creation form.
 */
export function Templates({ apiKey, baseUrl }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'browse', selectedId: null });
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api-v1-templates`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch templates');
      const list: TemplateSummary[] = data.templates || [];
      setTemplates(list);
      // Auto-select the first template on initial load to avoid a blank center pane.
      setMode((prev) => {
        if (prev.kind !== 'browse') return prev;
        if (prev.selectedId && list.some((t) => t.templateId === prev.selectedId)) return prev;
        return { kind: 'browse', selectedId: list[0]?.templateId ?? null };
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      const res = await fetch(`${baseUrl}/api-v1-templates?id=${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success('Template deleted');
      setTemplates((prev) => prev.filter((t) => t.templateId !== id));
      // If we just deleted the one we were viewing, fall back to the first one.
      setMode((prev) => {
        if (prev.kind !== 'browse' || prev.selectedId !== id) return prev;
        const remaining = templates.filter((t) => t.templateId !== id);
        return { kind: 'browse', selectedId: remaining[0]?.templateId ?? null };
      });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreated = (templateId: string) => {
    // Refresh list and jump to the new template in browse mode.
    refresh().then(() => setMode({ kind: 'browse', selectedId: templateId }));
  };

  // Patch the cached summary after a successful save so the sidebar reflects
  // the new name / updatedAt without a full refetch.
  const handleUpdated = (updated: { templateId: string; name: string; language: string; updatedAt: string }) => {
    setTemplates((prev) =>
      prev.map((t) =>
        t.templateId === updated.templateId
          ? { ...t, name: updated.name, language: updated.language, updatedAt: updated.updatedAt }
          : t,
      ),
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 min-h-[640px]">
      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <aside className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900 mb-2">Templates</h2>
          <button
            type="button"
            onClick={() => setMode({ kind: 'create' })}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : templates.length === 0 ? (
            <div className="p-6 text-center">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No templates yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {templates.map((t) => {
                const isActive = mode.kind === 'browse' && mode.selectedId === t.templateId;
                return (
                  <li key={t.templateId}>
                    <button
                      type="button"
                      onClick={() => setMode({ kind: 'browse', selectedId: t.templateId })}
                      className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
                        isActive
                          ? 'bg-primary-50 border-l-2 border-primary'
                          : 'hover:bg-slate-50 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${isActive ? 'font-semibold text-primary' : 'font-medium text-slate-800'}`}>
                          {t.name}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {t.language} · {new Date(t.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        role="button"
                        tabIndex={0}
                        title="Delete template"
                        onClick={(e) => { e.stopPropagation(); handleDelete(t.templateId); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDelete(t.templateId);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-1 rounded text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Center / right pane ──────────────────────────────────────── */}
      <main className="min-w-0">
        {mode.kind === 'create' ? (
          <TemplateCreate
            apiKey={apiKey}
            baseUrl={baseUrl}
            onCancel={() => setMode({ kind: 'browse', selectedId: templates[0]?.templateId ?? null })}
            onCreated={handleCreated}
          />
        ) : mode.selectedId ? (
          <TemplateDetail
            key={mode.selectedId}
            apiKey={apiKey}
            baseUrl={baseUrl}
            templateId={mode.selectedId}
            onUpdated={handleUpdated}
            onDeleted={() => handleDelete(mode.selectedId!)}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center h-full flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-4">No template selected.</p>
            <button
              onClick={() => setMode({ kind: 'create' })}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-600"
            >
              <Plus className="w-4 h-4" /> Create your first template
            </button>
          </div>
        )}
      </main>
    </div>
  );
}