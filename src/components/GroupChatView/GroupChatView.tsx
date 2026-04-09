import { useState, useRef, useEffect, useCallback } from "react";
import { socketClient } from "../../services/socketClient";
import { userService } from "../../services/api";
import type { GroupInfo, GroupMessage, Client } from "../../types";
import "./GroupChatView.css";

interface GroupChatViewProps {
  group: GroupInfo;
  onLeaveGroup: () => void;
}

export default function GroupChatView({ group, onLeaveGroup }: GroupChatViewProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [membersMap, setMembersMap] = useState<Record<string, Client>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentClient = (() => {
    try {
      const d = localStorage.getItem("client");
      return d ? JSON.parse(d) : null;
    } catch {
      return null;
    }
  })();

  // Fetch member details
  useEffect(() => {
    group.members.forEach((memberId) => {
      if (!membersMap[memberId]) {
        userService
          .getClientById(memberId)
          .then((data) => setMembersMap((prev) => ({ ...prev, [memberId]: data })))
          .catch(() => {});
      }
    });
  }, [group.members]);

  // Listen for incoming group chat messages
  useEffect(() => {
    const unsubChat = socketClient.onChatGroup((message) => {
      const payload = (message.payload ?? message) as Record<string, any>;
      if (payload.groupId !== group.groupId) return;

      const senderId = payload.senderId as string;
      // Don't add our own messages (already added optimistically)
      if (senderId === currentClient?.clientId) return;

      const senderName = (payload.senderName ?? senderId) as string;
      const content = (payload.content ?? "") as string;

      const newMsg: GroupMessage = {
        id: `gmsg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        senderId,
        senderName,
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, newMsg]);
    });

    return unsubChat;
  }, [group.groupId, currentClient?.clientId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !currentClient?.clientId) return;

    socketClient.sendGroupMessage(currentClient.clientId, group.groupId, trimmed, currentClient.clientUserName);

    // Optimistic update
    const msg: GroupMessage = {
      id: `gmsg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      senderId: currentClient.clientId,
      senderName: currentClient.clientUserName || "You",
      content: trimmed,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, msg]);
    setInputValue("");
  }, [inputValue, currentClient, group.groupId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="group-chat-view">
      {/* Chat Panel — placed in left column by parent grid */}
      <div className="group-chat-left">
        <div className="group-chat-header">
          <h2 className="group-chat-name">{group.groupName}</h2>
        </div>

        <div className="group-chat-messages">
          {messages.length === 0 && (
            <div className="group-chat-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map((msg) => {
            const isSelf = msg.senderId === currentClient?.clientId;
            return (
              <div
                key={msg.id}
                className={`group-chat-bubble ${isSelf ? "self" : "other"}`}
              >
                {!isSelf && (
                  <span className="group-chat-sender">{msg.senderName}</span>
                )}
                <p className="group-chat-content">{msg.content}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="group-chat-input-bar">
          <input
            type="text"
            className="group-chat-input"
            placeholder="Aa"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className="group-chat-send-btn"
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            <i className="pi pi-send" />
          </button>
        </div>
      </div>

      {/* Members Panel — placed in right column, top row by parent grid */}
      <div className="group-chat-members">
        <h3 className="group-members-title">Members</h3>
        <div className="group-members-list">
          {group.members.map((memberId) => {
            const member = membersMap[memberId];
            const name = member?.clientUserName || memberId.slice(0, 8);
            const initial = name[0]?.toUpperCase() || "?";
            return (
              <div key={memberId} className="group-member-item">
                <div className="group-member-avatar">{initial}</div>
                <span className="group-member-name">{name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Leave Button — placed in right column, bottom row by parent grid */}
      <button className="group-leave-btn" onClick={onLeaveGroup}>
        Leave Group
      </button>
    </div>
  );
}
