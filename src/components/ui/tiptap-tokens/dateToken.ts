import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import DateTokenView from './dateTokenView';

export type DateTokenFormat = 'fr_short' | 'fr_long' | 'iso';

export const DATE_TOKEN_FORMATS: Array<{
  value: DateTokenFormat;
  labelFr: string;
  labelEn: string;
  example: (d: Date) => string;
}> = [
  {
    value: 'fr_short',
    labelFr: 'JJ/MM/AAAA',
    labelEn: 'DD/MM/YYYY',
    example: (d) => new Intl.DateTimeFormat('fr-FR').format(d),
  },
  {
    value: 'fr_long',
    labelFr: '21 février 2026',
    labelEn: 'February 21, 2026',
    example: (d) =>
      new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(d),
  },
  {
    value: 'iso',
    labelFr: '2026-02-21',
    labelEn: '2026-02-21',
    example: (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    },
  },
];

const DateToken = Node.create({
  name: 'vodicalDate',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      format: {
        default: 'fr_short',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-format') || 'fr_short',
        renderHTML: (attrs) => ({ 'data-format': attrs.format }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-vodical-token="date"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-vodical-token': 'date' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateTokenView);
  },

  addCommands() {
    return {
      insertVodicalDate:
        (attrs?: { format?: DateTokenFormat }) =>
        ({ chain }: any) => {
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: { format: attrs?.format ?? 'fr_short' },
            })
            .run();
        },
    } as any;
  },
});

export default DateToken;