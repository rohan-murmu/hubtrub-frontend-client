import { useState } from "react";
import type { User } from "@/types";
import { useChat } from "@/context/ChatContext";
import Avatar from "@/components/common/Avatar";
import "./FollowedByBanner.css";

interface FollowedByBannerProps {
  followers: User[];
  onStopFollower: (followerId: string) => void;
  onStopAllFollowers: () => void;
}

export default function FollowedByBanner({
  followers,
  onStopFollower,
  onStopAllFollowers,
}: FollowedByBannerProps) {
  const { onlineUserIds } = useChat();
  const [expanded, setExpanded] = useState(false);
  const count = followers.length;

  if (count === 0) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        className="followed-by-pill"
        onClick={() => setExpanded(true)}
        title="Click to see followers"
      >
        <span className="followed-by-pill-icon">
          <i className="pi pi-eye" />
        </span>
        <span className="followed-by-pill-text">
          <strong>{count}</strong> {count === 1 ? "follower" : "followers"} watching
        </span>
      </button>
    );
  }

  return (
    <div className="followed-by-panel">
      <div className="followed-by-panel-header">
        <div className="followed-by-panel-title">
          <span className="followed-by-panel-eyebrow">Watching you</span>
          <span className="followed-by-panel-count">{count} {count === 1 ? "follower" : "followers"}</span>
        </div>
        <button
          className="followed-by-close"
          onClick={() => setExpanded(false)}
          aria-label="Close"
        >
          <i className="pi pi-times" />
        </button>
      </div>

      <ul className="followed-by-list">
        {followers.map((follower) => {
          const isOnline = onlineUserIds.includes(follower.userId);
          return (
            <li key={follower.userId} className={`followed-by-row ${isOnline ? "is-online" : "is-offline"}`}>
              <Avatar name={follower.username} avatarKey={follower.avatarKey} size="sm" />
              <span className="followed-by-name">
                {follower.username}
              </span>
              <button
                className="followed-by-btn stop-one"
                onClick={() => onStopFollower(follower.userId)}
                title="Stop this follower"
              >
                <i className="pi pi-times" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="followed-by-panel-footer">
        <button className="followed-by-btn stop-all" onClick={onStopAllFollowers}>
          Stop all followers
        </button>
      </div>
    </div>
  );
}
