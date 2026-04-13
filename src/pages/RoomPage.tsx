import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import type { Room, Client, GroupInfo } from "../types";
import { roomService, userService } from "../services/api";
import { sendMessageToIframe, cleanupGodotSession, listenToIframeMessages } from "../utils/godotBridge";
import { socketClient } from "../services/socketClient";
import { ChatProvider, useChat } from "../context/ChatContext";
import Sidebar from "../components/Sidebar/Sidebar";
import PlayerCard from "../components/PlayerCard/PlayerCard";
import PrivateChatWindow from "../components/PrivateChatWindow/PrivateChatWindow";
import FollowingBanner from "../components/FollowingBanner/FollowingBanner";
import FollowedByBanner from "../components/FollowedByBanner/FollowedByBanner";
import CreateGroupModal from "../components/CreateGroupModal/CreateGroupModal";
import GroupChatView from "../components/GroupChatView/GroupChatView";
import GroupCard from "../components/GroupCard/GroupCard";
import "./RoomPage.css";

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080';

/** Renders floating private chat windows inside ChatProvider */
function ChatWindowsLayer() {
  const { openChatWindowIds, privateChats } = useChat();
  return (
    <>
      {openChatWindowIds.map((chatId, index) => {
        const chat = privateChats.find((c) => c.id === chatId);
        if (!chat) return null;
        return (
          <PrivateChatWindow key={chatId} chat={chat} index={index} />
        );
      })}
    </>
  );
}

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const socketConnectedRef = useRef(false);
  const clientRef = useRef<Client | null>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  clientRef.current = client;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [godotConfigSent, setGodotConfigSent] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Client | null>(null);
  const [followingPlayer, setFollowingPlayer] = useState<Client | null>(null);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followersMap, setFollowersMap] = useState<Record<string, Client>>({});

  // Group state
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [activeGroup, setActiveGroup] = useState<GroupInfo | null>(null);
  const [selectedGroupCard, setSelectedGroupCard] = useState<GroupInfo | null>(null);

  // Synchronously null the iframe on unmount (runs before React removes it from DOM,
  // so the ref is still valid and the Godot WebSocket gets a proper close frame).
  useLayoutEffect(() => {
    return () => {
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
      }
    };
  }, []);

  // Handle browser tab close / page refresh — send leave and kill connections
  useEffect(() => {
    const handleLeave = () => {
      if (clientRef.current?.clientId && socketClient.isConnected()) {
        socketClient.send({
          type: "player:leave",
          payload: { pid: clientRef.current.clientId },
        });
      }
      if (iframeRef.current) {
        iframeRef.current.src = "about:blank";
      }
      socketClient.disconnect();
    };

    window.addEventListener("beforeunload", handleLeave);
    window.addEventListener("pagehide", handleLeave);

    return () => {
      window.removeEventListener("beforeunload", handleLeave);
      window.removeEventListener("pagehide", handleLeave);
    };
  }, []);

  // Fetch room data and client info
  useEffect(() => {
    const initializeRoom = async () => {
      try {
        if (!roomId) {
          setError("Room ID not provided");
          setLoading(false);
          return;
        }

        // Fetch room data
        const roomData = await roomService.getRoomById(roomId);
        setRoom(roomData);

        // Get client data from localStorage
        const clientData = localStorage.getItem("client");
        if (clientData) {
          const parsedClient = JSON.parse(clientData);
          setClient(parsedClient);
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch room data:", err);
        setError("Failed to load room");
        setLoading(false);
      }
    };

    initializeRoom();
  }, [roomId]);

  useEffect(() => {
  const cleanup = listenToIframeMessages((message) => {
    console.log("📥 RoomPage received message from iframe:", message);
    
    if (message?.type === "GODOT_READY") {
      console.log("🎮 Godot is ready!");

      if (iframeRef.current) {
        sendMessageToIframe(
          iframeRef.current,
          "SET_CONNECTION_CONFIG",
          {
            wsUrl: WS_URL,
            roomId: roomId,
            clientId: client?.clientId,
            worldKey: room?.roomScene,
            playerKey: client?.clientAvatar,
          }
        );
        console.log("✅ Godot config sent, marking as ready for React socket connection");
        setGodotConfigSent(true);
      }
    }
    
    if (message?.type === "PLAYER_CLICKED") {
      const clickedClientId = message.payload?.clientId;
      console.log("👆 RoomPage received PLAYER_CLICKED:", clickedClientId);
      if (clickedClientId) {
        userService.getClientById(clickedClientId)
          .then((data) => setSelectedPlayer(data))
          .catch((err) => console.error("Failed to fetch clicked player:", err));
      }
    }

    if (message?.type === "OBJECT_SELECTED" && message.payload?.objectType === "player") {
      const objectId = message.payload?.objectId;
      if (objectId) {
        userService.getClientById(objectId)
          .then((data) => setSelectedPlayer(data))
          .catch((err) => console.error("Failed to fetch selected player:", err));
      }
    }

    if (message?.type === "PLAYER_DESELECTED" || message?.type === "OBJECT_DESELECTED") {
      setSelectedPlayer(null);
      setSelectedGroupCard(null);
    }

    // Group dialog clicked in game — show join card
    if (message?.type === "GROUP_DIALOG_CLICKED") {
      const groupData = message.payload;
      if (groupData) {
        setSelectedGroupCard({
          groupId: groupData.groupId,
          groupName: groupData.groupName,
          members: groupData.members || [],
          x: groupData.x || 0,
          y: groupData.y || 0,
        });
      }
    }

    if (message?.type === "GROUP_DIALOG_DESELECTED") {
      setSelectedGroupCard(null);
    }
  });

  return cleanup;
}, [room, client, roomId]);

  // Connect React to WebSocket server and setup listeners
  useEffect(() => {
    if (!client || !roomId || socketConnectedRef.current || !godotConfigSent) {
      return;
    }

    let unsubscribePlayerJoin: (() => void) | undefined;
    let unsubscribePlayerLeave: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    const connectToSocket = async () => {
      try {
        console.log("🔗 Attempting React WebSocket connection...");
        await socketClient.connect(roomId, client.clientId || "");
        socketConnectedRef.current = true;
        console.log("✅ React WebSocket connected successfully");

        // Setup message listeners
        unsubscribePlayerJoin = socketClient.onPlayerJoin((message) => {
          console.log("👤 Player joined:", message.payload?.pid);
        });

        unsubscribePlayerLeave = socketClient.onPlayerLeave((message) => {
          console.log("👋 Player left:", message.payload?.pid);
        });

        unsubscribeError = socketClient.onError((message) => {
          console.error("⚠️ Server error:", message.payload?.message);
        });

        // Listen for follower updates sent to the local player by the server
        socketClient.onFollowerUpdate((message) => {
          const ids: string[] = message.payload?.followers ?? [];
          setFollowerIds(ids);
          // Fetch client details for any IDs we haven't resolved yet
          ids.forEach((id) => {
            setFollowersMap((prev) => {
              if (prev[id]) return prev;
              userService.getClientById(id)
                .then((data) => setFollowersMap((m) => ({ ...m, [id]: data })))
                .catch(() => {});
              return prev;
            });
          });
        });

        // Listen for server-initiated stop: the followed player removed this player as a follower
        socketClient.onStopFollowing(() => {
          if (iframeRef.current) {
            sendMessageToIframe(iframeRef.current, "STOP_FOLLOW", {});
          }
          setFollowingPlayer(null);
        });

        // ─── Group lifecycle listeners ────────────────────────────
        socketClient.onGroupCreate((message) => {
          const payload = (message.payload ?? message) as Record<string, any>;
          const group: GroupInfo = {
            groupId: payload.groupId,
            groupName: payload.groupName,
            members: [payload.creatorId],
            creatorId: payload.creatorId,
            x: payload.x ?? 0,
            y: payload.y ?? 0,
          };
          setActiveGroup(group);
          // Notify game to freeze player
          if (iframeRef.current) {
            sendMessageToIframe(iframeRef.current, "GROUP_JOINED", {
              groupId: group.groupId,
              x: group.x,
              y: group.y,
            });
          }
        });

        socketClient.onGroupJoin((message) => {
          const payload = (message.payload ?? message) as Record<string, any>;
          // The joining player gets this - set them into group mode
          // The group:update with members list follows right after
          if (payload.clientId === client?.clientId) {
            // We'll set the full group info from the group:update that follows
          }
        });

        socketClient.onGroupUpdate((message) => {
          const payload = (message.payload ?? message) as Record<string, any>;
          const groupInfo: GroupInfo = {
            groupId: payload.groupId,
            groupName: payload.groupName,
            members: payload.members ?? [],
            x: payload.x ?? 0,
            y: payload.y ?? 0,
          };
          // If we're a member of this group, update our group view
          if (groupInfo.members.includes(client?.clientId ?? "")) {
            setActiveGroup(groupInfo);
            // Notify game to freeze player and position within radius
            if (iframeRef.current) {
              sendMessageToIframe(iframeRef.current, "GROUP_JOINED", {
                groupId: groupInfo.groupId,
                x: groupInfo.x,
                y: groupInfo.y,
              });
            }
          }
          setSelectedGroupCard(null);
        });

        socketClient.onGroupLeave((message) => {
          const payload = (message.payload ?? message) as Record<string, any>;
          if (payload.clientId === client?.clientId) {
            setActiveGroup(null);
            // Notify game to unfreeze player
            if (iframeRef.current) {
              sendMessageToIframe(iframeRef.current, "GROUP_LEFT", {});
            }
          }
        });

        socketClient.onGroupDelete(() => {
          // If we were in the deleted group, exit group view
          setActiveGroup(null);
          if (iframeRef.current) {
            sendMessageToIframe(iframeRef.current, "GROUP_LEFT", {});
          }
        });
      } catch (err) {
        console.error("❌ React WebSocket connection failed:", err);
        const errorMsg = err instanceof Error ? err.message : "WebSocket connection failed";
        if (errorMsg !== "Connection already in progress") {
          setError(`Connection error: ${errorMsg}`);
        }
      }
    };

    connectToSocket();

    // Cleanup on unmount (e.g. browser back button) - emit leave and kill connections
    return () => {
      if (client?.clientId && socketClient.isConnected()) {
        socketClient.send({
          type: "player:leave",
          payload: {
            pid: client.clientId,
          },
        });
        console.log("👋 Sent player leave message on unmount for:", client.clientId);
      }
      if (unsubscribePlayerJoin) unsubscribePlayerJoin();
      if (unsubscribePlayerLeave) unsubscribePlayerLeave();
      if (unsubscribeError) unsubscribeError();
      socketConnectedRef.current = false;
      socketClient.disconnect();
      cleanupGodotSession();
    };
  }, [client, roomId, godotConfigSent]);

  const handleFollow = (target: Client) => {
    if (!target.clientId || !iframeRef.current) return;
    sendMessageToIframe(iframeRef.current, "FOLLOW_PLAYER", { clientId: target.clientId });
    setFollowingPlayer(target);
    if (client?.clientId) {
      socketClient.sendFollow(client.clientId, target.clientId);
    }
  };

  const handleStopFollow = () => {
    if (iframeRef.current) {
      sendMessageToIframe(iframeRef.current, "STOP_FOLLOW", {});
    }
    if (client?.clientId && followingPlayer?.clientId) {
      socketClient.sendUnfollow(client.clientId, followingPlayer.clientId);
    }
    setFollowingPlayer(null);
  };

  const handleStopFollower = (followerId: string) => {
    if (!client?.clientId) return;
    socketClient.sendUnfollow(followerId, client.clientId);
  };

  const handleStopAllFollowers = () => {
    if (!client?.clientId) return;
    socketClient.sendStopAllFollowers(client.clientId);
  };

  // ─── Group Handlers ───────────────────────────────────────────────
  const handleCreateGroup = (groupName: string) => {
    if (!client?.clientId) return;
    socketClient.sendGroupCreate(client.clientId, groupName);
    setShowCreateGroupModal(false);
  };

  const handleJoinGroup = (groupId: string) => {
    if (!client?.clientId) return;
    socketClient.sendGroupJoin(client.clientId, groupId);
    setSelectedGroupCard(null);
  };

  const handleLeaveGroup = () => {
    if (!client?.clientId || !activeGroup) return;
    socketClient.sendGroupLeave(client.clientId, activeGroup.groupId);
    setActiveGroup(null);
    if (iframeRef.current) {
      sendMessageToIframe(iframeRef.current, "GROUP_LEFT", {});
    }
  };

  const handleGoBack = () => {
    // Emit player leave message before navigating
    if (client?.clientId && socketClient.isConnected()) {
      socketClient.send({
        type: "player:leave",
        payload: {
          pid: client.clientId,
        },
      });
      console.log("👋 Sent player leave message for:", client.clientId);
    }

    // Force-close the Godot game WebSocket before navigating away
    if (iframeRef.current) {
      iframeRef.current.src = "about:blank";
    }

    // Disconnect socket and navigate
    setGodotConfigSent(false);
    socketClient.disconnect();
    navigate("/hub");
  };

  if (loading) {
    return (
      <div className="room-page-loading">
        <div className="loading-spinner">
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="room-page-error">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <Button
            label="Go Back"
            onClick={handleGoBack}
            className="p-button-primary"
          />
        </div>
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className={`room-page ${activeGroup ? 'room-page-group' : ''}`}>
        {/* Godot Game container — always in DOM to preserve iframe/WebSocket */}
        <div className="room-page-container" id="godot-container">
          <iframe
            ref={iframeRef}
            src="/game/index.html"
            id="godot-iframe"
            title="Godot Game"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
          {/* Player card overlay (normal mode only) */}
          {!activeGroup && selectedPlayer && <PlayerCard client={selectedPlayer} onFollow={handleFollow} />}
          {/* Group card overlay — shown when clicking a group dialog */}
          {!activeGroup && selectedGroupCard && (
            <GroupCard group={selectedGroupCard} onJoin={handleJoinGroup} onClose={() => setSelectedGroupCard(null)} />
          )}
        </div>

        {activeGroup ? (
          <GroupChatView
            group={activeGroup}
            onLeaveGroup={handleLeaveGroup}
          />
        ) : (
          <Sidebar
            onLeaveHub={handleGoBack}
            roomName={room?.roomName}
            roomAdmin={room?.roomAdmin}
            onNewGroup={() => setShowCreateGroupModal(true)}
          />
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <CreateGroupModal
          onClose={() => setShowCreateGroupModal(false)}
          onCreate={handleCreateGroup}
        />
      )}

      {/* Floating private chat windows — stacked at bottom-right */}
      {!activeGroup && <ChatWindowsLayer />}

      {/* Following banner — bottom center (shown to the player who is following) */}
      {!activeGroup && followingPlayer && (
        <FollowingBanner target={followingPlayer} onStopFollow={handleStopFollow} />
      )}

      {/* Followed-by banner — bottom left (shown to the player being followed) */}
      {!activeGroup && (
        <FollowedByBanner
          followers={followerIds.map((id) => followersMap[id]).filter(Boolean) as Client[]}
          onStopFollower={handleStopFollower}
          onStopAllFollowers={handleStopAllFollowers}
        />
      )}
    </ChatProvider>
  );
}
