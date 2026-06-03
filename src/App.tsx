import { useState } from 'react';
import { Toaster } from 'sonner';
import { Setup } from './pages/Setup';
import { CreateTemplate } from './pages/CreateTemplate';
import { GenerateDocument } from './pages/GenerateDocument';

type Page = 'setup' | 'templates' | 'generate';

export default function App() {
  const [page, setPage] = useState<Page>('setup');
  const [apiKey, setApiKey] = useState(localStorage.getItem('vodical_api_key') || '');
  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('vodical_base_url') || 'https://your-instance.supabase.co/functions/v1');

  const handleSetup = (key: string, url: string) => {
    setApiKey(key);
    setBaseUrl(url);
    localStorage.setItem('vodical_api_key', key);
    localStorage.setItem('vodical_base_url', url);
    setPage('templates');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="bottom-right" richColors />
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Vodical API Client</h1>
            <span className="text-xs bg-accent/10 text-accent-500 px-2 py-0.5 rounded-full font-medium">Demo</span>
          </div>
          
          {apiKey && (
            <nav className="flex gap-1">
              <button onClick={() => setPage('setup')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${page === 'setup' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                Setup
              </button>
              <button onClick={() => setPage('templates')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${page === 'templates' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                Templates
              </button>
              <button onClick={() => setPage('generate')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${page === 'generate' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                Generate
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {page === 'setup' && <Setup onComplete={handleSetup} currentKey={apiKey} currentUrl={baseUrl} />}
        {page === 'templates' && <CreateTemplate apiKey={apiKey} baseUrl={baseUrl} />}
        {page === 'generate' && <GenerateDocument apiKey={apiKey} baseUrl={baseUrl} />}
      </main>
    </div>
  );
}