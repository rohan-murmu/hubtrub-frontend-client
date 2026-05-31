import type { User } from "@/types";
import { useChat } from "@/context/ChatContext";
import Avatar from "@/components/common/Avatar";
import "./PlayerCard.css";

interface PlayerCardProps {
  user: User;
  onFollow?: (user: User) => void;
  onClose: () => void;
}

export default function PlayerCard({ user, onFollow, onClose }: PlayerCardProps) {
  const { createPrivateChat, openChatWindow, onlineUserIds } = useChat();
  const isOnline = onlineUserIds.includes(user.userId);

  const handleMessage = () => {
    if (!user.userId) return;
    const chatId = createPrivateChat(
      user.userId,
      user.username ?? user.userId,
      user.avatarKey,
    );
    openChatWindow(chatId);
  };

  return (
    <div className="player-card">
      <button className="player-card-close" onClick={onClose} aria-label="Close">
        <i className="pi pi-times" />
      </button>

      <div className="player-card-avatar-wrap">
        <Avatar name={user.username} avatarKey={user.avatarKey} size="xl" />
      </div>

      <div className="player-card-identity">
        <p className="player-card-username">
          {user.username}
        </p>
        <span className={`player-card-status ${isOnline ? "is-online" : "is-offline"}`}>
          <span className="player-card-status-dot" />
          {isOnline ? "In the world" : "Off the world"}
        </span>
      </div>

      <div className="player-card-actions">
        <button
          className="player-card-btn player-card-btn-primary"
          onClick={handleMessage}
        >
          <i className="pi pi-send" /> Message
        </button>
        <button
          className="player-card-btn player-card-btn-ghost"
          onClick={() => onFollow?.(user)}
          aria-label="Follow"
          title={isOnline ? "Follow" : "User is not in this world"}
          disabled={!isOnline}
        >
          <i className="pi pi-user-plus" />
        </button>
      </div>
    </div>
  );
}
