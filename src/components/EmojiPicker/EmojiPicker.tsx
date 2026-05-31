import { useEffect, useRef, useState } from "react";
import "./EmojiPicker.css";

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  /** Positioning anchor relative to the trigger button. */
  align?: "left" | "right";
}

// Curated emoji set kept in-app to avoid adding a third-party picker dependency.
// Organized into rows so the UI feels like a familiar picker without paying
// the cost of shipping a full emoji index.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "🥹", "😅", "😂",
      "🤣", "😊", "🙂", "🙃", "😉", "😌", "😍", "🥰",
      "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
      "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍", "👎", "👏", "🙌", "👐", "🤝", "🙏", "💪",
      "✌️", "🤞", "🤟", "🤘", "👌", "🤌", "👈", "👉",
      "👆", "👇", "✋", "🖐️", "🖖", "👋", "🤙", "🫶",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "💔", "❣️", "💕", "💖", "💗", "💘", "💝", "💞",
    ],
  },
  {
    label: "Objects",
    emojis: [
      "🎉", "🎊", "🎁", "🎈", "✨", "🔥", "💯", "⭐",
      "🌟", "💡", "📌", "📎", "✅", "❌", "⚡", "🚀",
    ],
  },
];

export default function EmojiPicker({ onPick, align = "right" }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="emoji-picker-root" ref={rootRef}>
      <button
        type="button"
        className="emoji-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Insert emoji"
        title="Insert emoji"
      >
        <svg
          className="emoji-picker-trigger-glyph"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9.25" />
          <circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none" />
          <circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none" />
          <path d="M8.5 14.5c1 1.4 2.2 2.1 3.5 2.1s2.5-.7 3.5-2.1" />
        </svg>
      </button>
      {open && (
        <div
          className={`emoji-picker-panel emoji-picker-panel-${align}`}
          role="dialog"
          aria-label="Emoji picker"
        >
          {EMOJI_GROUPS.map((g) => (
            <div key={g.label} className="emoji-picker-group">
              <div className="emoji-picker-group-label">{g.label}</div>
              <div className="emoji-picker-grid">
                {g.emojis.map((e) => (
                  <button
                    type="button"
                    key={e}
                    className="emoji-picker-cell"
                    onClick={() => onPick(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
