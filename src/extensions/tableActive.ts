import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const tableActivePluginKey = new PluginKey('vodicalTableActive');

function findActiveTable(
  state: import('@tiptap/pm/state').EditorState,
): { from: number; to: number } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'table') {
      const from = $from.before(depth);
      return { from, to: from + node.nodeSize };
    }
  }
  return null;
}

export const TableActive = Extension.create({
  name: 'vodicalTableActive',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: tableActivePluginKey,
        props: {
          decorations(state) {
            const active = findActiveTable(state);
            if (!active) return DecorationSet.empty;
            return DecorationSet.create(state.doc, [
              Decoration.node(active.from, active.to, {
                class: 'table-active',
              }),
            ]);
          },
        },
      }),
    ];
  },
});

export default TableActive;