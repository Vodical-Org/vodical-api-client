# Vodical API — Reference Documentation

Complete HTTP reference for the Vodical Document Generation API (v1).

> 📘 This file is the **human-readable API spec** — endpoints, payloads, status codes, scopes, error codes.
>
> Companion docs:
> - [**README.md**](./README.md) — integration tutorials per framework.
> - [**openapi.yaml**](./openapi.yaml) — machine-readable OpenAPI 3.1 spec. Drop it in [Swagger UI](https://editor.swagger.io/), Postman, Insomnia, or [openapi-generator](https://openapi-generator.tech/) to scaffold an SDK in any language.

---

## Table of contents

- [Base URL](#base-url)
- [Authentication](#authentication)
  - [API key format](#api-key-format)
  - [Scopes](#scopes)
- [Endpoints](#endpoints)
  - [`GET  /api-v1-templates` — List templates](#get--api-v1-templates)
  - [`GET  /api-v1-templates?id={id}` — Get single template](#get--api-v1-templatesidid)
  - [`POST /api-v1-templates` — Create a template](#post-api-v1-templates)
  - [`PUT  /api-v1-templates?id={id}` — Update a template](#put--api-v1-templatesidid)
  - [`DELETE /api-v1-templates?id={id}` — Delete a template](#delete-api-v1-templatesidid)
  - [`POST /api-v1-generate` — Generate a document](#post-api-v1-generate)
  - [`POST /api-v1-transcribe` — Transcribe audio (no document)](#post-api-v1-transcribe)
- [Common error responses](#common-error-responses)
- [Variable system in templates](#variable-system-in-templates)
- [HTML output guarantees](#html-output-guarantees)
- [Limits & quotas](#limits--quotas)
- [Versioning & stability](#versioning--stability)

---

## Base URL

```
https://your-instance.supabase.co/functions/v1
```

(Or the URL of your self-hosted Vodical instance.)

All endpoints below are **relative to this base**. So `/api-v1-templates` actually means `https://your-instance.supabase.co/functions/v1/api-v1-templates`.

---

## Authentication

Every request **must** carry a Bearer API key in the `Authorization` header:

```http
Authorization: Bearer vdc_sk_AbCdEf0123456789AbCdEf0123456789ab
```

Failure to provide a key, or an invalid key, returns:

| Status | Error message |
|---|---|
| `401` | `Missing Authorization header` |
| `401` | `Invalid API key format. Keys must start with vdc_sk_` |
| `401` | `Invalid API key` |
| `401` | `API key has expired` |
| `500` | `Internal authentication error` |

### API key format

```
vdc_sk_AbCdEf0123456789AbCdEf0123456789ab
└──┬──┘└─────────────────┬─────────────────┘
prefix (7 chars)        random body (32 base62 chars)
```

- The full key is **39 characters** total.
- Stored as `SHA-256(fullKey)` server-side; only the **prefix** (first 19 chars: `vdc_sk_` + 12 random chars) is stored in plain text for fast lookup.
- The full key is **shown once at creation** — you cannot recover it. Lost keys must be revoked and replaced.
- Keys can be revoked at any time via the Vodical dashboard (**Settings → API Keys**) or by setting `revoked_at` in the database.
- Keys may have an optional `expires_at` timestamp.
- Each successful request updates `last_used_at` server-side (fire-and-forget).

### Scopes

Each API key carries one or more **scopes** that gate which endpoints it can call:

| Scope | Required by |
|---|---|
| `templates:read` | `GET  /api-v1-templates`, `GET /api-v1-templates?id={id}` |
| `templates:write` | `POST /api-v1-templates`, `PUT /api-v1-templates?id={id}`, `DELETE /api-v1-templates?id={id}` |
| `documents:write` | `POST /api-v1-generate` |
| `transcriptions:write` | `POST /api-v1-transcribe` |

A key without the required scope receives:

```json
HTTP/1.1 403 Forbidden
{ "error": "Insufficient permissions. Required scope: documents:write" }
```

> 💡 Best practice: create **dedicated keys per scope** (one for templates management, one for generation) so a compromised key has the smallest possible blast radius.

---

## Endpoints

### `GET  /api-v1-templates`

List all templates owned by the authenticated user.

**Required scope:** `templates:read`

#### Request

```http
GET /api-v1-templates HTTP/1.1
Authorization: Bearer vdc_sk_...
```

No request body.

#### Response — `200 OK`

```json
{
  "userId": "f2c1b8e3-d456-4789-aabb-ccddeeff0011",
  "templates": [
    {
      "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
      "name": "Courrier à un confrère",
      "language": "fr",
      "createdAt": "2026-05-12T09:14:33.123Z",
      "updatedAt": "2026-05-20T17:02:48.901Z"
    },
    {
      "templateId": "b562fdfe-4a0a-5680-c971-f966b75e3522",
      "name": "Compte-rendu de consultation",
      "language": "fr",
      "createdAt": "2026-04-30T11:22:00.000Z",
      "updatedAt": "2026-04-30T11:22:00.000Z"
    }
  ]
}
```

Notes:
- Only **non-archived** templates with non-empty content are returned.
- The full HTML body is **not** returned in the list; use `GET /api-v1-templates?id={id}` to fetch one template's HTML.
- Templates are sorted by `created_at DESC` (newest first).

---

### `GET  /api-v1-templates?id={id}`

Fetch a single template's full HTML body.

**Required scope:** `templates:read`

#### Request

```http
GET /api-v1-templates?id=a451ecdf-3899-4579-b860-e855a64d2411 HTTP/1.1
Authorization: Bearer vdc_sk_...
```

#### Response — `200 OK`

```json
{
  "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
  "name": "Courrier à un confrère",
  "html": "<h2>Courrier à un confrère</h2><p>Cher confrère, ...</p>",
  "language": "fr",
  "createdAt": "2026-05-12T09:14:33.123Z",
  "updatedAt": "2026-05-20T17:02:48.901Z"
}
```

#### Errors

| Status | Body | When |
|---|---|---|
| `404` | `{ "error": "Template not found" }` | Template doesn't exist or belongs to another user |

---

### `POST /api-v1-templates`

Create a new template. The HTML body is **AI-generated** server-side from your high-level inputs (this is identical to what the Vodical UI does).

**Required scope:** `templates:write`

#### Request

```http
POST /api-v1-templates HTTP/1.1
Authorization: Bearer vdc_sk_...
Content-Type: application/json
```

```json
{
  "name": "Compte-rendu de consultation",
  "profession": "Médecin généraliste",
  "language": "fr",
  "objective": "Rédiger un compte-rendu après une consultation patient",
  "audience": "Le patient et son médecin référent",
  "tone": "professional",
  "length": "medium"
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `name` | string | ✅ | — | Trimmed; must be non-empty. Becomes the template's display name. |
| `profession` | string | ❌ | `"General"` | Used to bias the AI generation toward your domain (e.g. `"Avocat"`, `"Notaire"`, `"Coach sportif"`). |
| `language` | string | ❌ | `"fr"` | `"fr"` or `"en"`. Determines the language of the generated HTML. |
| `objective` | string | ❌ | — | Free-form description of what the document should achieve. |
| `audience` | string | ❌ | — | Free-form description of who will read it. |
| `tone` | string | ❌ | — | E.g. `"professional"`, `"friendly"`, `"formal"`, `"empathic"`. |
| `length` | string | ❌ | — | E.g. `"short"`, `"medium"`, `"long"`. |

#### Response — `201 Created`

```json
{
  "templateId": "b562fdfe-4a0a-5680-c971-f966b75e3522",
  "name": "Compte-rendu de consultation",
  "html": "<h2>Compte-rendu</h2><p>Date : <span data-vodical-token=\"date\"></span></p>...",
  "source": "internal-hds-ai",
  "createdAt": "2026-06-03T13:14:33.123Z"
}
```

The returned `html` already contains:
- **Variable placeholders** wrapped in `<span data-vodical-variable="true" data-id="..." data-name="..." data-variable-type="...">[Patient]</span>`.
- **Date tokens** as `<span data-vodical-token="date"></span>` (auto-replaced with the current date at generation time).

See [Variable system in templates](#variable-system-in-templates).

#### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "name is required" }` | Empty or missing `name` |
| `500` | `{ "error": "Failed to generate template" }` | AI service unavailable |
| `500` | `{ "error": "Template generation returned empty content" }` | AI returned nothing |
| `500` | `{ "error": "Failed to save template" }` | Database error |

---

### `PUT  /api-v1-templates?id={id}`

Update an existing template — typically used to **save edits** made in a TipTap-style editor (variables, date tokens, formatting). The full new HTML body replaces the previous one; partial updates of `name` and `language` are also supported.

**Required scope:** `templates:write`

#### Request

```http
PUT /api-v1-templates?id=a451ecdf-3899-4579-b860-e855a64d2411 HTTP/1.1
Authorization: Bearer vdc_sk_...
Content-Type: application/json
```

```json
{
  "html": "<h2>Compte-rendu</h2><p>Patient : <span data-vodical-variable=\"true\" data-id=\"var_x\" data-name=\"Nom\" data-variable-type=\"person-name\">[Nom]</span></p>",
  "name": "Compte-rendu (v2)",
  "language": "fr"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `html` | string | ✅ | The full new TipTap HTML body. May contain `<span data-vodical-variable="true" …>` and `<span data-vodical-token="date" …>` nodes. |
| `name` | string | ❌ | Renames the template. Trimmed; ignored if empty. |
| `language` | string | ❌ | `"fr"` or `"en"`. |

#### Response — `200 OK`

```json
{
  "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
  "name": "Compte-rendu (v2)",
  "html": "<h2>Compte-rendu</h2><p>Patient : ...</p>",
  "language": "fr",
  "updatedAt": "2026-06-04T17:45:00.000Z"
}
```

#### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "Missing template id" }` | No `id` query parameter |
| `400` | `{ "error": "html is required" }` | Empty or missing `html` |
| `404` | `{ "error": "Template not found" }` | Template doesn't exist or belongs to another user |
| `500` | `{ "error": "Failed to update template" }` | Database error |

> 💡 The previous HTML is overwritten — **there is no built-in version history**. If you need an undo trail, snapshot the response of `GET /api-v1-templates?id={id}` before saving.

---

### `DELETE /api-v1-templates?id={id}`

Permanently delete a template.

**Required scope:** `templates:write`

#### Request

```http
DELETE /api-v1-templates?id=a451ecdf-3899-4579-b860-e855a64d2411 HTTP/1.1
Authorization: Bearer vdc_sk_...
```

#### Response — `200 OK`

```json
{ "success": true, "message": "Template deleted" }
```

#### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "Missing template id" }` | No `id` query parameter |
| `500` | `{ "error": "Failed to delete template" }` | Database error |

> ⚠️ This is a **hard delete**. Documents previously generated from this template are unaffected, but you won't be able to regenerate from it.

---

### `POST /api-v1-generate`

The **main endpoint** — runs a template against any combination of inputs and returns the generated HTML (or PDF).

**Required scope:** `documents:write`

#### Request

```http
POST /api-v1-generate HTTP/1.1
Authorization: Bearer vdc_sk_...
Content-Type: application/json
```

```json
{
  "templateId": "a451ecdf-3899-4579-b860-e855a64d2411",
  "outputFormat": "html",
  "inputs": [
    { "type": "text",     "label": "transcript", "content": "Bonjour, comment allez-vous..." },
    { "type": "audio",    "label": "rec.m4a",    "data": "<base64>" },
    { "type": "image",    "label": "scan.jpg",   "data": "<base64>", "mimeType": "image/jpeg" },
    { "type": "document", "label": "labs.pdf",   "data": "<base64>", "mimeType": "application/pdf" }
  ]
}
```

#### Top-level fields

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `templateId` | string (UUID) | ✅ | — | Must reference a template owned by the authenticated user. |
| `outputFormat` | string | ❌ | `"html"` | `"html"` (recommended) or `"pdf"` (server-side; basic, no fonts — **prefer html and convert client-side**, see [README → Step 5](./README.md#step-5--convert-html--pdf-the-pdf-lib-pipeline)). |
| `inputs` | array | ✅ (≥ 1) | — | Array of `InputItem`. See below. |

#### `InputItem` — array of inputs

You can mix any number of `text`, `audio`, `image`, `document` inputs in a single request.

```ts
type InputItem =
  | { type: 'text';     content: string;  label?: string }
  | { type: 'audio';    data: string;     label?: string }
  | { type: 'image';    data: string;     label?: string;  mimeType?: string }
  | { type: 'document'; data: string;     label?: string;  mimeType?: string };
```

| Field | Required for | Notes |
|---|---|---|
| `type` | all | One of `text`, `audio`, `image`, `document`. |
| `content` | `text` | Plain UTF-8 text. |
| `data` | `audio` / `image` / `document` | Standard base64 (no `data:` prefix). |
| `mimeType` | optional, recommended for `image`/`document` | E.g. `application/pdf`, `image/jpeg`. |
| `label` | optional | Echoed back in `sources`. Defaults to `{type}_{n}`. |

#### Behind the scenes

1. **Audio** → speech-to-text via internal HDS-hosted AI (FR by default), processed up to 5 min.
2. **Image / Document** → text via the internal `extract-text-source` function (OCR / native PDF text).
3. **Text** → used as-is.
4. All extracted texts are concatenated as `### Source 1 (audio):\n...` separated by `---`.
5. Combined text + template instructions → **internal HDS-hosted generative AI** with a strict prompt (no extrapolation).
6. AI returns HTML with `<h4>`, `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>` only.
7. Date tokens are replaced with the current localized date.

#### Legacy single-input format

```json
{ "templateId": "...", "inputType": "text",  "text":  "..." }
{ "templateId": "...", "inputType": "audio", "audio": "<base64>" }
{ "templateId": "...", "inputType": "image", "file":  "<base64>" }
```

> ⚠️ **Deprecated.** Use `inputs[]` in new integrations.

#### Response — `200 OK` (when `outputFormat: "html"`)

```json
{
  "documentId": "1425bedf-2908-4abb-88c9-885641c0ef63",
  "templateName": "Courrier à un confrère",
  "html": "<h2>Courrier à un confrère</h2>...",
  "sources": {
    "rec.m4a":   "Bonjour docteur...",
    "labs.pdf":  "Hémoglobine: 14 g/dL..."
  }
}
```

| Field | Notes |
|---|---|
| `documentId` | UUID of this generation (use it for filenames / audit logs). |
| `templateName` | Mirrors the template's `name`. |
| `html` | Generated document. Cleaned of Markdown fences. Date tokens substituted. |
| `sources` | `{ [label]: extractedText }` for each successful input. |

#### Response — `200 OK` (when `outputFormat: "pdf"`)

```http
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="document-{documentId}.pdf"
X-Document-Id: {documentId}

%PDF-1.4 ...binary...
```

> ⚠️ The server-side PDF is a **basic placeholder**. Always prefer `outputFormat: "html"` and convert client-side with the pipeline in [README → Step 5](./README.md#step-5--convert-html--pdf-the-pdf-lib-pipeline).

#### Errors

| Status | Body | When |
|---|---|---|
| `400` | `templateId is required` | Missing `templateId` |
| `400` | `At least one input is required` | Empty `inputs` |
| `400` | `Invalid input type: foo` | Bad `type` |
| `400` | `Text input requires "content" field` | Missing `content` |
| `400` | `audio input requires "data" field (base64)` | Missing `data` |
| `400` | `Template has no instructions/content` | Empty template |
| `400` | `No text could be extracted from inputs` | All extractions failed |
| `403` | `Insufficient permissions. Required scope: documents:write` | Missing scope |
| `403` | `Template belongs to a different user` | Cross-user access |
| `404` | `Template {id} does not exist` | Wrong UUID |
| `500` | `Audio transcription not configured` | STT provider not configured |
| `500` | `AI provider error: ...` | AI provider error |

> 💡 Even when generation **fails**, a row is created in `document_requests` with `status: 'FAILED'` for auditing.

---

### `POST /api-v1-transcribe`

Audio-only transcription. Returns the transcript as plain text and (optionally) as diarized speaker segments — **without** invoking the AI document generator and **without** requiring a `templateId`.

Use this when you only need a transcription, e.g. to display it to the user, copy it to the clipboard, or feed it back into `POST /api-v1-generate` as a `text` input.

**Required scope:** `transcriptions:write`

> Backwards compat: API keys minted before v1.2.0 are auto-granted the new scope by the migration, so existing keys continue to work.

#### Request

```http
POST /api-v1-transcribe HTTP/1.1
Authorization: Bearer vdc_sk_...
Content-Type: application/json
```

```json
{
  "audio": "<base64 of rec.m4a>",
  "language": "fr",
  "label": "rec.m4a",
  "speakerLabels": true
}
```

| Field | Type | Required | Default | Notes |
|---|---|---|---|---|
| `audio` | string (base64) | ✅ | — | Audio bytes encoded in standard base64 (no `data:` prefix). Any container/codec accepted by AssemblyAI works (mp3, m4a, wav, webm, ogg, flac, …). |
| `language` | string | ❌ | `"fr"` | `"fr"` or `"en"`. Passed straight to the speech-to-text engine. |
| `label` | string | ❌ | — | Human-readable label (e.g. `"rec.m4a"`). Stored on the audit row in `document_requests.metadata` — has no effect on quality. |
| `speakerLabels` | boolean | ❌ | `true` | When `true`, runs speaker diarization. The response includes a grouped `speakers[]` array. Set to `false` for monologue-style audio. |

#### Response — `200 OK`

```json
{
  "transcriptionId": "8c4b0d22-44e0-4d6f-9b71-9f0db34e4c91",
  "text": "Bonjour docteur. Bonjour, comment allez-vous ? …",
  "speakers": [
    { "speaker": "A", "text": "Bonjour docteur." },
    { "speaker": "B", "text": "Bonjour, comment allez-vous ?" }
  ],
  "language": "fr",
  "durationSeconds": 42,
  "createdAt": "2026-06-04T19:20:11.000Z"
}
```

| Field | Notes |
|---|---|
| `transcriptionId` | UUID of the audit row in `document_requests` for this transcription. Use it as a stable identifier for filenames, logs, or de-duplication. |
| `text` | Plain-text transcript (no speaker prefixes). |
| `speakers` | Array of `{ speaker, text }` segments — adjacent utterances by the same speaker are merged. Same shape as Vodical's `speakers_data` / `speaker_segments`. Empty (or omitted) when `speakerLabels` is `false` or no speakers were detected. |
| `language` | Echoes back the language code the transcription was run with. |
| `durationSeconds` | Duration of the audio in seconds (as reported by the engine). |
| `createdAt` | ISO timestamp at which the transcription completed. |

#### Quick example — `curl`

```bash
# Encode your audio file as base64 (macOS/Linux)
B64=$(base64 -i rec.m4a)

curl -X POST https://your-instance.supabase.co/functions/v1/api-v1-transcribe \
  -H "Authorization: Bearer vdc_sk_..." \
  -H "Content-Type: application/json" \
  -d "{\"audio\":\"$B64\",\"language\":\"fr\",\"label\":\"rec.m4a\",\"speakerLabels\":true}"
```

#### Quick example — JavaScript

```js
const file = document.querySelector('input[type=file]').files[0];

// Convert File -> base64 (no data: prefix)
const buf = new Uint8Array(await file.arrayBuffer());
let bin = '';
for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
const audio = btoa(bin);

const res = await fetch('https://your-instance.supabase.co/functions/v1/api-v1-transcribe', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ audio, language: 'fr', label: file.name, speakerLabels: true }),
});

if (!res.ok) throw new Error((await res.json()).error);
const { text, speakers, durationSeconds } = await res.json();
console.log(text);
```

#### Errors

| Status | Body | When |
|---|---|---|
| `400` | `{ "error": "audio is required (base64 string)" }` | Missing or empty `audio` |
| `400` | `{ "error": "language must be \"fr\" or \"en\"" }` | Bad `language` |
| `400` | `{ "error": "audio is not valid base64" }` | Decode failed |
| `400` | `{ "error": "audio is empty" }` | Decoded to 0 bytes |
| `403` | `{ "error": "Insufficient permissions. Required scope: transcriptions:write" }` | Missing scope |
| `500` | `{ "error": "Audio transcription not configured" }` | STT provider not configured server-side |
| `500` | `{ "error": "AssemblyAI upload failed: ..." }` | Upstream upload error |
| `500` | `{ "error": "Transcription error: ..." }` | Upstream transcription error |
| `500` | `{ "error": "Transcription timeout" }` | Audio too long or upstream stuck |

> 💡 Even when transcription **fails**, a row is created in `document_requests` with `status: 'FAILED'` and `metadata.kind: 'transcription-only'` for auditing.

---

## Common error responses

All errors share the same shape:

```json
{ "error": "Human-readable message" }
```

| HTTP | Meaning | Typical cause |
|---|---|---|
| `400` | Bad Request | Malformed body / missing field — fix client-side. |
| `401` | Unauthorized | Missing/invalid/expired API key. |
| `403` | Forbidden | Insufficient scope or cross-user access. |
| `404` | Not Found | Wrong ID. |
| `405` | Method Not Allowed | Wrong HTTP verb. |
| `500` | Internal Server Error | Bug, dependency outage, or quota. Retry with backoff. |

> No `429` rate-limit status today — implement exponential backoff on `5xx` to be future-proof.

---

## Variable system in templates

Templates can contain typed variable placeholders:

```html
<p>
  Cher
  <span
    data-vodical-variable="true"
    data-id="var_a427aed1"
    data-name="Nom du patient"
    data-variable-type="person-name"
    data-format="auto"
  >[Nom du patient]</span>,
</p>

<p>Date : <span data-vodical-token="date"></span></p>
```

### Recognized attributes

| Attribute | Required | Purpose |
|---|---|---|
| `data-vodical-variable="true"` | ✅ | Marks the span as a variable. |
| `data-id` | ✅ | Stable internal ID. |
| `data-name` | ✅ | Human-readable label. |
| `data-variable-type` | ✅ | `text`, `person-name`, `date`, `number`, … |
| `data-format` | ❌ | `auto`, `long`, `short`. |
| `data-name-format` | ❌ | `first-last`, `last-first`, `initials`, `auto`. |
| `data-date-format` | ❌ | `YYYY-MM-DD`, `DD/MM/YYYY`, `long`, `auto`. |
| `data-length` | ❌ | `short`, `standard`, `long`. |

### Date token

```html
<span data-vodical-token="date"></span>
```

Replaced server-side with the current localized date (`03 juin 2026` for `fr`, `June 3, 2026` for `en`).

---

## HTML output guarantees

1. **Allowed tags only**: `<h1>`–`<h6>`, `<p>`, `<ul>`, `<ol>`, `<li>`, `<strong>`, `<em>`, `<span>`, `<br>`, `<div>`, `<table>`, `<tr>`, `<td>`, `<th>`.
2. **No `<script>`, `<style>`, `<link>`, no event handlers.** Still sanitize with DOMPurify if user-controlled inputs flow into templates.
3. **Inline `font-size: Xpt`** may appear — strip before PDF rendering (the bundled pipeline already does).
4. **No `<html>` / `<head>` / `<body>` wrappers** — fragment only.
5. **UTF-8 encoded.**
6. **Date tokens already substituted.**
7. **Non-deterministic output** (AI temperature > 0) — same input ≠ byte-identical output.

---

## Limits & quotas

| Resource | Soft limit | Notes |
|---|---|---|
| Single audio file | ~25 MB encoded, ~5 min | STT provider cap. |
| Single image | ~10 MB | OCR quality drops on very large scans. |
| Single PDF | ~10 MB | |
| Total request body | ~32 MB | Supabase Edge Function limit. |
| Inputs per request | No hard cap | Beware the AI context window (~128 K tokens). |
| Generation time | Up to ~6 min | Mostly bound by audio transcription. |
| Output tokens | 4 000 (~16 KB HTML) | `max_completion_tokens` hard-coded. |

Per-user quotas (concurrent jobs, monthly generations) depend on the Vodical plan — see your billing dashboard.

---

## Versioning & stability

- Endpoints under `/api-v1-*` are **stable**. Breaking changes only ship under `/api-v2-*`, with v1 supported for ≥ 6 months after v2.
- Legacy single-input format (`inputType` + `text`/`audio`/`file`) is **deprecated** and may be removed in v2 — migrate to `inputs[]` now.
- HTML output schema (allowed tags, variable attributes, date tokens) is part of the public contract.
- The `source` field in `POST /api-v1-templates` is informational and may change as the internal AI infrastructure evolves — treat it as informational.
- The server-side PDF output (`outputFormat: "pdf"`) is **best-effort** — it is **not** part of the stable contract. Always prefer `html` + client-side rendering.

---

## See also

- [README.md](./README.md) — integration tutorials (vanilla JS, React, Vue, Angular, Svelte, Node, Python).
- [README → Step 5](./README.md#step-5--convert-html--pdf-the-pdf-lib-pipeline) — how to render the returned HTML as a clean A4 PDF client-side.
