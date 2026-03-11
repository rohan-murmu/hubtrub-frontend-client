import { useState, useEffect, useCallback } from "react";
import type { Client } from "../../../types";
import { userService } from "../../../services/api";
import { listenToIframeMessages } from "../../../utils/godotBridge";
import { socketClient, MESSAGE_TYPES, CHAT_SUBTYPES } from "../../../services/socketClient";
import { usePanel } from "../../../context/PanelContext";
import { useChat } from "../../../context/ChatContext";
import PanelListItem from "../../Panel/PanelListItem";
import "./InterfaceTab.css";

export default function InterfaceTab() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    panelItems,
    addPanelItem,
    removePanelItem,
    updatePanelItem,
    getPanelItemByTargetClient,
    removeItemsByTargetClient,
  } = usePanel();

  const { createPrivateChat, setActivePrivateChatId } = useChat();

  // Get current client ID from localStorage
  const getCurrentClientId = useCallback((): string | null => {
    try {
      const clientData = localStorage.getItem("client");
      if (clientData) {
        const client = JSON.parse(clientData);
        return client.clientId || null;
      }
    } catch {
      console.error("Failed to get current client ID");
    }
    return null;
  }, []);

  // Handle object selection from Godot
  useEffect(() => {
    const cleanup = listenToIframeMessages((message: any) => {
      if (message?.type === "OBJECT_SELECTED") {
        const selectedObjectId = message.payload?.objectId;
        const objectType = message.payload?.objectType;
        console.log("👆 Object selected in Godot:", selectedObjectId, "Type:", objectType);

        if (selectedObjectId && objectType === "player") {
          fetchClientInfo(selectedObjectId);
        }
      }

      if (message?.type === "OBJECT_DESELECTED") {
        console.log("👋 Object deselected - clearing viewer");
        setSelectedClient(null);
        setError(null);
      }

      // Legacy support
      if (message?.type === "PLAYER_CLICKED") {
        const clickedClientId = message.payload?.clientId;
        if (clickedClientId) {
          fetchClientInfo(clickedClientId);
        }
      }

      if (message?.type === "PLAYER_DESELECTED") {
        setSelectedClient(null);
        setError(null);
      }
    });

    return cleanup;
  }, []);

  // Listen for private chat messages from socket
  useEffect(() => {
    console.log("🔧 Setting up chat:private listener");

    const unsubscribe = socketClient.onChatPrivate((message) => {
      console.log("📩 Received chat:private message:", message);
      const payload = JSON.parse(JSON.stringify(message));
      if (!payload) return;

      // Get current client ID fresh each time a message arrives
      const currentClientId = getCurrentClientId();

      const subType = payload.subType;
      const senderId = payload.senderId;
      const senderName = payload.senderName || senderId;


      // Only process messages meant for us. Server may use either `receiverId` or the
      // misspelled `recieverId` in different places. Accept both.
      const targetId = payload.receiverId ?? payload.recieverId;
      console.log("🎯 Checking target - received targetId:", targetId, "current client:", currentClientId);
      
      if (targetId !== currentClientId) {
        console.log("❌ Message not for us, ignoring");
        return;
      }

      console.log("✅ Message is for us, processing subType:", subType);

      switch (subType) {
        case CHAT_SUBTYPES.REQUEST:
          console.log("📨 Processing REQUEST from:", senderId);
          // Someone is requesting a private chat with us
          // Check if we already have a request from this user
          const existingRequest = getPanelItemByTargetClient(senderId, "chat_received");
          if (!existingRequest) {
            console.log("➕ Adding chat_received panel item");
            addPanelItem({
              type: "chat_received",
              targetClientId: senderId,
              targetClientName: senderName,
              status: "idle",
            });
          } else {
            console.log("ℹ️ Request from this user already exists");
          }
          break;

        case CHAT_SUBTYPES.RESPOND:
          console.log("📤 Processing RESPOND from:", senderId);
          // Response to our chat request. Server sends `status` (accepted/rejected)
          // but some payloads might use `content`. Accept both.
          const responseStatus = (payload.status ?? payload.content) as "accepted" | "rejected";
          console.log("Response status:", responseStatus);
          // Find our chat_request where targetClientId matches the responder's senderId
          const existingItem = getPanelItemByTargetClient(senderId, "chat_request");
          if (!existingItem) {
            console.log("⚠️ No existing chat_request item found for targetClientId:", senderId);
            return;
          }
          // Update the panel item with the response status using the item's ID
          console.log("✅ Found chat_request item, updating status to:", responseStatus);
          updatePanelItem(existingItem.id, {
            status: responseStatus,
          });
          
          // If accepted, create a private chat
          if (responseStatus === "accepted") {
            const chatId = createPrivateChat(senderId, senderName);
            setActivePrivateChatId(chatId);
            console.log("💬 Created private chat after acceptance:", chatId);
          }
          break;

        case CHAT_SUBTYPES.LEAVE:
          // Other user left the chat - remove all related panel items
          // This allows both users to reconnect in the future
          console.log("👋 User left private chat:", senderId);
          removeItemsByTargetClient(senderId);
          break;

        default:
          console.log("⚠️ Unknown subType:", subType);
      }
    });

    return unsubscribe;
  }, [addPanelItem, updatePanelItem, getPanelItemByTargetClient, getCurrentClientId, createPrivateChat, setActivePrivateChatId, removeItemsByTargetClient]);

  // When a player is selected, add a chat request panel item
  useEffect(() => {
    if (!selectedClient || !selectedClient.clientId) return;

    const currentClientId = getCurrentClientId();
    // Don't show chat request for self
    if (selectedClient.clientId === currentClientId) return;

    // Check if we already have a request item for this client
    const existingItem = getPanelItemByTargetClient(selectedClient.clientId, "chat_request");
    if (!existingItem) {
      addPanelItem({
        type: "chat_request",
        targetClientId: selectedClient.clientId,
        targetClientName: selectedClient.clientUserName,
        status: "idle",
      });
    }
  }, [selectedClient, addPanelItem, getPanelItemByTargetClient, getCurrentClientId]);

  const fetchClientInfo = async (clientId: string) => {
    try {
      setLoading(true);
      setError(null);
      const clientInfo = await userService.getClientById(clientId);
      setSelectedClient(clientInfo);
      console.log("✓ Client info fetched:", clientInfo);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to fetch client";
      console.error("❌ Error fetching client:", err);
      setError(errorMsg);
      setSelectedClient(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle panel item actions (request, accept, reject)
  const handlePanelAction = (itemId: string, action: "request" | "accept" | "reject") => {
    const item = panelItems.find((i) => i.id === itemId);
    if (!item) return;

    const currentClientId = getCurrentClientId();
    if (!currentClientId) {
      console.error("Current client ID not found");
      return;
    }

    // Get current client name for the message
    let currentClientName = "Unknown";
    try {
      const clientData = localStorage.getItem("client");
      if (clientData) {
        const client = JSON.parse(clientData);
        currentClientName = client.clientUserName || "Unknown";
      }
    } catch {
      // ignore
    }

    if (item.type === "chat_request" && (action === "request" || action === "accept")) {
      // Sending a private chat request
      socketClient.send({
        type: MESSAGE_TYPES.CHAT_PRIVATE,
        payload: {
          subType: CHAT_SUBTYPES.REQUEST,
          senderId: currentClientId,
          senderName: currentClientName,
          recieverId: item.targetClientId,
          content: "",
        },
      });
      // Update status to pending
      updatePanelItem(itemId, { status: action === "request" ? "pending" : "accepted" });
      console.log("📤 Sent private chat request to:", item.targetClientId);
    }

    if (item.type === "chat_received" && action === "accept") {
      // Responding to a private chat request with acceptance
      socketClient.send({
        type: MESSAGE_TYPES.CHAT_PRIVATE,
        payload: {
          subType: CHAT_SUBTYPES.RESPOND,
          senderId: currentClientId,
          senderName: currentClientName,
          recieverId: item.targetClientId,
          status: "accepted",
        },
      });
      console.log("📤 Sent private chat response (accepted) to:", item.targetClientId);
      updatePanelItem(itemId, { status: "accepted" });
      
      // Create private chat on acceptance
      const chatId = createPrivateChat(item.targetClientId, item.targetClientName);
      setActivePrivateChatId(chatId);
      console.log("💬 Created private chat:", chatId);
    }
  };

  // Handle panel item removal (close button)
  const handlePanelRemove = (itemId: string) => {
    const item = panelItems.find((i) => i.id === itemId);
    if (!item) {
      removePanelItem(itemId);
      return;
    }

    const currentClientId = getCurrentClientId();
    if (!currentClientId) {
      removePanelItem(itemId);
      return;
    }

    // Get current client name for the message
    let currentClientName = "Unknown";
    try {
      const clientData = localStorage.getItem("client");
      if (clientData) {
        const client = JSON.parse(clientData);
        currentClientName = client.clientUserName || "Unknown";
      }
    } catch {
      // ignore
    }

    // If removing a received request (via close button), send rejection
    if (item.type === "chat_received") {
      socketClient.send({
        type: MESSAGE_TYPES.CHAT_PRIVATE,
        payload: {
          subType: CHAT_SUBTYPES.RESPOND,
          senderId: currentClientId,
          senderName: currentClientName,
          recieverId: item.targetClientId,
          status: "rejected",
        },
      });
      console.log("📤 Sent private chat response (rejected) to:", item.targetClientId);
    }

    removePanelItem(itemId);
  };

  return (
    <div className="interface-tab">
      {/* Viewer Section */}
      <div className="tab-section viewer-section">
        <h3 className="section-title">Viewer</h3>
        <div className="viewer-content">
          {loading && <div className="loading-indicator">Loading...</div>}

          {error && (
            <div className="error-message">
              <i className="pi pi-exclamation-circle"></i>
              <p>{error}</p>
            </div>
          )}

          {selectedClient && !loading && !error && (
            <div className="client-viewer">
              {/* Avatar */}
              {selectedClient.clientAvatar && (
                <div className="avatar-container">
                  <img
                    src={selectedClient.clientAvatar}
                    alt={selectedClient.clientUserName}
                    className="avatar-image"
                  />
                </div>
              )}

              {/* Client Info */}
              <div className="client-info">
                <h4 className="client-username">{selectedClient.clientUserName}</h4>
                <p className="client-id">ID: {selectedClient.clientId}</p>
              </div>

              {/* Action Buttons */}
              <div className="client-actions">
                <button className="action-button">
                  <i className="pi pi-envelope"></i>
                  Message
                </button>
                <button className="action-button">
                  <i className="pi pi-heart"></i>
                  Follow
                </button>
              </div>
            </div>
          )}

          {!selectedClient && !loading && !error && (
            <div className="empty-state">
              <i className="pi pi-inbox"></i>
              <p>Click on a player in the game to view their profile</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel Section */}
      <div className="tab-section panel-section">
        <h3 className="section-title">Panel</h3>
        <div className="panel-content">
          {panelItems.length === 0 ? (
            <div className="panel-empty-state">
              <p>No active interactions</p>
            </div>
          ) : (
            <div className="panel-list">
              {panelItems.map((item) => (
                <PanelListItem
                  key={item.id}
                  item={item}
                  onAction={handlePanelAction}
                  onRemove={handlePanelRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
