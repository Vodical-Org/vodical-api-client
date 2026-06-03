import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { TableActive } from '@/extensions/tableActive';
import { FontSize } from '@/extensions/fontSize';
import { LineHeight } from '@/extensions/lineHeight';
import { Indent } from '@/extensions/indent';
import { Extension } from '@tiptap/core';
import { cn } from '@/lib/utils';
import { UnifiedToolbar } from './unified-toolbar';
import DateToken from './tiptap-tokens/dateToken';

export type ToolbarVariant = 'full' | 'medium' | 'minimal' | 'none';

export interface UnifiedEditorProps {
  content: string;
  onChange?: (html: string) => void;
  editable?: boolean;
  toolbar?: ToolbarVariant;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  autoFocus?: boolean;
  fontSize?: string;
  onEditorReady?: (editor: Editor) => void;
}

function ensureHTML(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  if (/<\s*\w+[^>]*>/.test(raw)) return raw;
  let html = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return html
    .split('\n')
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('');
}

const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.indent(),
      'Shift-Tab': () => this.editor.commands.outdent(),
    };
  },
});

export function UnifiedEditor({
  content,
  onChange,
  editable,
  toolbar = 'none',
  placeholder = '',
  className,
  contentClassName,
  autoFocus = false,
  fontSize = '16px',
  onEditorReady,
}: UnifiedEditorProps) {
  const isEditable = editable ?? !!onChange;
  const showToolbar = isEditable && toolbar !== 'none';
  const contentRef = useRef(content);
  const [isFocused, setIsFocused] = useState(false);

  const initialHTML = useMemo(() => ensureHTML(content), []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      Color.configure({ types: ['textStyle'] }),
      FontSize.configure({ types: ['textStyle'] }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { class: 'text-primary underline underline-offset-2' },
      }),
      LineHeight,
      Indent,
      Table.configure({ resizable: true, HTMLAttributes: { class: 'vodical-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      TableActive,
      Placeholder.configure({ placeholder }),
      DateToken,
      TabIndent,
    ],
    content: initialHTML,
    editable: isEditable,
    autofocus: autoFocus,
    editorProps: {
      attributes: {
        class: cn(
          'w-full max-w-none focus:outline-none',
          '[&>ul]:list-disc [&>ul]:pl-6 [&>ol]:list-decimal [&>ol]:pl-6',
          '[&>p]:mb-2 [&>p]:leading-relaxed',
        ),
        style: `font-size: ${fontSize};`,
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      contentRef.current = html;
      onChange?.(html);
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  });

  useEffect(() => {
    if (!editor) return;
    const incoming = ensureHTML(content);
    if (contentRef.current === content) return;
    if (editor.getHTML() === incoming) return;
    contentRef.current = content;
    editor.commands.setContent(incoming, false);
  }, [content, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(isEditable);
  }, [isEditable, editor]);

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'flex flex-col',
        isEditable && 'border rounded-md bg-background',
        isEditable && isFocused && 'ring-1 ring-ring',
        className,
      )}
    >
      {showToolbar && (
        <div className="flex-shrink-0 relative z-20">
          <UnifiedToolbar editor={editor} variant={toolbar} />
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          isEditable && 'flex-1 min-h-0 overflow-hidden',
          isEditable && '[&_.ProseMirror]:h-full',
          isEditable && '[&_.ProseMirror]:min-h-0',
          isEditable && '[&_.ProseMirror]:overflow-y-auto',
          isEditable && '[&_.ProseMirror]:overflow-x-hidden',
          '[&_.ProseMirror]:p-4',
          '[&_.ProseMirror]:focus:outline-none',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground/50',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0',
          '[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none',
          contentClassName,
        )}
      />
    </div>
  );
}