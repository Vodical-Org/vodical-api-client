import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { emitAddVariablePanel } from './variableSelectionContext';

export const variableInsertPluginKey = new PluginKey('variableInsertPlugin');

// ── Boundary helpers ────────────────────────────────────────────────────────

const BOUNDARY_PUNCTUATION = new Set([
  '.', ',', ';', ':', '!', '?', ')', ']', '}', '"', "'", '\u00BB', '\u2026',
]);

function isWS(ch: string) {
  return ch === ' ' || ch === '\n' || ch === '\t' || ch === '\u00A0';
}

function charAt(doc: any, from: number, to: number): string {
  try {
    return doc.textBetween(from, to, '\n', '\n') || '';
  } catch {
    return '';
  }
}

/**
 * Returns the document position where the insert-variable button should appear,
 * or `null` when it should be hidden.
 */
function resolveButtonPos(state: any): number | null {
  const { selection } = state;

  // Only show on a collapsed cursor (no text selected).
  if (!selection.empty) return null;

  const pos = selection.from;
  const $pos = selection.$from;

  // Don't show inside a variable atom (would be confusing).
  if ($pos.parent.type.name === 'vodicalVariable') return null;

  // Don't show at the very start of a textblock.
  if ($pos.parentOffset === 0) return null;

  const doc = state.doc;
  const before = charAt(doc, Math.max(0, pos - 1), pos);
  const after = charAt(doc, pos, Math.min(doc.content.size, pos + 1));

  const shouldShow =
    after === '' || // end of block
    (before !== '' && isWS(before)) || // after whitespace
    (after !== '' && isWS(after)) || // before whitespace
    (before !== '' && BOUNDARY_PUNCTUATION.has(before)) || // after punctuation
    (after !== '' && BOUNDARY_PUNCTUATION.has(after)); // before punctuation

  return shouldShow ? pos : null;
}

// ── Inline SVG icons ────────────────────────────────────────────────────────

const PLUS_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
  '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

const CHEVRON_RIGHT_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
  '<polyline points="9 18 15 12 9 6"/></svg>';

// ── Extension ───────────────────────────────────────────────────────────────

/**
 * Renders a small floating "+" widget at the cursor position when it sits on a
 * word boundary. Clicking it opens the "Add variable" side panel.
 *
 * The widget lives *inside* the ProseMirror DOM, so it scrolls and clips
 * naturally with the editor content.
 */
const VariableInsertPlugin = Extension.create({
  name: 'variableInsertPlugin',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: variableInsertPluginKey,

        props: {
          decorations(state) {
            const pos = resolveButtonPos(state);
            if (pos === null) return DecorationSet.empty;

            const widget = Decoration.widget(
              pos,
              () => {
                // Zero-width wrapper so the button never pushes text around.
                const wrapper = document.createElement('span');
                wrapper.contentEditable = 'false';
                wrapper.style.cssText =
                  'display:inline-block;position:relative;width:0;height:0;' +
                  'overflow:visible;vertical-align:middle;pointer-events:none;';

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.title = 'Add a variable';
                btn.innerHTML = PLUS_SVG;
                btn.style.cssText =
                  'position:absolute;left:6px;top:0;transform:translateY(-50%);' +
                  'display:flex;align-items:center;justify-content:center;' +
                  'width:20px;height:20px;border-radius:50%;' +
                  'background:#8b5cf6;color:white;' +
                  'border:2px solid rgba(255,255,255,0.8);' +
                  'cursor:pointer;padding:0;' +
                  'box-shadow:0 1px 3px rgba(0,0,0,0.2);' +
                  'transition:all 150ms;' +
                  'pointer-events:auto;z-index:10;';

                btn.addEventListener('mouseenter', () => {
                  btn.style.background = '#7c3aed';
                  btn.style.transform = 'translateY(-50%) scale(1.1)';
                });
                btn.addEventListener('mouseleave', () => {
                  btn.style.background = '#8b5cf6';
                  btn.style.transform = 'translateY(-50%) scale(1)';
                });

                // Don't let the editor steal these events.
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                });

                btn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  const cursorPos = editor.state.selection.from;
                  const doc = editor.state.doc;
                  const textBefore = doc.textBetween(
                    Math.max(0, cursorPos - 150),
                    cursorPos,
                    '\n',
                  );
                  const textAfter = doc.textBetween(
                    cursorPos,
                    Math.min(doc.content.size, cursorPos + 150),
                    '\n',
                  );

                  // Visual cue pointing toward the side panel.
                  const arrow = document.createElement('span');
                  arrow.innerHTML = CHEVRON_RIGHT_SVG;
                  arrow.style.cssText =
                    'position:absolute;left:28px;top:0;transform:translateY(-50%);' +
                    'color:#8b5cf6;display:flex;align-items:center;' +
                    'opacity:0;transition:opacity 200ms,transform 200ms;' +
                    'pointer-events:none;';
                  wrapper.appendChild(arrow);
                  requestAnimationFrame(() => {
                    arrow.style.opacity = '1';
                    arrow.style.transform = 'translateY(-50%) translateX(4px)';
                  });
                  setTimeout(() => arrow.remove(), 800);

                  emitAddVariablePanel({
                    isOpen: true,
                    cursorPosition: cursorPos,
                    textBefore,
                    textAfter,
                  });
                });

                wrapper.appendChild(btn);
                return wrapper;
              },
              {
                side: 1,
                key: 'variable-insert-btn',
                // Keep ProseMirror from intercepting clicks on the widget.
                stopEvent: () => true,
              },
            );

            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});

export default VariableInsertPlugin;