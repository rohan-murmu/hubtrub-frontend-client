import { useEffect, useRef, useState } from "react";
import { socketClient } from "@/services/socketClient";
import { useChat } from "@/context/ChatContext";
import EmojiPicker from "@/components/EmojiPicker/EmojiPicker";
import "./PublicChatOverlay.css";

interface PublicChatOverlayProps {
  senderId: string;
  senderName?: string;
}

interface PublicMessage {
  id: number;
  senderId: string;
  senderName: string;
  content: string;
}

// PublicChatOverlay anchors a chat input + fading message column to the
// bottom-left of the game canvas. Incoming chat:public messages from the
// server are appended; CSS animates them upward and fades them out over ~6s
// before the React cleanup timer removes the node.
const MESSAGE_TTL_MS = 6500; // slightly longer than the CSS fade so the DOM keeps the node alive until the animation finishes

export default function PublicChatOverlay({ senderId, senderName }: PublicChatOverlayProps) {
  const { onlineUserIds } = useChat();
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [input, setInput] = useState("");
  const nextIdRef = useRef(0);

  useEffect(() => {
    const off = socketClient.onChatPublic((msg) => {
      const p = msg.payload ?? {};
      // Some servers send keystroke or subtype-only messages on chat:public —
      // only render the ones that actually carry text.
      const content: string = String(p.content ?? "").trim();
      if (!content) return;
      const id = nextIdRef.current++;
      const item: PublicMessage = {
        id,
        senderId: String(p.senderId ?? "?"),
        senderName: String(p.senderName ?? p.senderId ?? "?"),
        content,
      };
      setMessages((prev) => [...prev, item]);
      // Drop the node once its CSS animation has fully played out.
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, MESSAGE_TTL_MS);
    });
    return () => { off(); };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || !senderId) return;
    socketClient.sendPublicChat(senderId, trimmed, senderName);
    setInput("");
  };

  // Reverse to keep newest at the bottom in display order while still using
  // CSS column-reverse for the rising animation effect.
  const display = [...messages].reverse();

  return (
    <div className="public-chat-overlay">
      <div className="public-chat-messages">
        {display.map((m) => {
          const isSenderOnline = onlineUserIds.includes(m.senderId);
          return (
            <div
              key={m.id}
              className={`public-chat-message ${isSenderOnline ? "is-online" : "is-offline"}`}
              title={isSenderOnline ? `${m.senderName} is in this world` : `${m.senderName} is not in this world`}
            >
              <span className="sender">{m.senderName}:</span>
              {m.content}
            </div>
          );
        })}
      </div>
      <form className="public-chat-input-wrap" onSubmit={handleSubmit}>
        <div className="public-chat-input-pill">
          <input
            type="text"
            className="public-chat-input"
            placeholder="Say something to the hub…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
          />
          <span className="public-chat-emoji">
            <EmojiPicker onPick={(e) => setInput((v) => (v + e).slice(0, 200))} align="right" />
          </span>
        </div>
      </form>
    </div>
  );
}
