import { useMemo, useState } from "react";
import type { RefObject } from "react";
import DOMPurify from "dompurify";
import ChatTab from "./tabs/ChatTab";
import AssetTab from "./tabs/AssetTab";
import { useCurrentUser } from "@/context/UserContext";
import Avatar from "@/components/common/Avatar";
import type { Asset } from "@/types";
import "./Sidebar.css";

interface SidebarProps {
  onLeaveHub: () => void;
  roomName?: string;
  roomDescription?: string;
  roomAdmin?: string;
  roomId?: string;
  iframeRef?: RefObject<HTMLIFrameElement | null>;
  onViewAsset?: (asset: Asset) => void;
}

type ActivePanel = "chat" | "description" | "asset" | null;

export default function Sidebar({ onLeaveHub, roomName, roomDescription, roomAdmin, roomId, iframeRef, onViewAsset }: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const user = useCurrentUser();

  // The room description is stored as rich-text HTML produced by RichTextEditor.
  // Sanitize before rendering so we drop scripts / event handlers even if the
  // backend ever returns untrusted markup.
  const descriptionHtml = useMemo(() => {
    if (!roomDescription || roomDescription.trim().length === 0) return null;
    return DOMPurify.sanitize(roomDescription, {
      ALLOWED_TAGS: ["p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote", "code", "pre", "span"],
      ALLOWED_ATTR: ["href", "target", "rel"],
    });
  }, [roomDescription]);

  const togglePanel = (panel: Exclude<ActivePanel, null>) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setProfileOpen(false);
  };

  const toggleProfile = () => {
    setProfileOpen((prev) => !prev);
    setActivePanel(null);
  };

  return (
    <div className="room-sidebar">
      {/* Profile popup */}
      {profileOpen && (
        <div className="profile-popup">
          <Avatar name={user?.username} avatarKey={user?.avatarKey} size="lg" />
          <p className="profile-popup-username">{user?.username || "Unknown"}</p>
          <span className="profile-popup-status">
            <span className="profile-popup-status-dot" /> In the world
          </span>
        </div>
      )}

      {/* Expanded side panel */}
      {activePanel && (
        <div className="sidebar-expanded-panel">
          {activePanel === "chat" && <ChatTab />}
          {activePanel === "description" && (
            <div className="description-panel">
              <h3 className="description-panel-title">Hub Info</h3>
              {roomName && <p className="description-room-name">{roomName}</p>}
              {roomAdmin && (
                <p className="description-admin">
                  <span className="description-admin-label">hosted by</span>
                  <span className="description-admin-name">{roomAdmin}</span>
                </p>
              )}
              {descriptionHtml && (
                <div className="description-body">
                  <span className="description-body-label">Description</span>
                  <div
                    className="description-body-text"
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                </div>
              )}
              {!roomName && !roomAdmin && !descriptionHtml && (
                <p className="description-empty">No description available.</p>
              )}
            </div>
          )}
          {activePanel === "asset" && roomId && iframeRef && onViewAsset && (
            <AssetTab roomId={roomId} iframeRef={iframeRef} onViewAsset={onViewAsset} />
          )}
        </div>
      )}

      {/* Narrow icon strip */}
      <div className="sidebar-strip">
        {/* Profile button */}
        <button
          className={`sidebar-icon-btn profile-btn ${profileOpen ? "active" : ""}`}
          onClick={toggleProfile}
          title={user?.username || "Profile"}
        >
          <Avatar name={user?.username} avatarKey={user?.avatarKey} size="sm" ring={profileOpen} />
        </button>

        <span className="sidebar-divider" />

        {/* Chat */}
        <button
          className={`sidebar-icon-btn ${activePanel === "chat" ? "active" : ""}`}
          onClick={() => togglePanel("chat")}
          title="Chat"
        >
          <i className="pi pi-comments" />
          <span>Chat</span>
        </button>

        {/* Asset */}
        <button
          className={`sidebar-icon-btn ${activePanel === "asset" ? "active" : ""}`}
          onClick={() => togglePanel("asset")}
          title="Asset"
        >
          <svg
            className="sidebar-icon-svg"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7.5L12 3l9 4.5v9L12 21 3 16.5v-9z" />
            <path d="M3 7.5L12 12l9-4.5" />
            <path d="M12 12v9" />
          </svg>
          <span>Asset</span>
        </button>


        {/* Description */}
        <button
          className={`sidebar-icon-btn ${activePanel === "description" ? "active" : ""}`}
          onClick={() => togglePanel("description")}
          title="Description"
        >
          <i className="pi pi-info-circle" />
          <span>Info</span>
        </button>

        <div className="sidebar-spacer" />

        {/* Leave Hub */}
        <button className="sidebar-icon-btn leave-btn" onClick={onLeaveHub} title="Leave hub">
          <i className="pi pi-sign-out" />
          <span>Leave</span>
        </button>
      </div>
    </div>
  );
}
