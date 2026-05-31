import type { User } from "@/types";
import { useChat } from "@/context/ChatContext";
import Avatar from "@/components/common/Avatar";
import "./FollowingBanner.css";

interface FollowingBannerProps {
  target: User;
  onStopFollow: () => void;
}

export default function FollowingBanner({ target, onStopFollow }: FollowingBannerProps) {
  const { onlineUserIds } = useChat();
  const isOnline = onlineUserIds.includes(target.userId);

  return (
    <div className={`following-banner ${isOnline ? "is-online" : "is-offline"}`}>
      <Avatar name={target.username} avatarKey={target.avatarKey} size="sm" />
      <span className="following-banner-label">
        <span className="following-banner-eyebrow">
          {isOnline ? "Following user" : "User left the world"}
        </span>
        <strong className="following-banner-name">{target.username}</strong>
      </span>
      <button className="following-banner-stop" onClick={onStopFollow}>
        <i className="pi pi-times" />
      </button>
    </div>
  );
}
