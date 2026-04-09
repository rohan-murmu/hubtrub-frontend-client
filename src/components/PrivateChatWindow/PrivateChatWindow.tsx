import { useState, useRef, useEffect } from "react";
import type { PrivateChat } from "../../context/ChatContext";
import { useChat } from "../../context/ChatContext";
import "./PrivateChatWindow.css";

interface PrivateChatWindowProps {
  chat: PrivateChat;
  index: number; // 0-based, used for horizontal stacking
}

export default function PrivateChatWindow({ chat, index }: PrivateChatWindowProps) {
  const { sendPrivateMessage, closeChatWindow, onlineUserIds } = useChat();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentClientId = (() => {
    try {
      const d = localStorage.getItem("client");
      return d ? JSON.parse(d).clientId : null;
    } catch {
      return null;
    }
  })();

  const isOnline = onlineUserIds.includes(chat.participantId);
  const initial = chat.participantName?.[0]?.toUpperCase() || "?";

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
  const WINDOW_WIDTH = 280;
  const GAP = 8;
  const rightOffset = index * (WINDOW_WIDTH + GAP) + 16;

  return (
    <div
      className="pcw-window"
      style={{ right: rightOffset }}
    >
      {/* Header */}
      <div className="pcw-header">
        <div className="pcw-header-avatar">{initial}</div>
        <div className="pcw-header-info">
          <span className="pcw-header-name">{chat.participantName}</span>
          <span className={`pcw-header-status ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "online" : "offline"}
          </span>
        </div>
        <button
          className="pcw-close-btn"
          onClick={() => closeChatWindow(chat.id)}
          title="Close"
        >
          ×
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
              className={`pcw-bubble ${msg.senderId === currentClientId ? "sent" : "received"}`}
            >
              {msg.content}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="pcw-input-row">
        <input
          type="text"
          className="pcw-input"
          placeholder="Aa"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
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
