import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { generatePDF } from '../utils/pdfGenerator';

interface Props { apiKey: string; baseUrl: string; }

export function GenerateDocument({ apiKey, baseUrl }: Props) {
  const [templateId, setTemplateId] = useState('');
  const [textInput, setTextInput] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    fetch(`${baseUrl}/api-v1-templates`, { headers: { 'Authorization': `Bearer ${apiKey}` } })
      .then(r => r.json())
      .then(d => { if (d.templates) setTemplates(d.templates); })
      .catch(() => {});
  }, [apiKey, baseUrl]);

  const fileToBase64 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const handleGenerate = async () => {
    if (!templateId) { toast.error('Select a template'); return; }

    const inputs: any[] = [];
    if (textInput.trim()) inputs.push({ type: 'text', content: textInput, label: 'text_input' });

    setLoading(true);
    setStatus('Preparing inputs...');
    setPreviewHtml(null);
    setSources(null);

    try {
      if (audioFile) {
        setStatus('Encoding audio...');
        inputs.push({ type: 'audio', data: await fileToBase64(audioFile), label: audioFile.name });
      }
      if (imageFile) {
        setStatus('Encoding image...');
        inputs.push({ type: 'image', data: await fileToBase64(imageFile), label: imageFile.name, mimeType: imageFile.type });
      }
      if (documentFile) {
        setStatus('Encoding document...');
        inputs.push({ type: 'document', data: await fileToBase64(documentFile), label: documentFile.name, mimeType: documentFile.type });
      }

      if (inputs.length === 0) {
        toast.error('Provide at least one input (text, audio, image or document)');
        setLoading(false); setStatus(''); return;
      }

      setStatus('Processing...');
      const res = await fetch(`${baseUrl}/api-v1-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ templateId, inputs, outputFormat: 'html' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Failed: ${res.status}`);
      }

      const data = await res.json();
      const html = data.html;
      if (!html) throw new Error('No HTML returned');

      setPreviewHtml(html);
      setSources(data.sources || null);

      // Convert HTML to PDF using the same pdf-lib + Web Worker pipeline as the
      // main Vodical web app — guarantees 1:1 visual parity with the in-app exports.
      setStatus('Converting to PDF...');
      await generatePDF({
        content: html,
        fileName: `document-${data.documentId || Date.now()}.pdf`,
      });
      toast.success('PDF generated and downloaded!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Generate Document</h2>
      <p className="text-slate-600 mb-6">Combine text, audio, images and documents in a single generation.</p>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Template *</label>
          <select value={templateId} onChange={e => setTemplateId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
            <option value="">Select a template...</option>
            {templates.map((t: any) => <option key={t.templateId} value={t.templateId}>{t.name}</option>)}
          </select>
          {templates.length === 0 && <p className="text-xs text-amber-600 mt-1">No templates found. Create one first.</p>}
        </div>

        <div className="border-t border-slate-200 pt-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Inputs (combine any)</h3>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">T</span>
              Text (transcription)
            </label>
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)} rows={5} placeholder="Paste a transcription or any text content..." className="w-full px-4 py-2.5 border border-slate-300 rounded-lg font-mono text-sm resize-none" />
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">A</span>
              Audio file
            </label>
            <input type="file" accept="audio/*" onChange={e => setAudioFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" />
            {audioFile && <p className="text-xs text-slate-500 mt-1">📎 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <span className="w-6 h-6 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center text-xs font-bold">I</span>
              Image (photo, scan)
            </label>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" />
            {imageFile && <p className="text-xs text-slate-500 mt-1">📎 {imageFile.name} ({(imageFile.size / 1024).toFixed(0)} KB)</p>}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
              <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">D</span>
              Document (PDF, etc.)
            </label>
            <input type="file" accept=".pdf,application/pdf" onChange={e => setDocumentFile(e.target.files?.[0] || null)} className="w-full px-4 py-2 border border-slate-300 rounded-lg text-sm" />
            {documentFile && <p className="text-xs text-slate-500 mt-1">📎 {documentFile.name} ({(documentFile.size / 1024).toFixed(0)} KB)</p>}
          </div>
        </div>

        <button onClick={handleGenerate} disabled={loading} className="w-full bg-primary text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors">
          {loading ? status || 'Processing...' : 'Generate PDF'}
        </button>
      </div>

      {sources && Object.keys(sources).length > 0 && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Extracted Sources</h3>
          {Object.entries(sources).map(([label, content]) => (
            <details key={label} className="mb-2 border border-slate-200 rounded-lg">
              <summary className="px-4 py-2 text-sm font-medium cursor-pointer hover:bg-slate-50">{label}</summary>
              <div className="px-4 py-3 text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 max-h-64 overflow-y-auto">
                {content}
              </div>
            </details>
          ))}
        </div>
      )}

      {previewHtml && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">Generated Document Preview</h3>
          <div className="border border-slate-200 rounded-lg p-6 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      )}
    </div>
  );
}
