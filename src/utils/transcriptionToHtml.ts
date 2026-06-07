/**
 * Convert transcription data (with optional speakers) into clean HTML
 * suitable for the UnifiedEditor viewer.
 *
 * Mirrors `vodical/src/utils/transcription-to-html.ts` so the rendering
 * matches the main Vodical app exactly.
 */

export interface SpeakerSegment {
  speaker: string;
  text: string;
}

/**
 * Format transcription text + speaker data into HTML paragraphs.
 *
 *   - If `speakers` is provided (and non-empty), each segment becomes its own
 *     paragraph with a colored "Intervenant X :" prefix (matching Vodical).
 *   - Otherwise, plain text is split on sentence boundaries into paragraphs.
 */
export function formatTranscriptionToHTML(
  text: string,
  speakers?: SpeakerSegment[] | null,
  speakerLabel: (s: string) => string = (s) => `Intervenant ${s}`,
): string {
  if (speakers && Array.isArray(speakers) && speakers.length > 0) {
    return speakers
      .map(
        (seg) =>
          `<p><strong style="color: hsl(var(--primary))">${speakerLabel(
            seg.speaker,
          )} :</strong> ${escapeHtml(seg.text)}</p>`,
      )
      .join('');
  }

  if (!text) return '';

  // Plain text → paragraphs split on sentence boundaries.
  const formatted = text
    .replace(/\. ([A-Z])/g, '.\n\n$1')
    .replace(/\? ([A-Z])/g, '?\n\n$1')
    .replace(/! ([A-Z])/g, '!\n\n$1');

  return formatted
    .split(/\n\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}