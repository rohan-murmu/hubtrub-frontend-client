// socketClient.ts

// Message types from backend
export const MESSAGE_TYPES = {
  PLAYER_JOIN: "player:join",
  PLAYER_LEAVE: "player:leave",
  ROOM_FULL: "room:full",
  PLAYER_FOLLOW: "player:follow",
  PLAYER_UNFOLLOW: "player:unfollow",
  PLAYER_STOP_ALL_FOLLOWERS: "player:stop_all_followers",
  PLAYER_FOLLOWER_UPDATE: "player:follower_update",
  PLAYER_STOP_FOLLOWING: "player:stop_following",
  INTERFACE_PANEL: "interface:panel",
  INTERFACE_VIEWER: "interface:viewer",
  CHAT_PRIVATE: "chat:private",
  CHAT_PUBLIC: "chat:public",
  ERROR: "error",
  // Asset lifecycle
  ASSET_CREATE: "asset:create",
  ASSET_UPDATE: "asset:update",
  ASSET_DELETE: "asset:delete",
} as const;

// Chat subtypes
export const CHAT_SUBTYPES = {
  REQUEST: "request",
  RESPOND: "respond",
  JOIN: "join",
  MESSAGE: "message",
  LEAVE: "leave",
} as const;

export interface SocketMessage {
  id?: string;
  type: string;
  payload?: Record<string, any>;
}

type MessageListener = (message: SocketMessage) => void;

let ws: WebSocket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;

// Set when the server tells us the room is full (room:full). The server closes
// the socket right after, and that close looks "abnormal" — without this flag
// onclose would dutifully try to reconnect 5×, hammering a room we already know
// has no room for us. Reset on every fresh connect().
let suppressReconnect = false;

// Message listeners
const listeners: Record<string, MessageListener[]> = {};

const emitMessage = (type: string, message: SocketMessage) => {
  if (listeners[type]) {
    listeners[type].forEach((listener) => listener(message));
  }
};

// Derive the WS base from VITE_API_URL when VITE_WS_URL is unset, swapping
// http(s) → ws(s) so dev (http://localhost:9000) and prod just work.
const WS_URL: string = (() => {
  const explicit = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicit) return explicit;
  const api = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:9000';
  return api.replace(/^http/i, 'ws');
})();


export const socketClient = {
  /**
   * Connect to WebSocket server. Auth comes from the hub_session cookie —
   * the browser attaches it automatically on same-origin upgrades.
   */
  async connect(roomId: string): Promise<void> {
    if (isConnecting) {
      console.warn("⚠️ Connection already in progress, skipping...");
      return;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      console.log("✅ WebSocket already connected or connecting");
      return;
    }

    return new Promise<void>((resolve, reject) => {
      isConnecting = true;
      suppressReconnect = false; // fresh attempt — allow reconnects again
      const wsUrl = `${WS_URL}/ws?roomId=${encodeURIComponent(roomId)}&type=ui`;
      console.log(`🔗 Connecting to WebSocket: ${wsUrl}`);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("✅ WebSocket connected");
          isConnecting = false;
          reconnectAttempts = 0;
          resolve();
        };

        ws.onerror = (ev) => {
          console.error("❌ WebSocket error:", ev);
          isConnecting = false;
          reject(new Error("WebSocket error"));
        };

        ws.onclose = (ev) => {
          console.log(`📴 WebSocket closed (code: ${ev.code}, reason: ${ev.reason})`);
          isConnecting = false;

          if (suppressReconnect) {
            console.log("🚫 Room full — not reconnecting");
          } else if (ev.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(
              `🔄 Attempting to reconnect (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY_MS}ms...`
            );
            setTimeout(() => {
              this.connect(roomId).catch((err) => {
                console.error("❌ Reconnection failed:", err);
              });
            }, RECONNECT_DELAY_MS);
          } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error("❌ Max reconnection attempts reached");
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: SocketMessage = JSON.parse(event.data);
            console.log(`📥 Message received (${message.type}):`, message);

            // The room is full: the server closes us right after this frame, so
            // mark the close as expected to stop the reconnect loop before the
            // close handler runs.
            if (message.type === MESSAGE_TYPES.ROOM_FULL) {
              suppressReconnect = true;
            }

            // Emit message to listeners
            emitMessage(message.type, message);

            // Also emit to "all" listeners
            emitMessage("*", message);
          } catch (err) {
            console.error("Failed to parse message:", err);
          }
        };
      } catch (err) {
        isConnecting = false;
        reject(err);
      }
    });
  },

  /**
   * Register a listener for specific message type
   */
  on(messageType: string, callback: MessageListener): () => void {
    if (!listeners[messageType]) {
      listeners[messageType] = [];
    }
    listeners[messageType].push(callback);

    // Return unsubscribe function
    return () => {
      listeners[messageType] = listeners[messageType].filter((cb) => cb !== callback);
    };
  },

  /**
   * Listen for player join events
   */
  onPlayerJoin(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.PLAYER_JOIN, callback);
  },

  /**
   * Listen for player leave events
   */
  onPlayerLeave(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.PLAYER_LEAVE, callback);
  },

  /**
   * Listen for the room:full notice (server refused the join — room at capacity)
   */
  onRoomFull(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.ROOM_FULL, callback);
  },

  /**
   * Listen for interface panel messages
   */
  onInterfacePanel(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.INTERFACE_PANEL, callback);
  },

  /**
   * Listen for interface viewer messages
   */
  onInterfaceViewer(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.INTERFACE_VIEWER, callback);
  },

  /**
   * Listen for private chat messages
   */
  onChatPrivate(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.CHAT_PRIVATE, callback);
  },

  /**
   * Listen for public chat messages
   */
  onChatPublic(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.CHAT_PUBLIC, callback);
  },

  /**
   * Listen for error messages
   */
  onError(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.ERROR, callback);
  },

  /**
   * Listen for follower update events (sent by the server to the followed player)
   */
  onFollowerUpdate(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.PLAYER_FOLLOWER_UPDATE, callback);
  },

  /**
   * Listen for stop-following events (sent by the server to the follower when the
   * followed player removes them)
   */
  onStopFollowing(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.PLAYER_STOP_FOLLOWING, callback);
  },

  /**
   * Send a message to the server
   */
  send(message: SocketMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log(`📤 Sending message (${message.type}):`, message);
      ws.send(JSON.stringify(message));
    } else {
      console.warn("⚠️ WebSocket not connected, message not sent");
    }
  },

  sendFollow(followerId: string, followedId: string): void {
    this.send({ type: MESSAGE_TYPES.PLAYER_FOLLOW, payload: { followerId, followedId } });
  },

  sendUnfollow(followerId: string, followedId: string): void {
    this.send({ type: MESSAGE_TYPES.PLAYER_UNFOLLOW, payload: { followerId, followedId } });
  },

  sendStopAllFollowers(followedId: string): void {
    this.send({ type: MESSAGE_TYPES.PLAYER_STOP_ALL_FOLLOWERS, payload: { followedId } });
  },

  sendPublicChat(senderId: string, content: string, senderName?: string): void {
    this.send({
      type: MESSAGE_TYPES.CHAT_PUBLIC,
      payload: {
        subType: CHAT_SUBTYPES.MESSAGE,
        senderId,
        senderName: senderName || senderId,
        content,
      },
    });
  },

  // ─── Asset Methods ────────────────────────────────────────────────────

  onAssetCreate(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.ASSET_CREATE, callback);
  },

  onAssetUpdate(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.ASSET_UPDATE, callback);
  },

  onAssetDelete(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.ASSET_DELETE, callback);
  },

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (ws) {
      reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect on intentional close
      ws.close(1000, "Client disconnecting");
      ws = null;
    }
    console.log("🔌 WebSocket disconnected");
  },

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return ws !== null && ws.readyState === WebSocket.OPEN;
  },
};