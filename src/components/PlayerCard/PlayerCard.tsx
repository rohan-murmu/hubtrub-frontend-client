import type { User } from "@/types";
import { useChat } from "@/context/ChatContext";
import Avatar from "@/components/common/Avatar";
import "./PlayerCard.css";

interface PlayerCardProps {
  user: User | null;
  onFollow?: (user: User) => void;
  onClose: () => void;
}

export default function PlayerCard({ user, onFollow, onClose }: PlayerCardProps) {
  const { createPrivateChat, openChatWindow, onlineUserIds } = useChat();

  // While the user details are still loading, render a skeleton shell that
  // matches the loaded card's footprint (tall on desktop, compact chip on
  // mobile) so the layout doesn't jump when data arrives.
  if (!user) {
    return (
      <div className="player-card">
        <button className="player-card-close" onClick={onClose} aria-label="Close">
          <i className="pi pi-times" />
        </button>

        <div className="player-card-avatar-wrap">
          <div className="player-card-skeleton player-card-skeleton-avatar" />
        </div>

        <div className="player-card-identity">
          <div className="player-card-skeleton player-card-skeleton-name" />
          <div className="player-card-skeleton player-card-skeleton-status" />
        </div>

        <div className="player-card-actions">
          <div className="player-card-skeleton player-card-skeleton-btn player-card-skeleton-btn-primary" />
          <div className="player-card-skeleton player-card-skeleton-btn player-card-skeleton-btn-ghost" />
        </div>
      </div>
    );
  }

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
          aria-label="Message"
        >
          <i className="pi pi-send" /> <span className="player-card-btn-label">Message</span>
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
