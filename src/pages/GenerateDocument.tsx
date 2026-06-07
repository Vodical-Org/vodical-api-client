import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Copy, Check, FileDown, ArrowRightToLine } from 'lucide-react';
import { generatePDF } from '../utils/pdfGenerator';
import { UnifiedEditor } from '../components/ui/unified-editor';
import { A4Sheet } from '../components/ui/A4Sheet';
import { formatTranscriptionToHTML, type SpeakerSegment } from '../utils/transcriptionToHtml';

interface Props { apiKey: string; baseUrl: string; }

interface TranscriptionResult {
  transcriptionId: string;
  text: string;
  speakers?: SpeakerSegment[];
  language: string;
  durationSeconds: number;
}

export function GenerateDocument({ apiKey, baseUrl }: Props) {
  const [templateId, setTemplateId] = useState('');
  const [textInput, setTextInput] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [editedHtml, setEditedHtml] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [sources, setSources] = useState<Record<string, string> | null>(null);

  // Audio-only transcription (no AI summary)
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [transcribeAction, setTranscribeAction] = useState<'copy' | 'pdf' | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

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
    setEditedHtml(null);
    setDocumentId(null);
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

      setEditedHtml(html);
      setDocumentId(data.documentId || null);
      setSources(data.sources || null);
      toast.success('Document generated! You can now edit it before exporting.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const handleExportPdf = async () => {
    if (!editedHtml) return;
    setExporting(true);
    try {
      await generatePDF({
        content: editedHtml,
        fileName: `document-${documentId || Date.now()}.pdf`,
      });
      toast.success('PDF exported!');
    } catch (err: any) {
      toast.error(err.message || 'PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // Audio-only transcription (no AI document generation)
  // ──────────────────────────────────────────────────────────────────────
  const handleTranscribeAudio = async () => {
    if (!audioFile) {
      toast.error('Pick an audio file first');
      return;
    }
    setTranscribing(true);
    setTranscription(null);
    try {
      const data = await fileToBase64(audioFile);
      const res = await fetch(`${baseUrl}/api-v1-transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          audio: data,
          language: 'fr',
          label: audioFile.name,
          speakerLabels: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Failed: ${res.status}`);
      }
      const json = (await res.json()) as TranscriptionResult;
      setTranscription(json);
      toast.success('Transcription ready');
    } catch (err: any) {
      toast.error(err.message || 'Transcription failed');
    } finally {
      setTranscribing(false);
    }
  };

  const transcriptionHtml = transcription
    ? formatTranscriptionToHTML(transcription.text, transcription.speakers)
    : '';

  const handleCopyTranscription = async () => {
    if (!transcription) return;
    setTranscribeAction('copy');
    try {
      // Try rich (HTML) clipboard first; fall back to plain text.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        const blob = new Blob([transcriptionHtml], { type: 'text/html' });
        const txtBlob = new Blob([transcription.text], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': blob, 'text/plain': txtBlob }),
        ]);
      } else {
        await navigator.clipboard.writeText(transcription.text);
      }
      toast.success('Transcription copied');
    } catch {
      try {
        await navigator.clipboard.writeText(transcription.text);
        toast.success('Transcription copied');
      } catch {
        toast.error('Could not copy to clipboard');
      }
    }
    setTimeout(() => setTranscribeAction(null), 1800);
  };

  const handleExportTranscriptionPdf = async () => {
    if (!transcription) return;
    setTranscribeAction('pdf');
    try {
      await generatePDF({
        content: transcriptionHtml,
        fileName: `transcription-${transcription.transcriptionId}.pdf`,
      });
      toast.success('Transcription exported');
    } catch (err: any) {
      toast.error(err.message || 'PDF export failed');
    } finally {
      setTimeout(() => setTranscribeAction(null), 1800);
    }
  };

  const handleUseTranscriptionAsText = () => {
    if (!transcription) return;
    setTextInput(transcription.text);
    setAudioFile(null);
    setTranscription(null);
    toast.success('Transcription moved to the text input');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const formatDuration = (s: number): string => {
    if (!s || s <= 0) return '';
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}m ${ss.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Generate Document</h2>
      <p className="text-slate-600 mb-6">Combine text, audio, images and documents in a single generation.</p>

      <div ref={formRef} className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
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
            {audioFile && (
              <div className="flex items-center justify-between gap-3 mt-1.5 flex-wrap">
                <p className="text-xs text-slate-500">📎 {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)} MB)</p>
                <button
                  type="button"
                  onClick={handleTranscribeAudio}
                  disabled={transcribing || loading}
                  className="text-xs px-3 py-1.5 border border-purple-300 text-purple-700 hover:bg-purple-50 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                  title="Run transcription only — no document generation"
                >
                  {transcribing ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Transcribing…
                    </>
                  ) : (
                    <>🎙 Transcribe audio only</>
                  )}
                </button>
              </div>
            )}
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
          {loading ? status || 'Processing...' : 'Generate Document'}
        </button>
      </div>

      {/* Audio-only transcription: loading animation */}
      {transcribing && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-10">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-6">
              <div className="absolute inset-0 opacity-90" style={{ animation: 'spin 8s linear infinite' }}>
                <img src="/cercle-ecoute-1.svg" alt="" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 10px rgba(59, 122, 238, 0.3))' }} />
              </div>
              <div className="absolute inset-[18%] opacity-85" style={{ animation: 'spin 5s linear infinite, pulse-breathing 1.8s ease-in-out infinite' }}>
                <img src="/cercle-transcit-2.svg" alt="" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 8px rgba(85, 0, 255, 0.3))' }} />
              </div>
              <div className="absolute inset-[36%] opacity-80" style={{ animation: 'spin 3s linear infinite' }}>
                <img src="/cercle-resumer-3.svg" alt="" className="w-full h-full" style={{ filter: 'drop-shadow(0 0 12px rgba(30, 88, 232, 0.4))' }} />
              </div>
            </div>
            <p className="text-center text-slate-600 text-base font-medium">Transcription en cours…</p>
            <p className="text-center text-slate-400 text-xs mt-1">This can take up to a few minutes for long audio files.</p>
          </div>
        </div>
      )}

      {/* Audio-only transcription: result */}
      {transcription && !transcribing && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Transcription</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {transcription.language.toUpperCase()}
                {transcription.durationSeconds > 0 && ` · ${formatDuration(transcription.durationSeconds)}`}
                {transcription.speakers && transcription.speakers.length > 0 && ` · ${transcription.speakers.length} segments`}
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-full shadow-sm px-2 py-1.5">
              <button
                onClick={handleCopyTranscription}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                  transcribeAction === 'copy' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Copy transcription (HTML + plain text)"
              >
                {transcribeAction === 'copy' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={handleExportTranscriptionPdf}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                  transcribeAction === 'pdf' ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Export transcription to PDF"
              >
                {transcribeAction === 'pdf' ? <Check className="w-4 h-4" /> : <FileDown className="w-4 h-4" />}
              </button>
              <button
                onClick={handleUseTranscriptionAsText}
                className="h-8 w-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
                title="Use this transcription as the text input"
              >
                <ArrowRightToLine className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 overflow-y-auto max-h-[800px]">
            <A4Sheet className="mx-auto">
              <UnifiedEditor
                content={transcriptionHtml}
                editable={false}
                toolbar="none"
                fontSize="11pt"
                className="!border-0 !ring-0 !shadow-none !rounded-none !bg-transparent"
                contentClassName="[&_.ProseMirror]:p-0"
              />
            </A4Sheet>
          </div>
        </div>
      )}

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

      {editedHtml !== null && (
        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Generated Document (editable)
            </h3>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Exporting...
                </>
              ) : (
                <>📄 Export to PDF</>
              )}
            </button>
          </div>

          <UnifiedEditor
            content={editedHtml}
            onChange={setEditedHtml}
            editable
            toolbar="full"
            className="min-h-[600px]"
            contentClassName="min-h-[500px]"
          />
        </div>
      )}
    </div>
  );
}