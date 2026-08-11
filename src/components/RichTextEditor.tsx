import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold, Italic, Underline as UnderlineIcon, Link as LinkIcon, Unlink,
  List, ListOrdered, Heading2, Heading3, Quote, Minus,
  Undo, Redo,
} from "lucide-react";
import { sanitizeHtml, plainTextToHtml, isHtmlContent } from "../lib/html-sanitize";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({
  onClick, isActive, disabled, title, children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
        isActive
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-600" />;
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: RichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing..." }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "tiptap-editor-content outline-none",
        style: `min-height: ${minHeight}px; max-height: ${minHeight}px; overflow-y: auto;`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChangeRef.current(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.isDestroyed) return;
    const currentHtml = editor.getHTML();
    if (value === currentHtml) return;

    let content = value;
    if (!isHtmlContent(content)) {
      content = plainTextToHtml(content);
    }
    content = sanitizeHtml(content);
    editor.commands.setContent(content, { emitUpdate: false });
  }, [value, editor]);

  useEffect(() => () => { editor?.destroy(); }, [editor]);

  if (!editor) {
    return <div className="h-8" />;
  }

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href ?? "";
    const url = window.prompt("Enter URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const normalized = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange("link").setLink({ href: normalized }).run();
  };

  return (
    <div className="rich-text-editor rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 p-1.5 dark:border-slate-600">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          disabled={!editor.can().toggleBold()}
          title="Bold (Ctrl+B)"
        ><Bold size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          disabled={!editor.can().toggleItalic()}
          title="Italic (Ctrl+I)"
        ><Italic size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          disabled={!editor.can().toggleUnderline()}
          title="Underline (Ctrl+U)"
        ><UnderlineIcon size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="Insert/Edit Link"
        ><LinkIcon size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive("link")}
          title="Remove Link"
        ><Unlink size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        ><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        ><Heading3 size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        ><List size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Ordered List"
        ><ListOrdered size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Block Quote"
        ><Quote size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Divider"
        ><Minus size={16} /></ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        ><Undo size={16} /></ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Y)"
        ><Redo size={16} /></ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
