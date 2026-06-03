/**
 * Système de rendu unifié basé sur le format TipTap.
 * Source de vérité pour les styles : `src/utils/tiptapStyleTokens.ts`.
 */

import DOMPurify from 'dompurify';
import { ALLOWED_TAGS, ALLOWED_ATTR, inlineStyleFor } from './tiptapStyleTokens';

/**
 * Sanitize le HTML TipTap (sécurité XSS).
 * Whitelist identique côté Deno (edge function email).
 */
export function sanitizeTipTapHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: [...ALLOWED_ATTR],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
  });
}

/**
 * Applique récursivement les styles inline (depuis les tokens unifiés)
 * sur les enfants d'un conteneur. Préserve les styles existants sur
 * `span` et `mark` (couleurs/tailles personnalisées de l'utilisateur).
 */
function applyTokenStyles(element: Element): void {
  const tag = element.tagName.toLowerCase();
  const baseStyle = inlineStyleFor(tag);

  if (baseStyle !== null) {
    // Préserver les styles existants (text-align, padding-left d'indentation, …)
    // en les concaténant APRÈS le baseStyle pour qu'ils l'emportent.
    const existing = element.getAttribute('style')?.trim() ?? '';
    const merged = existing
      ? `${baseStyle.replace(/;?\s*$/, ';')} ${existing.replace(/;?\s*$/, ';')}`
      : baseStyle;
    element.setAttribute('style', merged);
  }
  // Sinon (span / mark / autres) : on laisse `style` tel quel.


  // Cas particulier : <li> contenant un <p> — on aplatit pour éviter
  // les doubles espaces dans les exports.
  if (tag === 'li') {
    const p = element.querySelector('p');
    if (p) element.innerHTML = p.innerHTML;
  }

  Array.from(element.children).forEach((child) => applyTokenStyles(child));
}

/**
 * Affichage web : HTML TipTap dans le wrapper Tailwind `prose prose-sm`.
 * (Utilisé uniquement par les rares appels legacy — la majorité passe par
 * `SummaryRenderer`.)
 */
export function renderTipTapForWeb(html: string): string {
  const sanitized = sanitizeTipTapHTML(html);
  return `<div class="prose prose-sm w-full max-w-none text-sm [&>ul]:ml-0 [&>ol]:ml-0 [&>ul]:mb-2 [&>ol]:mb-2 [&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6 [&>ul>li]:marker:text-black [&>ol>li]:marker:text-black [&>ul>li]:pl-2 [&>ol>li]:pl-2 [&>p]:mb-2 [&>p]:leading-normal" style="font-size: 12px;">${sanitized}</div>`;
}

/**
 * Copie presse-papier (fallback texte brut) : extrait le texte
 * en préservant la structure paragraphes/titres/listes.
 */
export function renderTipTapToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = sanitizeTipTapHTML(html);

  const lines: string[] = [];

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) lines.push(text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'p') {
      const text = element.textContent?.trim();
      if (text) lines.push(text);
      lines.push('');
      return;
    }

    if (/^h[1-6]$/.test(tagName)) {
      const text = element.textContent?.trim();
      if (text) {
        lines.push(text);
        lines.push('');
      }
      return;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const items = element.querySelectorAll('li');
      items.forEach((li, index) => {
        const bullet = tagName === 'ol' ? `${index + 1}.` : '•';
        const text = li.textContent?.trim();
        if (text) lines.push(`${bullet} ${text}`);
      });
      lines.push('');
      return;
    }

    if (tagName === 'table') {
      const rows = element.querySelectorAll('tr');
      rows.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('th,td')).map(
          (c) => (c.textContent ?? '').trim().replace(/\s+/g, ' '),
        );
        if (cells.length) lines.push(cells.join(' | '));
      });
      lines.push('');
      return;
    }

    Array.from(element.childNodes).forEach(processNode);
  }

  Array.from(div.childNodes).forEach(processNode);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Applique les tokens unifiés à un HTML TipTap sanitizé.
 * Utilisé par `copyFormattedText` (clipboard text/html) pour produire
 * un rendu identique au web dans les apps externes (Mail, EMR, Word…).
 */
export function renderTipTapWithUnifiedStyles(html: string): string {
  const sanitized = sanitizeTipTapHTML(html);
  const div = document.createElement('div');
  div.innerHTML = sanitized;
  Array.from(div.children).forEach((child) => applyTokenStyles(child));
  return div.innerHTML;
}
