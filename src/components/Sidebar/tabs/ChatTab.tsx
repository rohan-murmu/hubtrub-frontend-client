import { useChat } from "@/context/ChatContext";
import { useCurrentUser } from "@/context/UserContext";
import Avatar from "@/components/common/Avatar";
import "./ChatTab.css";

export default function ChatTab() {
  const { privateChats, openChatWindow, onlineUserIds } = useChat();
  const currentUser = useCurrentUser();

  const currentUserId = currentUser?.userId ?? null;
  const onlineCount = privateChats.filter((c) => onlineUserIds.includes(c.participantId)).length;

  return (
    <div className="chat-tab">
      <div className="chat-list-header">
        <div className="chat-list-header-title">
          <span className="chat-list-eyebrow">Messages</span>
          <span className="chat-list-heading">All Chats</span>
        </div>
        {privateChats.length > 0 && (
          <span className="chat-list-online-badge">
            <span className="chat-list-online-dot" /> {onlineCount} online
          </span>
        )}
      </div>

      {privateChats.length === 0 ? (
        <div className="chat-empty-state">
          <div className="chat-empty-icon-wrap">
            <i className="pi pi-comments" />
          </div>
          <p>No chats yet</p>
          <span>Click "Message" on a player to start chatting</span>
        </div>
      ) : (
        <div className="chat-list">
          {privateChats.map((chat) => {
            const lastMsg = chat.messages[chat.messages.length - 1] ?? null;
            const isOnline = onlineUserIds.includes(chat.participantId);

            let lastMsgText = "No messages yet";
            if (lastMsg) {
              lastMsgText =
                lastMsg.senderId === currentUserId
                  ? `You: ${lastMsg.content}`
                  : lastMsg.content;
            }

            return (
              <button
                key={chat.id}
                className="chat-list-item"
                onClick={() => openChatWindow(chat.id)}
              >
                <Avatar
                  name={chat.participantName}
                  avatarKey={chat.participantAvatarKey}
                  size="md"
                  online={isOnline}
                />
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
