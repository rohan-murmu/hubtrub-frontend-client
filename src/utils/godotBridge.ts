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

  console.log(`📤 Sending message to iframe: ${messageType}`, payload);
  iframe.contentWindow.postMessage(message, "*");
};

/**
 * Listen for messages from the Godot iframe
 */
export const listenToIframeMessages = (
  callback: (message: GodotMessage) => void
): (() => void) => {
  const handler = (event: MessageEvent) => {
    // Validate message origin if needed
    const message = event.data;
    console.log(`📥 Raw message from iframe:`, message);
    console.log(`   - Type: ${message?.type}`);
    console.log(`   - Payload:`, message?.payload);
    
    callback(message);
  };

  window.addEventListener("message", handler);

  // Return cleanup function
  return () => {
    window.removeEventListener("message", handler);
  };
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
