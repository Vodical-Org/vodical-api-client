# Vodical API Client — Integration Guide

A reference implementation showing how to integrate the **Vodical Document Generation API** into any web application — **any framework, or no framework at all** — with **pixel-perfect PDF export** identical to the Vodical web app itself.

> 💡 **Framework-agnostic.** The API is plain HTTPS + JSON. The PDF pipeline is plain TypeScript that runs in any modern browser (and in Node). The reference UI in this repo happens to use React + Vite, but **nothing in `src/utils/` depends on React** — you can drop those files into a vanilla JS, Vue, Svelte, Angular, jQuery, or plain `<script>` page and they'll work identically.

> 📘 **Three docs, one source of truth:**
> - [**README.md**](./README.md) — this file: integration tutorials per framework.
> - [**API.md**](./API.md) — human-readable HTTP spec.
> - [**openapi.yaml**](./openapi.yaml) — machine-readable OpenAPI 3.1 spec. Drop it in [Swagger UI](https://editor.swagger.io/), Postman, Insomnia, or [openapi-generator](https://openapi-generator.tech/) to scaffold an SDK in any language.

---

## TL;DR

```bash
# Run the React reference UI
git clone <this-repo> vodical-api-client
cd vodical-api-client
npm install && npm run dev   # → http://localhost:5173
```

To embed the **API + PDF pipeline** in your own product (any stack):

1. **Call the API over HTTPS** with `fetch` (or curl, axios, ky, anything). See [Step 3](#step-3--api-endpoints-reference).
2. **Optionally**, copy the PDF pipeline files into your project to render the returned HTML as a clean A4 PDF — see [Step 5](#step-5--convert-html--pdf-the-pdf-lib-pipeline).

---

## Table of contents

- [What this client does](#what-this-client-does)
- [Architecture overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Step 1 — Get an API key](#step-1--get-an-api-key)
- [Step 2 — Install dependencies](#step-2--install-dependencies)
- [Step 3 — API endpoints reference](#step-3--api-endpoints-reference)
- [Step 4 — Generate a document (vanilla JS, then React/Vue/Angular)](#step-4--generate-a-document)
- [Step 5 — Convert HTML → PDF (the pdf-lib pipeline)](#step-5--convert-html--pdf-the-pdf-lib-pipeline)
- [Why **not** html2pdf.js / jsPDF.html()](#why-not-html2pdfjs--jspdfhtml)
- [Authentication](#authentication)
- [Error handling & rate limits](#error-handling--rate-limits)
- [FAQ / Troubleshooting](#faq--troubleshooting)
- [License](#license)

---

## What this client does

| Feature | Endpoint | Framework needed? |
|---|---|---|
| List your templates | `GET  /api-v1-templates` | None — just `fetch` |
| Create a template | `POST /api-v1-templates` | None |
| Generate a document from any combination of text/audio/image/PDF | `POST /api-v1-generate` | None |
| Export the resulting HTML as **A4 PDF** | *client-side* (or server-side) | None — pure TS, works in browser & Node |

The reference UI in this repo uses React only because **someone has to draw buttons**. The actual integration logic is framework-free.

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────┐
│   Your application — React, Vue, Svelte, Angular, vanilla… │
│                                                              │
│   1. fetch('/api-v1-generate', { headers: { Authorization } })│
│   2. const { html } = await res.json();                      │
│   3. await generatePDF({ content: html });   // pdf-lib      │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTPS + Bearer <API_KEY>
                               ▼
                  ┌─────────────────────────┐
                  │  Vodical Edge Functions │
                  │  (Supabase) — generate, │
                  │  templates, keys, …     │
                  └─────────────────────────┘
```

### Key pieces in this repo

```
vodical-api-client/
├─ public/fonts/                ← TTF fonts embedded into every PDF
│   ├─ arial-regular.ttf        (you can use any TTF)
│   ├─ arial-bold.ttf
│   ├─ arial-italic.ttf
│   └─ arial-bolditalic.ttf
├─ src/
│   ├─ utils/                   ← THE PORTABLE PART — no React, no JSX
│   │   ├─ pageGeometry.ts      ← A4 geometry, margins, line-height (WYSIWYG)
│   │   ├─ pdfGenerator.ts      ← public API: generatePDF({ content, fileName })
│   │   └─ pdf/
│   │       ├─ fonts.ts         ← embeds TTF fonts via @pdf-lib/fontkit
│   │       ├─ parseHtml.ts     ← HTML → typed Block/Run model
│   │       ├─ layout.ts        ← block-level layout (paragraphs, lists, headings)
│   │       └─ pdfWorker.ts     ← runs the whole render off the main thread
│   ├─ pages/                   ← React-only, just for the demo UI
│   │   ├─ Setup.tsx
│   │   ├─ CreateTemplate.tsx
│   │   └─ GenerateDocument.tsx
│   └─ App.tsx                  ← React-only, just for the demo UI
└─ package.json
```

→ **You only need `src/utils/` + `public/fonts/` to integrate Vodical.** Everything else is just a demo.

---

## Prerequisites

- **For the API alone:** any HTTP client. `curl`, browser `fetch`, `axios`, Python `requests`, Go, PHP — anything that speaks HTTPS.
- **For the PDF pipeline:** a modern browser (or Node 18+) and a bundler that supports ES module Web Workers. Vite, Next.js, Remix, Astro, Webpack 5, esbuild, Rollup, Parcel — all work.
- **Fonts** in `public/fonts/` must be served at `/fonts/...` from your origin.

---

## Step 1 — Get an API key

1. Log in to your Vodical account.
2. Open **Settings → API Keys**.
3. Click **Create new key** and copy it (you won't see it again).
4. Note your **base URL**:
   - Production: `https://your-instance.supabase.co/functions/v1`
   - (or the URL of your self-hosted Vodical instance.)

> 🔒 **Never embed an API key in code shipped to end users.** Use a server-side proxy or per-user keys. See [Authentication](#authentication).

---

## Step 2 — Install dependencies

### Option A — You only need the API (no client-side PDF)

Nothing to install. Use whatever HTTP client you already have. The API returns HTML; do whatever you want with it (display it, store it, send it to a backend PDF service, …).

### Option B — You also want client-side PDF generation

```bash
npm install pdf-lib @pdf-lib/fontkit
# or
yarn add pdf-lib @pdf-lib/fontkit
# or
pnpm add pdf-lib @pdf-lib/fontkit
```

Then copy these files from this repo into your project:

```
src/utils/pageGeometry.ts
src/utils/pdfGenerator.ts
src/utils/pdf/fonts.ts
src/utils/pdf/parseHtml.ts
src/utils/pdf/layout.ts
src/utils/pdf/pdfWorker.ts
public/fonts/arial-regular.ttf
public/fonts/arial-bold.ttf
public/fonts/arial-italic.ttf
public/fonts/arial-bolditalic.ttf
```

That's it. **No React. No Tailwind. No build-tool config.** These files are framework-agnostic TypeScript.

> The reference uses `sonner` for toast notifications. Replace with your own UI lib (`alert()`, `console.log()`, native toasts, anything).

---

## Step 3 — API endpoints reference

All endpoints live under `BASE_URL` and require:

```
Authorization: Bearer <YOUR_API_KEY>
Content-Type: application/json
```

### `GET /api-v1-templates`

Returns the list of templates owned by the API-key holder.

```json
{
  "templates": [
    {
      "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
      "name": "Courrier à un confrère",
      "html": "<h2>...</h2>",
      "variables": [...]
    }
  ]
}
```

### `POST /api-v1-templates`

Creates a new template.

```json
{
  "name": "Compte-rendu de consultation",
  "html": "<h2>Compte-rendu</h2><p><span data-vodical-variable=\"true\" data-id=\"var_xxx\" data-name=\"Patient\">[Patient]</span></p>",
  "variables": [
    { "id": "var_xxx", "name": "Patient", "type": "person-name" }
  ]
}
```

→ `201 { "templateId": "..." }`

### `POST /api-v1-generate`

The **main endpoint** — generates a document by combining a template with inputs.

```json
{
  "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
  "outputFormat": "html",
  "inputs": [
    { "type": "text",     "label": "transcript", "content": "Bonjour..." },
    { "type": "audio",    "label": "rec.m4a",    "data": "<base64>" },
    { "type": "image",    "label": "scan.jpg",   "data": "<base64>", "mimeType": "image/jpeg" },
    { "type": "document", "label": "labs.pdf",   "data": "<base64>", "mimeType": "application/pdf" }
  ]
}
```

Pass **any combination** of inputs — the API merges them intelligently before filling in template variables.

Response:

```json
{
  "documentId": "1425bedf-...",
  "templateName": "Courrier à un confrère",
  "html": "<h2>Courrier à un confrère</h2><p>Cher confrère, ...</p>",
  "sources": {
    "rec.m4a": "Bonjour docteur, ..."
  }
}
```

### Quick sanity check with `curl`

```bash
curl -X POST "$BASE_URL/api-v1-generate" \
  -H "Authorization: Bearer $VODICAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
    "outputFormat": "html",
    "inputs": [{ "type": "text", "label": "t", "content": "Patient John Doe, 45 ans." }]
  }'
```

---

## Step 4 — Generate a document

### Vanilla JavaScript (no framework)

```html
<!doctype html>
<html>
<body>
  <button id="go">Generate</button>
  <pre id="out"></pre>

  <script type="module">
    const API_KEY  = 'vk_live_...';
    const BASE_URL = 'https://your-instance.supabase.co/functions/v1';

    async function fileToBase64(file) {
      const buf = new Uint8Array(await file.arrayBuffer());      let bin = '';
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return btoa(bin);
    }

    document.getElementById('go').addEventListener('click', async () => {
      const res = await fetch(`${BASE_URL}/api-v1-generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          templateId: 'a451ecdf-3899-4579-b860-e855a64d2411',
          outputFormat: 'html',
          inputs: [{ type: 'text', label: 'note', content: 'Hello world' }],
        }),
      });
      const data = await res.json();
      document.getElementById('out').textContent = data.html;
    });
  </script>
</body>
</html>
```

Save as `index.html`, double-click, done. **No build step.**

### React (the demo in this repo)

```tsx
async function generate(apiKey, baseUrl, templateId, text) {
  const res = await fetch(`${baseUrl}/api-v1-generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      templateId,
      outputFormat: 'html',
      inputs: [{ type: 'text', label: 'input', content: text }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

### Vue 3 (Composition API)

```vue
<script setup>
import { ref } from 'vue';

const html = ref('');
async function generate() {
  const res = await fetch(`${import.meta.env.VITE_BASE_URL}/api-v1-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
    },
    body: JSON.stringify({
      templateId: 'a451ecdf-...',
      outputFormat: 'html',
      inputs: [{ type: 'text', label: 'input', content: 'Hello' }],
    }),
  });
  html.value = (await res.json()).html;
}
</script>

<template>
  <button @click="generate">Generate</button>
  <div v-html="html"></div>
</template>
```

### Angular service

```ts
@Injectable({ providedIn: 'root' })
export class VodicalService {
  constructor(private http: HttpClient) {}
  generate(templateId: string, text: string) {
    return this.http.post(
      `${environment.vodicalBaseUrl}/api-v1-generate`,
      {
        templateId,
        outputFormat: 'html',
        inputs: [{ type: 'text', label: 'input', content: text }],
      },
      { headers: { Authorization: `Bearer ${environment.vodicalApiKey}` } },
    );
  }
}
```

### Svelte / SvelteKit

```svelte
<script>
  let html = '';
  async function generate() {
    const res = await fetch(`${import.meta.env.VITE_BASE_URL}/api-v1-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_API_KEY}`,
      },
      body: JSON.stringify({
        templateId: 'a451ecdf-...',
        outputFormat: 'html',
        inputs: [{ type: 'text', label: 'input', content: 'Hello' }],
      }),
    });
    html = (await res.json()).html;
  }
</script>

<button on:click={generate}>Generate</button>
{@html html}
```

### Node.js (server-side proxy — the recommended pattern in production)

```ts
// server.ts (Express, Fastify, Hono, …)
app.post('/generate', async (req, res) => {
  const r = await fetch(`${process.env.VODICAL_BASE_URL}/api-v1-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VODICAL_API_KEY}`,
    },
    body: JSON.stringify(req.body),
  });
  res.status(r.status).type('application/json').send(await r.text());
});
```

Your frontend then calls `/generate` and the API key never touches the browser.

### Helper: encoding files to base64

```js
// Browser (any framework)
async function fileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

// Node.js
import { readFile } from 'node:fs/promises';
const base64 = (await readFile('rec.m4a')).toString('base64');
```

### Python

```python
import requests, base64

with open('rec.m4a', 'rb') as f:
    audio_b64 = base64.b64encode(f.read()).decode()

r = requests.post(
    f"{BASE_URL}/api-v1-generate",
    headers={'Authorization': f'Bearer {API_KEY}'},
    json={
        'templateId': 'a451ecdf-...',
        'outputFormat': 'html',
        'inputs': [
            {'type': 'text',  'label': 'notes', 'content': 'Hello'},
            {'type': 'audio', 'label': 'rec.m4a', 'data': audio_b64},
        ],
    },
)
print(r.json()['html'])
```


---

## Step 5 — Convert HTML → PDF (the pdf-lib pipeline)

The Vodical API returns **HTML**. To produce a clean A4 PDF that **looks identical to the in-app exports**, this client uses the same engine as the Vodical web app:

- **`pdf-lib`** + **`@pdf-lib/fontkit`** — vector PDF generation, embedded TTF fonts.
- A **Web Worker** for the heavy lifting (no UI freeze).
- A custom **HTML → blocks → layout** pipeline calibrated to A4 (Arial 11pt, 2.5cm margins).

### Files to copy (~1 100 lines of TS, framework-agnostic)

```
src/utils/pageGeometry.ts
src/utils/pdfGenerator.ts            (entry point)
src/utils/pdf/fonts.ts
src/utils/pdf/parseHtml.ts
src/utils/pdf/layout.ts
src/utils/pdf/pdfWorker.ts
public/fonts/arial-regular.ttf
public/fonts/arial-bold.ttf
public/fonts/arial-italic.ttf
public/fonts/arial-bolditalic.ttf
```

### Public API

```ts
import { generatePDF, generatePDFBytes, buildPdfFileName } from './utils/pdfGenerator';

await generatePDF({
  content: htmlString,
  fileName: 'consultation-2026-06-03.pdf',
});

const bytes = await generatePDFBytes({ content: htmlString });

const name = buildPdfFileName('Compte-rendu', '2026-06-03');
```

### Vanilla JS

```html
<button id="dl">Download PDF</button>
<script type="module">
  import { generatePDF } from './utils/pdfGenerator.js';
  document.getElementById('dl').addEventListener('click', async () => {
    const res = await fetch('/api-v1-generate', { /* ... */ });
    const { html, documentId } = await res.json();
    await generatePDF({ content: html, fileName: `document-${documentId}.pdf` });
  });
</script>
```

### React

```tsx
import { generatePDF } from './utils/pdfGenerator';

function ExportButton({ html, documentId }) {
  return (
    <button
      onClick={() => generatePDF({ content: html, fileName: `document-${documentId}.pdf` })}
    >
      Download PDF
    </button>
  );
}
```

### Vue / Svelte / Angular

The pattern is the same in every framework: import `generatePDF`, call it on a click handler, pass the HTML returned by the API.

### Server-side (Node 18+)

```ts
import { generatePDFBytes } from './utils/pdfGenerator';
import { writeFile } from 'node:fs/promises';

const html = '<h1>Hello</h1>...';
const bytes = await generatePDFBytes({ content: html });
await writeFile('out.pdf', bytes);
```

(In `src/utils/pdf/fonts.ts` replace `fetch('/fonts/...')` with `fs.readFile()` and skip the Web Worker.)

### What the pipeline does internally

1. **`parseHtml.ts`** → walks the DOM, produces a typed `Block[]` (paragraphs, headings, list-items with rich text runs).
2. **`layout.ts`** → breaks blocks into lines using exact glyph widths from fontkit.
3. **`pdfWorker.ts`** → draws each line with `pdf-lib` on A4 pages (auto page-breaks + footer).
4. Worker returns `Uint8Array` PDF bytes.
5. `pdfGenerator.ts` wraps them in a Blob and triggers a download (with a Safari-specific path for proper filename handling).

→ **No DOM trickery, no `position: fixed`, no `html2canvas`.** Just bytes.

---

## Why **not** html2pdf.js / jsPDF.html()

If you've tried HTML-to-PDF in a browser before, you've probably hit these:

| Problem | Why it happens with html2canvas-based libs |
|---|---|
| **Blank PDFs** | `html2canvas` skips elements with `opacity: 0`, `visibility: hidden`, certain `position: fixed` offsets, or anything not painted by the browser. |
| **Truncated text on the right** | Mismatch between `windowWidth` (px), wrapper width (px), and PDF `width` (mm). 1mm = 3.78px at 96 DPI — easy to get wrong. |
| **Fonts 10× too big** | The HTML uses `font-size: 14pt`. `pt` in HTML = 1.33px, but jsPDF treats `pt` as actual print points → enormous output. |
| **Tailwind/Inter bleeding into the PDF** | Parent stylesheets cascade into the wrapper unless you isolate it (e.g. inside an iframe). |
| **Browser inconsistencies** | Safari, Firefox and Chrome all rasterize fonts differently. |
| **Not searchable/copyable** | Bitmap text is just pixels — no text layer in the PDF. |

The `pdf-lib` pipeline avoids **all** of these because it never touches the DOM:
- ✅ Vector text (searchable, copyable, accessible).
- ✅ Embedded fonts (consistent across all readers).
- ✅ Deterministic layout (same input → same bytes).
- ✅ No race conditions.

---

## Authentication

API keys authenticate as a single user account. They:

- start with `vk_live_` (or `vk_test_` in dev) followed by 32 base62 chars,
- are **only shown once at creation** — store them securely,
- can be revoked from **Settings → API Keys**,
- count quota usage against the owning user's plan.

### Browser-based apps

If your app runs **in the user's browser**, **never hard-code the key in JavaScript** — it would be visible in DevTools.

Recommended patterns:

1. **Server-side proxy.** Backend holds the key; frontend → backend → Vodical. Most secure.
2. **Per-user keys.** Each end-user creates their own Vodical account and pastes their key in your UI (the pattern this reference uses with `localStorage`).
3. **Short-lived keys.** Generate a fresh key from your backend per session and revoke it afterwards.

---

## Error handling & rate limits

Errors come back as JSON: `{ "error": "...", "code": "..." }`.

| Status | Meaning |
|---|---|
| `400` | Bad request (malformed body, missing field, file too large) |
| `401` | Missing / invalid `Authorization` header |
| `403` | Plan does not include this feature, or quota exceeded |
| `404` | Template not found |
| `413` | Payload too large (audio > 25 MB, etc.) |
| `429` | Rate limit hit — back off and retry (`Retry-After` header) |
| `5xx` | Server error — retry with exponential backoff |

```ts
async function callVodical(endpoint, body, apiKey, baseUrl) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('retry-after') ?? '5', 10);
    await new Promise(r => setTimeout(r, wait * 1000));
    return callVodical(endpoint, body, apiKey, baseUrl);
  }
  if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
  return res.json();
}
```

---

## FAQ / Troubleshooting

### The PDF is blank or text is too big.
You're using html2canvas/jsPDF.html. Use the `pdf-lib` pipeline shipped here. See [Step 5](#step-5--convert-html--pdf-the-pdf-lib-pipeline).

### Worker fails to load in Next.js / Webpack.
Vite handles `new Worker(new URL(..., import.meta.url), { type: 'module' })` natively. Webpack 5+ supports the same syntax. In Next.js App Router, mark the calling file as `'use client'`.

### Fonts not loading (404 on `/fonts/arial-regular.ttf`).
Make sure the four `arial-*.ttf` files are inside your **public folder** (`public/fonts/` for Vite/Next.js).

### Can I use my own fonts?
Yes. Drop additional TTFs into `public/fonts/` and edit `src/utils/pdf/fonts.ts`:
- Add a logical family in the `LogicalFamily` type.
- Update `resolveFontFamily()` to map a CSS family (e.g. `'roboto'`) to it.
- Make sure the four variants exist: `regular`, `bold`, `italic`, `bolditalic`.

### Does it work offline / in PWAs?
Yes — once the page is loaded, everything (worker, fonts, pdf-lib) is local. Only the API call needs network.

### How big is the bundle?
- `pdf-lib` + `fontkit`: ~1 MB minified (lazy-loaded by the worker).
- 4 Arial TTFs: ~2.7 MB (cached after first download).
- Your main JS chunk stays ~800 KB (worker is split).

For tighter bundles, ship only the variants you need (`regular` + `bold` is often enough).

### How do I change the page format / margins?
Edit `src/utils/pageGeometry.ts`. All sizes flow from there. Screen preview and PDF use the **same constants**, so WYSIWYG is guaranteed.

### Can I generate the PDF server-side instead?
Yes — `pdf-lib` runs in Node. Move `pdfGenerator.ts` (minus the download/Blob bits) and the `pdf/` folder to your backend, replace `fetch('/fonts/...')` with `fs.readFileSync()`, and call `generatePDFBytes({ content: html })`.

### I don't use TypeScript.
Run the files through `tsc` once (`npx tsc src/utils/**/*.ts`) and ship the `.js` outputs. The pipeline has no TS-only features.

### I don't use a bundler.
- For the **API call**: just use `fetch` from a `<script>` tag.
- For the **PDF pipeline**: you'll need *some* form of module loading because the Worker uses `new Worker(new URL(...), { type: 'module' })`. The smallest setup is a single `index.html` + `npx serve`. Or pre-compile the whole pipeline to a single bundle with esbuild: `npx esbuild src/utils/pdfGenerator.ts --bundle --format=esm --outfile=vodical-pdf.js`.

---

## License

This client is provided as a reference. Use it, fork it, embed it.
