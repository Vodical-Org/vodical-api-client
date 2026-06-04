import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  onComplete: (key: string, url: string) => void;
  currentKey: string;
  currentUrl: string;
}

export function Setup({ onComplete, currentKey, currentUrl }: Props) {
  const [apiKey, setApiKey] = useState(currentKey);
  const [baseUrl, setBaseUrl] = useState(currentUrl);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.startsWith('vdc_sk_')) {
      toast.error('API key must start with vdc_sk_');
      return;
    }
    if (!baseUrl) {
      toast.error('Base URL is required');
      return;
    }
    onComplete(apiKey, baseUrl);
    toast.success('Configuration saved!');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">API Configuration</h2>
        <p className="text-slate-600">Configure your Vodical API credentials to start generating documents.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="vdc_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1.5">Your API key from the Vodical dashboard. Starts with <code className="bg-slate-100 px-1 rounded">vdc_sk_</code>.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Base URL</label>
            <input
              type="url"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://your-project.supabase.co/functions/v1"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-1.5">The Supabase Edge Functions base URL for your project</p>
          </div>
        </div>

        <button type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-600 transition-colors">
          Save & Continue
        </button>
      </form>

      {/* Info card */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How to get an API key</h3>
        <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
          <li>Log into the Vodical app</li>
          <li>Go to Settings → Developer</li>
          <li>Click "Create API Key"</li>
          <li>Copy the key (shown only once)</li>
        </ol>
      </div>
    </div>
  );
}