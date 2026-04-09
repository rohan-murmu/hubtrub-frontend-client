import type { Client } from "../../types";
import "./FollowingBanner.css";

interface FollowingBannerProps {
  target: Client;
  onStopFollow: () => void;
}

export default function FollowingBanner({ target, onStopFollow }: FollowingBannerProps) {
  return (
    <div className="following-banner">
      <span className="following-banner-label">
        Following <strong>{target.clientUserName}</strong>
      </span>
      <button className="following-banner-stop" onClick={onStopFollow}>
        Stop Following
      </button>
    </div>
  );
}
