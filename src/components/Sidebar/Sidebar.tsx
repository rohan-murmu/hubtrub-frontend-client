import { useState } from "react";
import ChatTab from "./tabs/ChatTab";
import "./Sidebar.css";

interface SidebarProps {
  onLeaveHub: () => void;
  roomName?: string;
  roomAdmin?: string;
  onNewGroup?: () => void;
}

function getClient() {
  try {
    const data = localStorage.getItem("client");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export default function Sidebar({ onLeaveHub, roomName, roomAdmin, onNewGroup }: SidebarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "description" | null>(null);

  const client = getClient();

  const togglePanel = (panel: "chat" | "description") => {
    setActivePanel((prev) => (prev === panel ? null : panel));
    setProfileOpen(false);
  };

  const toggleProfile = () => {
    setProfileOpen((prev) => !prev);
    setActivePanel(null);
  };

  const initial = client?.clientUserName?.[0]?.toUpperCase() || "?";

  return (
    <div className="room-sidebar">
      {/* Profile popup */}
      {profileOpen && (
        <div className="profile-popup">
          <div className="profile-popup-avatar">{initial}</div>
          <p className="profile-popup-username">{client?.clientUserName || "Unknown"}</p>
        </div>
      )}

      {/* Expanded side panel */}
      {activePanel && (
        <div className="sidebar-expanded-panel">
          {activePanel === "chat" && <ChatTab onNewGroup={onNewGroup} />}
          {activePanel === "description" && (
            <div className="description-panel">
              <h3 className="description-panel-title">Hub Info</h3>
              {roomName && <p className="description-room-name">{roomName}</p>}
              {roomAdmin && (
                <p className="description-admin">Hosted by {roomAdmin}</p>
              )}
              {!roomName && !roomAdmin && (
                <p className="description-empty">No description available.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Narrow icon strip */}
      <div className="sidebar-strip">
        {/* Profile button */}
        <button
          className={`sidebar-icon-btn profile-btn ${profileOpen ? "active" : ""}`}
          onClick={toggleProfile}
          title={client?.clientUserName || "Profile"}
        >
          <div className="profile-avatar-mini">{initial}</div>
        </button>

        {/* Chat */}
        <button
          className={`sidebar-icon-btn ${activePanel === "chat" ? "active" : ""}`}
          onClick={() => togglePanel("chat")}
          title="Chat"
        >
          <i className="pi pi-comments" />
          <span>Chat</span>
        </button>

        {/* Description */}
        <button
          className={`sidebar-icon-btn ${activePanel === "description" ? "active" : ""}`}
          onClick={() => togglePanel("description")}
          title="Description"
        >
          <i className="pi pi-file" />
          <span>Description</span>
        </button>

        <div className="sidebar-spacer" />

        {/* Leave Hub */}
        <button className="sidebar-icon-btn leave-btn" onClick={onLeaveHub} title="Leave hub">
          <i className="pi pi-sign-out" />
          <span>Leave hub</span>
        </button>
      </div>
    </div>
  );
}
