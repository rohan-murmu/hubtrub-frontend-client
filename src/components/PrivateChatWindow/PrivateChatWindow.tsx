import { useState, useRef, useLayoutEffect } from "react";
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
  const { sendPrivateMessage, closeChatWindow, onlineUserIds, loadOlderMessages } = useChat();
  const currentUser = useCurrentUser();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // When set, the next messages render is a history prepend — restore the
  // scroll position instead of jumping to the bottom. Captured just before the
  // fetch so we can offset scrollTop by the height the new page added.
  const pendingRestoreRef = useRef<{ prevHeight: number; prevTop: number } | null>(null);
  const prevLenRef = useRef(0);

  const currentUserId = currentUser?.userId ?? null;
  const isOnline = onlineUserIds.includes(chat.participantId);
  // No history is loaded on open; show the button until we learn there's
  // nothing older left (hasMoreHistory === false).
  const canLoadMore = chat.hasMoreHistory !== false;

  // Keep the viewport sensible as messages change: after a history prepend
  // (list grew while a restore was pending) hold the user's position; for new
  // or sent messages stick to the bottom. A pending restore that didn't grow
  // the list (empty page / error) is just cleared without moving.
  useLayoutEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const restore = pendingRestoreRef.current;
    pendingRestoreRef.current = null;
    if (restore && chat.messages.length > prevLenRef.current) {
      el.scrollTop = el.scrollHeight - restore.prevHeight + restore.prevTop;
    } else if (!restore) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLenRef.current = chat.messages.length;
  }, [chat.messages]);

  const handleLoadOlder = () => {
    const el = messagesContainerRef.current;
    pendingRestoreRef.current = {
      prevHeight: el?.scrollHeight ?? 0,
      prevTop: el?.scrollTop ?? 0,
    };
    loadOlderMessages(chat.id);
  };

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
      <div className="pcw-messages" ref={messagesContainerRef}>
        {/* Previous messages are pulled a page at a time — nothing loads on
            open. The button stays at the top so scrolling up reveals it again
            to fetch the next older page. */}
        {canLoadMore && (
          <button
            className="pcw-load-older"
            onClick={handleLoadOlder}
            disabled={chat.historyLoading}
          >
            {chat.historyLoading ? (
              <>
                <i className="pi pi-spin pi-spinner" /> Loading…
              </>
            ) : (
              "Load previous chats"
            )}
          </button>
        )}
        {chat.messages.length === 0 && !canLoadMore ? (
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
