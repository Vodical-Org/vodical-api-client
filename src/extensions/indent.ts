import { Extension } from '@tiptap/core';

export interface IndentOptions {
  types: string[];
  min: number;
  max: number;
  step: number;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType;
      outdent: () => ReturnType;
      setIndent: (level: number) => ReturnType;
      unsetIndent: () => ReturnType;
    };
  }
}

export const Indent = Extension.create<IndentOptions>({
  name: 'indent',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      min: 0,
      max: 26,
      step: 1,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = (element as HTMLElement).getAttribute('data-indent');
              const n = raw ? Number.parseInt(raw, 10) : 0;
              return Number.isFinite(n) ? n : 0;
            },
            renderHTML: (attributes) => {
              const level = Number(attributes.indent ?? 0);
              if (!level) return {};
              const clamped = Math.max(this.options.min, Math.min(this.options.max, level));
              return {
                'data-indent': String(clamped),
                style: `padding-left: ${clamped * 2}em;`,
              };
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {};
  },

  addCommands() {
    const clamp = (n: number) => Math.max(this.options.min, Math.min(this.options.max, n));

    const updateSelectionBlocks = (getNext: (current: number) => number) => {
      return ({ state, dispatch }: any) => {
        const { from, to } = state.selection;
        let tr = state.tr;
        let changed = false;

        state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (!this.options.types.includes(node.type.name)) return;
          const current = Number(node.attrs?.indent ?? 0) || 0;
          const next = clamp(getNext(current));
          if (next === current) return;
          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
          changed = true;
        });

        if (!changed) {
          const $from = state.selection.$from;
          for (let d = $from.depth; d > 0; d -= 1) {
            const node = $from.node(d);
            const pos = $from.before(d);
            if (!this.options.types.includes(node.type.name)) continue;
            const current = Number(node.attrs?.indent ?? 0) || 0;
            const next = clamp(getNext(current));
            if (next === current) return false;
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
            break;
          }
        }

        if (!changed) return false;
        if (dispatch) dispatch(tr);
        return true;
      };
    };

    return {
      setIndent:
        (level: number) =>
        ({ commands }) => {
          const next = clamp(level);
          return (
            commands.updateAttributes('paragraph', { indent: next }) &&
            commands.updateAttributes('heading', { indent: next })
          );
        },

      unsetIndent:
        () =>
        ({ commands }) =>
          commands.updateAttributes('paragraph', { indent: 0 }) &&
          commands.updateAttributes('heading', { indent: 0 }),

      indent: () => updateSelectionBlocks((c) => c + this.options.step),
      outdent: () => updateSelectionBlocks((c) => c - this.options.step),
    };
  },
});