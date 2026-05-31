import { useState, useRef, useEffect } from "react";
import type { PrivateChat } from "@/context/ChatContext";
import { useChat } from "@/context/ChatContext";
import { useCurrentUser } from "@/context/UserContext";
import Avatar from "@/components/common/Avatar";
import EmojiPicker from "@/components/EmojiPicker/EmojiPicker";
import "./PrivateChatWindow.css";

interface PrivateChatWindowProps {
  chat: PrivateChat;
  index: number; // 0-based, used for horizontal stacking
}

export default function PrivateChatWindow({ chat, index }: PrivateChatWindowProps) {
  const { sendPrivateMessage, closeChatWindow, onlineUserIds, loadPrivateHistory } = useChat();
  const currentUser = useCurrentUser();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Lazy-load DB-stored history the first time this window mounts for a chat.
  // ChatContext stamps historyLoaded=true after a successful fetch so reopening
  // the window doesn't re-pull.
  useEffect(() => {
    if (!chat.historyLoaded) {
      loadPrivateHistory(chat.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  const currentUserId = currentUser?.userId ?? null;
  const isOnline = onlineUserIds.includes(chat.participantId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendPrivateMessage(chat.id, input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Stack windows: right offset increases per index
  const WINDOW_WIDTH = 300;
  const GAP = 10;
  const rightOffset = index * (WINDOW_WIDTH + GAP) + 20;

  return (
    <div
      className="pcw-window"
      style={{ right: rightOffset }}
    >
      {/* Header */}
      <div className="pcw-header">
        <Avatar name={chat.participantName} avatarKey={chat.participantAvatarKey} size="sm" />
        <div className="pcw-header-info">
          <span className="pcw-header-name">{chat.participantName}</span>
          <span className={`pcw-header-status ${isOnline ? "online" : "offline"}`}>
            <span className="pcw-header-status-dot" />
            {isOnline ? "In the world" : "Off the world"}
          </span>
        </div>
        <button
          className="pcw-close-btn"
          onClick={() => closeChatWindow(chat.id)}
          title="Close"
        >
          <i className="pi pi-times" />
        </button>
      </div>

      {/* Messages */}
      <div className="pcw-messages">
        {chat.messages.length === 0 ? (
          <div className="pcw-no-messages">Say hi to {chat.participantName}!</div>
        ) : (
          chat.messages.map((msg) => (
            <div
              key={msg.id}
              className={`pcw-bubble ${msg.senderId === currentUserId ? "sent" : "received"}`}
            >
              {msg.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pcw-input-row">
        <div className="pcw-input-pill">
          <input
            type="text"
            className="pcw-input"
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="pcw-input-emoji">
            <EmojiPicker onPick={(e) => setInput((v) => v + e)} align="right" />
          </span>
        </div>
        <button
          className="pcw-send-btn"
          onClick={handleSend}
          disabled={!input.trim()}
          title="Send"
        >
          <i className="pi pi-send" />
        </button>
      </div>
    </div>
  );
}
