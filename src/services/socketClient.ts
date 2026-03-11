// socketClient.ts

// Message types from backend
export const MESSAGE_TYPES = {
  PLAYER_JOIN: "player:join",
  PLAYER_LEAVE: "player:leave",
  INTERFACE_PANEL: "interface:panel",
  INTERFACE_VIEWER: "interface:viewer",
  CHAT_PRIVATE: "chat:private",
  CHAT_GROUP: "chat:group",
  CHAT_PUBLIC: "chat:public",
  ERROR: "error",
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

// Message listeners
const listeners: Record<string, MessageListener[]> = {};

const emitMessage = (type: string, message: SocketMessage) => {
  if (listeners[type]) {
    listeners[type].forEach((listener) => listener(message));
  }
};

export const socketClient = {
  /**
   * Connect to WebSocket server
   */
  async connect(roomId: string, clientId: string): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (isConnecting) {
      console.warn("⚠️ Connection already in progress, skipping...");
      return;
    }

    // If already connected, don't open another one
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      console.log("✅ WebSocket already connected or connecting");
      return;
    }

    return new Promise<void>((resolve, reject) => {
      isConnecting = true;
      const wsUrl = `ws://127.0.0.1:9000/ws?roomId=${roomId}&clientId=${clientId}&type=interface`;
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

          // Only auto-reconnect if it's NOT a normal close (code 1000)
          // and we haven't exceeded max attempts
          if (ev.code !== 1000 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(
              `🔄 Attempting to reconnect (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${RECONNECT_DELAY_MS}ms...`
            );
            setTimeout(() => {
              this.connect(roomId, clientId).catch((err) => {
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
   * Listen for group chat messages
   */
  onChatGroup(callback: (message: SocketMessage) => void): () => void {
    return this.on(MESSAGE_TYPES.CHAT_GROUP, callback);
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