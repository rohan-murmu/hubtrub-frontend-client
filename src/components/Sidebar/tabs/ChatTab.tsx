import { useState, useRef, useEffect } from "react";
import { useChat } from "../../../context/ChatContext";
import { usePanel } from "../../../context/PanelContext";
import "./ChatTab.css";

export default function ChatTab() {
  const {
    privateChats,
    activePrivateChatId,
    setActivePrivateChatId,
    sendPrivateMessage,
    leavePrivateChat,
  } = useChat();

  const { removeItemsByTargetClient } = usePanel();

  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current client ID
  const getCurrentClientId = (): string | null => {
    try {
      const clientData = localStorage.getItem("client");
      if (clientData) {
        const client = JSON.parse(clientData);
        return client.clientId || null;
      }
    } catch {
      return null;
    }
    return null;
  };

  const currentClientId = getCurrentClientId();
  const activeChat = privateChats.find((chat) => chat.id === activePrivateChatId);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !activePrivateChatId) return;
    sendPrivateMessage(activePrivateChatId, messageInput.trim());
    setMessageInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleLeaveChat = (chatId: string) => {
    // Find the chat to get the participant ID
    const chat = privateChats.find((c) => c.id === chatId);
    if (chat) {
      // Remove related panel items so users can reconnect
      removeItemsByTargetClient(chat.participantId);
    }
    leavePrivateChat(chatId);
  };  return (
    <div className="chat-tab">
      {/* Chat tabs - horizontal scrollable list of private chats */}
      {privateChats.length > 0 && (
        <div className="chat-tabs-container">
          {privateChats.map((chat) => (
            <button
              key={chat.id}
              className={`chat-tab-button ${activePrivateChatId === chat.id ? "active" : ""}`}
              onClick={() => setActivePrivateChatId(chat.id)}
            >
              <span className="chat-tab-name">{chat.participantName}</span>
              <button
                className="chat-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleLeaveChat(chat.id);
                }}
                title="Leave chat"
              >
                ×
              </button>
            </button>
          ))}
        </div>
      )}

      {/* Chat messages area */}
      <div className="chat-messages-container">
        {!activeChat ? (
          <div className="chat-empty-state">
            <i className="pi pi-comments"></i>
            <p>No active chats</p>
            <span>Accept a chat request from the Interface tab to start chatting</span>
          </div>
        ) : (
          <div className="chat-messages">
            {activeChat.messages.length === 0 ? (
              <div className="chat-no-messages">
                <p>Start of conversation with {activeChat.participantName}</p>
              </div>
            ) : (
              activeChat.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-message ${msg.senderId === currentClientId ? "sent" : "received"}`}
                >
                  <div className="message-header">
                    <span className="message-sender">{msg.senderName}</span>
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input - only show when there's an active chat */}
      {activeChat && (
        <div className="chat-input-container">
          <input
            type="text"
            className="chat-input"
            placeholder="Type a message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button
            className="chat-send-button"
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
