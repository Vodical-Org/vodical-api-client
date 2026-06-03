import { Extension } from '@tiptap/core';

export interface LineHeightOptions {
  types: string[];
  defaultLineHeight: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
    };
  }
}

export const LineHeight = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

  addOptions() {
    return {
      types: ['paragraph', 'heading'],
      defaultLineHeight: '1.5',
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: this.options.defaultLineHeight,
            parseHTML: (element) => {
              const lh = (element as HTMLElement).style.lineHeight;
              return lh || null;
            },
            renderHTML: (attributes) => {
              const lh = attributes.lineHeight as string | null | undefined;
              if (!lh) return {};
              return { style: `line-height: ${lh}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    const updateSelectionBlocks = (getLineHeight: (current: string | null) => string | null) => {
      return ({ state, dispatch }: any) => {
        const { from, to } = state.selection;
        let tr = state.tr;
        let changed = false;
        const types = this.options.types;

        state.doc.nodesBetween(from, to, (node: any, pos: number) => {
          if (!types.includes(node.type.name)) return;
          const current = (node.attrs?.lineHeight as string | null) ?? null;
          const next = getLineHeight(current);
          if (next === current) return;
          tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: next });
          changed = true;
        });

        if (!changed) {
          const $from = state.selection.$from;
          for (let d = $from.depth; d > 0; d -= 1) {
            const node = $from.node(d);
            const pos = $from.before(d);
            if (!types.includes(node.type.name)) continue;
            const current = (node.attrs?.lineHeight as string | null) ?? null;
            const next = getLineHeight(current);
            if (next === current) return false;
            tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: next });
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
      setLineHeight: (lineHeight: string) => updateSelectionBlocks(() => lineHeight),
      unsetLineHeight: () => updateSelectionBlocks(() => null),
    };
  },
});