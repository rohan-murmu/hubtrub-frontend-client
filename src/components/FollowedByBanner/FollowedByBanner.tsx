import { useState } from "react";
import type { Client } from "../../types";
import "./FollowedByBanner.css";

interface FollowedByBannerProps {
  followers: Client[];
  onStopFollower: (followerId: string) => void;
  onStopAllFollowers: () => void;
}

export default function FollowedByBanner({
  followers,
  onStopFollower,
  onStopAllFollowers,
}: FollowedByBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const count = followers.length;

  if (count === 0) return null;

  if (!expanded) {
    return (
      <div className="followed-by-pill" onClick={() => setExpanded(true)} title="Click to see followers">
        <span className="followed-by-dot" />
        <span>
          You are being followed by <strong>{count}</strong> {count === 1 ? "user" : "users"}
        </span>
      </div>
    );
  }

  return (
    <div className="followed-by-panel">
      <div className="followed-by-panel-header">
        <span>Followers ({count})</span>
        <button className="followed-by-close" onClick={() => setExpanded(false)} aria-label="Close">
          ✕
        </button>
      </div>

      <ul className="followed-by-list">
        {followers.map((follower) => (
          <li key={follower.clientId} className="followed-by-row">
            <div className="followed-by-avatar">
              {follower.clientUserName?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="followed-by-name">
              <strong>{follower.clientUserName}</strong>
            </span>
            <button
              className="followed-by-btn stop-one"
              onClick={() => onStopFollower(follower.clientId!)}
            >
              Stop Follower
            </button>
          </li>
        ))}
      </ul>

      <div className="followed-by-panel-footer">
        <button className="followed-by-btn stop-all" onClick={onStopAllFollowers}>
          Stop All Followers
        </button>
      </div>
    </div>
  );
}
