/**
 * Godot Bridge Utility - iframe PostMessage Communication
 * 
 * This file provides utility functions to interact with the Godot game engine
 * from React using iframe PostMessage API.
 */

interface ConnectionConfig {
  roomId: string;
  clientId: string;
  worldKey: string;
  playerKey: string;
}

interface GodotMessage {
  type: string;
  payload?: any;
}

/**
 * Send a message to the Godot iframe
 */
export const sendMessageToIframe = (
  iframe: HTMLIFrameElement,
  messageType: string,
  payload?: any
): void => {
  if (!iframe?.contentWindow) {
    console.warn("❌ Iframe content window not available");
    return;
  }

  const message: GodotMessage = {
    type: messageType,
    payload,
  };

  iframe.contentWindow.postMessage(message, "*");
};

/**
 * Listen for messages from the Godot iframe
 */
export const listenToIframeMessages = (
  callback: (message: GodotMessage) => void
): (() => void) => {
  const handler = (event: MessageEvent) => {
    callback(event.data);
  };

  window.addEventListener("message", handler);

  // Return cleanup function
  return () => {
    window.removeEventListener("message", handler);
  };
};

/**
 * Ask the Godot iframe for the local player's current position. Resolves with
 * {x, y} when the game answers via PLAYER_POSITION_RESPONSE, or rejects on
 * timeout. Used when creating an asset so it spawns at the creator's position.
 */
export const requestPlayerPosition = (
  iframe: HTMLIFrameElement | null,
  timeoutMs = 1500,
): Promise<{ x: number; y: number }> => {
  return new Promise((resolve, reject) => {
    if (!iframe?.contentWindow) {
      reject(new Error("Iframe not ready"));
      return;
    }

    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (msg?.type === "PLAYER_POSITION_RESPONSE") {
        const x = Number(msg.payload?.x ?? 0);
        const y = Number(msg.payload?.y ?? 0);
        cleanup();
        resolve({ x, y });
      }
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for player position"));
    }, timeoutMs);
    const cleanup = () => {
      window.removeEventListener("message", handler);
      window.clearTimeout(timer);
    };

    window.addEventListener("message", handler);
    sendMessageToIframe(iframe, "REQUEST_PLAYER_POSITION");
  });
};

/**
 * Get the stored connection config from session storage
 */
export const getStoredConnectionConfig = (): ConnectionConfig | null => {
  try {
    const config = sessionStorage.getItem("godot_connection_config");
    return config ? JSON.parse(config) : null;
  } catch (error) {
    console.error("Error retrieving stored connection config:", error);
    return null;
  }
};

/**
 * Clean up Godot resources when leaving a room
 */
export const cleanupGodotSession = (): void => {
  try {
    sessionStorage.removeItem("godot_connection_config");
    console.log("Godot session cleaned up");
  } catch (error) {
    console.error("Error cleaning up Godot session:", error);
  }
};

export default {
  sendMessageToIframe,
  listenToIframeMessages,
  getStoredConnectionConfig,
  cleanupGodotSession,
};
