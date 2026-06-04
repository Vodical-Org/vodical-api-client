import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

interface Props {
  apiKey: string;
  baseUrl: string;
  onCancel: () => void;
  onCreated: (templateId: string) => void;
}

const EXAMPLES = [
  { name: 'Compte-rendu de consultation', profession: 'Médecin généraliste', objective: 'Résumé structuré avec motif, examen, diagnostic et plan de traitement' },
  { name: 'Courrier au confrère', profession: 'Médecin spécialiste', objective: 'Lettre au médecin traitant avec synthèse et recommandations' },
  { name: 'Bilan orthodontique', profession: 'Orthodontiste', objective: 'Examen clinique, radiographique et plan de traitement' },
  { name: 'Note de réunion', profession: 'Manager', objective: 'Synthèse avec participants, décisions et actions' },
  { name: 'Rapport juridique', profession: 'Avocat', objective: 'Analyse des faits et recommandations' },
];

/**
 * AI-driven template creation form. After a successful creation the parent
 * automatically switches to the edit view so the user can refine the
 * generated HTML / variables.
 */
export function TemplateCreate({ apiKey, baseUrl, onCancel, onCreated }: Props) {
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [objective, setObjective] = useState('');
  const [language, setLanguage] = useState('fr');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('auto');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Template name is required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api-v1-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ name, profession, language, objective, tone, length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success(`Template "${data.name}" created!`);
      onCreated(data.templateId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to templates
        </button>

        <h2 className="text-2xl font-bold text-slate-900 mb-2">Create Template</h2>
        <p className="text-slate-600 mb-6">AI generates the document structure with variables automatically.</p>

        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Template Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Compte-rendu de consultation"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Profession</label>
            <input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="e.g., Médecin, Avocat, Manager..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Objective / Instructions</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              placeholder="Describe what the document should contain..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tone</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                <option value="professional">Professional</option>
                <option value="neutral">Neutral</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Length</label>
              <select value={length} onChange={(e) => setLength(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                <option value="auto">Auto</option>
                <option value="concise">Concise</option>
                <option value="detailed">Detailed</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Create Template'}
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Examples</h3>
        <div className="space-y-2">
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              onClick={() => {
                setName(ex.name);
                setProfession(ex.profession);
                setObjective(ex.objective);
              }}
              className="w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-primary/40 hover:bg-primary-50 transition-all"
            >
              <p className="text-sm font-medium text-slate-800">{ex.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{ex.profession}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}