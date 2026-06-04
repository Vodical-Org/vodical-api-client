import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import VariableNodeView from './variableNodeView';

export type VariableFormat = 'auto' | 'short' | 'bullet' | 'paragraph';
export type VariableLength = 'short' | 'standard' | 'detailed';

/** The category of the variable — drives which config panel section is shown. */
export type VariableType = 'text' | 'person-name' | 'date';

/** How a person-name variable should be formatted when rendered. */
export type NameFormat =
  | 'auto'              // As spoken / transcribed
  | 'first-last'        // Jean DUPONT
  | 'last-first'        // DUPONT Jean
  | 'last-comma-first'  // DUPONT, Jean
  | 'first-only'        // Jean
  | 'last-only'         // DUPONT
  | 'full-upper';       // JEAN DUPONT

/** How a date variable should be formatted when rendered. */
export type DateFormat =
  | 'auto'        // Locale default
  | 'dd/mm/yyyy'  // 11/03/2026
  | 'mm/dd/yyyy'  // 03/11/2026
  | 'long'        // 11 mars 2026
  | 'short'       // 11 mars
  | 'iso'         // 2026-03-11
  | 'time';       // 14:30 (time-only)

export interface VariableAttributes {
  id: string;
  name: string;
  format: VariableFormat;
  length: VariableLength;
  instructions: string;
  variableType: VariableType;
  nameFormat: NameFormat;
  dateFormat: DateFormat;
}

/**
 * Atomic inline node representing a variable placeholder.
 * Variables are filled in by AI from a transcription/source at generation time.
 *
 * Stored in HTML as:
 *   <span data-vodical-variable="true"
 *         data-id="var_xxx"
 *         data-name="Motif de consultation"
 *         data-format="auto"
 *         data-length="standard"
 *         data-variable-type="text">[Motif de consultation]</span>
 */
const VariableNode = Node.create({
  name: 'vodicalVariable',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-id'),
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      name: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-name') || '',
        renderHTML: (attrs) => ({ 'data-name': attrs.name }),
      },
      format: {
        default: 'auto',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-format') || 'auto',
        renderHTML: (attrs) => ({ 'data-format': attrs.format }),
      },
      length: {
        default: 'standard',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-length') || 'standard',
        renderHTML: (attrs) => ({ 'data-length': attrs.length }),
      },
      instructions: {
        default: '',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-instructions') || '',
        renderHTML: (attrs) => ({ 'data-instructions': attrs.instructions || '' }),
      },
      variableType: {
        default: 'text',
        parseHTML: (el) => {
          const v = (el as HTMLElement).getAttribute('data-variable-type') || 'text';
          // Backward compat with an older "simple" alias.
          return v === 'simple' ? 'text' : v;
        },
        renderHTML: (attrs) => ({ 'data-variable-type': attrs.variableType || 'text' }),
      },
      nameFormat: {
        default: 'auto',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-name-format') || 'auto',
        renderHTML: (attrs) => ({ 'data-name-format': attrs.nameFormat || 'auto' }),
      },
      dateFormat: {
        default: 'auto',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-date-format') || 'auto',
        renderHTML: (attrs) => ({ 'data-date-format': attrs.dateFormat || 'auto' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-vodical-variable="true"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-vodical-variable': 'true',
      }),
      `[${node.attrs.name}]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariableNodeView);
  },

  addCommands() {
    return {
      insertVariable:
        (attrs: {
          name: string;
          format?: VariableFormat;
          length?: VariableLength;
          variableType?: VariableType;
          nameFormat?: NameFormat;
          dateFormat?: DateFormat;
        }) =>
        ({ chain }: any) => {
          const id = `var_${crypto.randomUUID().slice(0, 8)}`;
          return chain()
            .focus()
            .insertContent({
              type: this.name,
              attrs: {
                id,
                name: attrs.name,
                format: attrs.format ?? 'auto',
                length: attrs.length ?? 'standard',
                variableType: attrs.variableType ?? 'text',
                nameFormat: attrs.nameFormat ?? 'auto',
                dateFormat: attrs.dateFormat ?? 'auto',
              },
            })
            .run();
        },
      updateVariable:
        (id: string, attrs: Partial<VariableAttributes>) =>
        ({ tr, state, dispatch }: any) => {
          let found = false;
          state.doc.descendants((node: any, pos: number) => {
            if (node.type.name === 'vodicalVariable' && node.attrs.id === id) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
              }
              found = true;
              return false;
            }
            return undefined;
          });
          if (found && dispatch) {
            dispatch(tr);
          }
          return found;
        },
    } as any;
  },

  addKeyboardShortcuts() {
    return {
      // Backspace immediately after a variable atom deletes the whole chip.
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;

        if ($from.nodeBefore?.type.name === 'vodicalVariable') {
          return editor.commands.deleteRange({
            from: $from.pos - $from.nodeBefore.nodeSize,
            to: $from.pos,
          });
        }
        return false;
      },
      // Delete immediately before a variable atom deletes the whole chip.
      Delete: ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;

        if ($from.nodeAfter?.type.name === 'vodicalVariable') {
          return editor.commands.deleteRange({
            from: $from.pos,
            to: $from.pos + $from.nodeAfter.nodeSize,
          });
        }
        return false;
      },
    };
  },
});

export default VariableNode;