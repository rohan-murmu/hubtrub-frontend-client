import { useState } from "react";
import { Button } from "primereact/button";
import InterfaceTab from "./tabs/InterfaceTab";
import ChatTab from "./tabs/ChatTab";
import "./Sidebar.css";

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"interface" | "chat">("interface");

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`room-sidebar ${isCollapsed ? "collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          <button
            className={`tab-button ${activeTab === "interface" ? "active" : ""}`}
            onClick={() => setActiveTab("interface")}
          >
            <i className="pi pi-window-maximize"></i>
            Interface
          </button>
          <button
            className={`tab-button ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            <i className="pi pi-comments"></i>
            Chat
          </button>
        </div>
        <Button
          icon={isCollapsed ? "pi pi-chevron-left" : "pi pi-chevron-right"}
          onClick={toggleSidebar}
          className="p-button-rounded p-button-text collapse-button"
          title={isCollapsed ? "Expand" : "Collapse"}
        />
      </div>

      {!isCollapsed && (
        <div className="sidebar-content">
          {activeTab === "interface" && <InterfaceTab />}
          {activeTab === "chat" && <ChatTab />}
        </div>
      )}
    </div>
  );
}
