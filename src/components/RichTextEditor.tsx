import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import './RichTextEditor.css';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rte-content',
        'data-placeholder': placeholder ?? 'Describe your hub…',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep editor in sync if parent passes a new value (e.g., after async load).
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="rte">
      <div className="rte-toolbar">
        {/* Size / headings */}
        <button
          type="button"
          className={`rte-tool ${editor.isActive('paragraph') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Normal text"
        >
          Normal
        </button>
        <button
          type="button"
          className={`rte-tool ${editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Title"
        >
          Title
        </button>
        <button
          type="button"
          className={`rte-tool ${editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading"
        >
          Heading
        </button>

        <span className="rte-divider" />

        <button
          type="button"
          className={`rte-tool rte-tool--bold ${editor.isActive('bold') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          className={`rte-tool rte-tool--italic ${editor.isActive('italic') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          I
        </button>

        <span className="rte-divider" />

        <button
          type="button"
          className={`rte-tool ${editor.isActive('bulletList') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <i className="pi pi-list" />
        </button>
        <button
          type="button"
          className={`rte-tool ${editor.isActive('orderedList') ? 'is-active' : ''}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1.
        </button>

        <span className="rte-divider" />

        <button
          type="button"
          className={`rte-tool ${editor.isActive('link') ? 'is-active' : ''}`}
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined;
            const url = window.prompt('Link URL', prev ?? 'https://');
            if (url === null) return;
            if (url === '') editor.chain().focus().unsetLink().run();
            else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
          title="Link"
        >
          <i className="pi pi-link" />
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
