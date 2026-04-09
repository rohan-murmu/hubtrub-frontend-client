import { useChat } from "../../../context/ChatContext";
import "./ChatTab.css";

interface ChatTabProps {
  onNewGroup?: () => void;
}

export default function ChatTab({ onNewGroup }: ChatTabProps) {
  const { privateChats, openChatWindow, onlineUserIds } = useChat();

  const currentClientId = (() => {
    try {
      const d = localStorage.getItem("client");
      return d ? JSON.parse(d).clientId : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="chat-tab">
      <div className="chat-list-header">
        <span>All Chats</span>
        {onNewGroup && (
          <button className="chat-new-group-btn" onClick={onNewGroup}>
            + New Group
          </button>
        )}
      </div>

      {privateChats.length === 0 ? (
        <div className="chat-empty-state">
          <i className="pi pi-comments" />
          <p>No chats yet</p>
          <span>Click "Message" on a player to start chatting</span>
        </div>
      ) : (
        <div className="chat-list">
          {privateChats.map((chat) => {
            const lastMsg = chat.messages[chat.messages.length - 1] ?? null;
            const isOnline = onlineUserIds.includes(chat.participantId);
            const initial = chat.participantName?.[0]?.toUpperCase() || "?";

            let lastMsgText = "No messages yet";
            if (lastMsg) {
              lastMsgText =
                lastMsg.senderId === currentClientId
                  ? `You: ${lastMsg.content}`
                  : lastMsg.content;
            }

            return (
              <button
                key={chat.id}
                className="chat-list-item"
                onClick={() => openChatWindow(chat.id)}
              >
                <div className="chat-list-avatar-wrap">
                  <div className="chat-list-avatar">{initial}</div>
                  <span className={`chat-list-dot ${isOnline ? "online" : "offline"}`} />
                </div>
                <div className="chat-list-info">
                  <div className="chat-list-top">
                    <span className="chat-list-name">{chat.participantName}</span>
                    <span className={`chat-list-status ${isOnline ? "online" : "offline"}`}>
                      {isOnline ? "online" : "offline"}
                    </span>
                  </div>
                  <span className="chat-list-preview">{lastMsgText}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

