import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Edit3, Trash2, Plus, FileText, Loader2 } from 'lucide-react';
import { TemplateCreate } from './TemplateCreate';
import { TemplateEdit } from './TemplateEdit';

interface Props { apiKey: string; baseUrl: string; }

interface TemplateSummary {
  templateId: string;
  name: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

type Mode =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; templateId: string };

/**
 * Top-level page for the Templates section. Routes between three internal
 * views (list / create / edit) without touching the URL — the parent App
 * already persists the active page in localStorage, and the user always lands
 * on the list when they re-enter the section.
 */
export function Templates({ apiKey, baseUrl }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
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
      setTemplates(data.templates || []);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, baseUrl]);

  useEffect(() => {
    if (mode.kind === 'list') {
      refresh();
    }
  }, [mode.kind, refresh]);

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
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (mode.kind === 'create') {
    return (
      <TemplateCreate
        apiKey={apiKey}
        baseUrl={baseUrl}
        onCancel={() => setMode({ kind: 'list' })}
        onCreated={(templateId) => setMode({ kind: 'edit', templateId })}
      />
    );
  }

  if (mode.kind === 'edit') {
    return (
      <TemplateEdit
        apiKey={apiKey}
        baseUrl={baseUrl}
        templateId={mode.templateId}
        onBack={() => setMode({ kind: 'list' })}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Templates</h2>
          <p className="text-slate-600">Manage the document templates used by the API.</p>
        </div>
        <button
          onClick={() => setMode({ kind: 'create' })}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" /> New template
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 mb-4">No templates yet.</p>
          <button
            onClick={() => setMode({ kind: 'create' })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-600"
          >
            <Plus className="w-4 h-4" /> Create your first template
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {templates.map((t) => (
            <div key={t.templateId} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{t.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.language} · updated {new Date(t.updatedAt).toLocaleDateString()}
                  <span className="mx-1.5">·</span>
                  <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded">{t.templateId}</code>
                </p>
              </div>
              <button
                onClick={() => setMode({ kind: 'edit', templateId: t.templateId })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => handleDelete(t.templateId)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}