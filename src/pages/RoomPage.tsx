import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import type { Room, Client } from "../types";
import { roomService } from "../services/api";
import { sendMessageToIframe, cleanupGodotSession, listenToIframeMessages } from "../utils/godotBridge";
import { socketClient } from "../services/socketClient";
import { PanelProvider } from "../context/PanelContext";
import { ChatProvider } from "../context/ChatContext";
import Sidebar from "../components/Sidebar/Sidebar";
import "./RoomPage.css";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const socketConnectedRef = useRef(false);

  const [room, setRoom] = useState<Room | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [godotConfigSent, setGodotConfigSent] = useState(false);

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

  // // Initialize iframe and communicate with Godot
  // useEffect(() => {
  //   if (
  //     loading ||
  //     !room ||
  //     !client ||
  //     !iframeRef.current ||
  //     gameInitializedRef.current
  //   ) {
  //     return;
  //   }

  //   const initializeGame = async () => {
  //     try {
  //       console.log("📥 Starting Game initialization with iframe...");

  //       // Wait for iframe to load
  //       await new Promise<void>((resolve) => {
  //         if (iframeRef.current?.contentWindow) {
  //           resolve();
  //         } else {
  //           iframeRef.current!.onload = () => resolve();
  //         }
  //       });

  //       gameInitializedRef.current = true;

  //       // Prepare config
  //       const worldKey = room.roomScene || "";
  //       const playerKey = client.clientAvatar || "";
  //       const clientId = client.clientId || "";
  //       const rid = roomId || "";

  //       const config = {
  //         roomId: rid,
  //         clientId,
  //         worldKey,
  //         playerKey,
  //       };

  //       console.log("🔗 Sending connection config to game iframe:", config);

  //       // Send configuration to iframe via postMessage
  //       if (iframeRef.current) {
  //         sendMessageToIframe(iframeRef.current, "SET_CONNECTION_CONFIG", config);
  //       }

  //       console.log("✓ Game initialization completed");
  //       console.log("ℹ️  Game should be running now in the iframe");
  //     } catch (err) {
  //       console.error("❌ Game initialization failed:", err);
  //       const errorMsg = err instanceof Error ? err.message : String(err);
  //       setError(`Failed to initialize game: ${errorMsg}`);
  //       gameInitializedRef.current = false;
  //     }
  //   };

  //   initializeGame();

  //   // Cleanup on unmount
  //   return () => {
  //     cleanupGodotSession();
  //   };
  // }, [loading, room, client, roomId]);

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
      console.log("👆 RoomPage received PLAYER_CLICKED:", message.payload?.clientId);
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
      } catch (err) {
        console.error("❌ React WebSocket connection failed:", err);
        const errorMsg = err instanceof Error ? err.message : "WebSocket connection failed";
        if (errorMsg !== "Connection already in progress") {
          setError(`Connection error: ${errorMsg}`);
        }
      }
    };

    connectToSocket();

    // Cleanup on unmount - emit leave message
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
    <PanelProvider>
      <ChatProvider>
        <div className="room-page">
          {/* Back Button */}
          <div className="room-page-header">
            <Button
              icon="pi pi-arrow-left"
              onClick={handleGoBack}
              className="p-button-rounded p-button-text back-button"
              title="Go back to hub list"
            />
            <h1 className="room-title">{room?.roomName}</h1>
            <div className="room-info">
              <small>By {room?.roomAdmin || "Unknown"}</small>
            </div>
          </div>

          {/* Main Content with Game and Sidebar */}
          <div className="room-page-content">
            {/* Godot Game iframe */}
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
            </div>

            {/* Right Sidebar */}
            <Sidebar />
          </div>
        </div>
      </ChatProvider>
    </PanelProvider>
  );
}
