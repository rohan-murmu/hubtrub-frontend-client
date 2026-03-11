import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { socketClient, MESSAGE_TYPES, CHAT_SUBTYPES } from "../services/socketClient";

// Message in a chat
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
}

// Private chat structure
export interface PrivateChat {
  id: string; // unique chat id
  participantId: string; // the other user's ID
  participantName: string; // the other user's name
  messages: ChatMessage[];
  createdAt: number;
}

interface ChatContextType {
  privateChats: PrivateChat[];
  activePrivateChatId: string | null;
  setActivePrivateChatId: (id: string | null) => void;
  createPrivateChat: (participantId: string, participantName: string) => string;
  addMessageToChat: (chatId: string, message: Omit<ChatMessage, "id" | "timestamp">) => void;
  sendPrivateMessage: (chatId: string, content: string) => void;
  leavePrivateChat: (chatId: string) => void;
  getPrivateChatByParticipant: (participantId: string) => PrivateChat | undefined;
  removePrivateChat: (chatId: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Helper to get current client info from localStorage
function getCurrentClient(): { clientId: string; clientUserName: string } | null {
  try {
    const clientData = localStorage.getItem("client");
    if (clientData) {
      const client = JSON.parse(clientData);
      return {
        clientId: client.clientId || "",
        clientUserName: client.clientUserName || "Unknown",
      };
    }
  } catch {
    console.error("Failed to get current client");
  }
  return null;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [privateChats, setPrivateChats] = useState<PrivateChat[]>([]);
  const [activePrivateChatId, setActivePrivateChatId] = useState<string | null>(null);

  // Create a new private chat
  const createPrivateChat = useCallback((participantId: string, participantName: string): string => {
    // Check if chat already exists
    const existing = privateChats.find((chat) => chat.participantId === participantId);
    if (existing) {
      return existing.id;
    }

    const chatId = `private-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newChat: PrivateChat = {
      id: chatId,
      participantId,
      participantName,
      messages: [],
      createdAt: Date.now(),
    };

    setPrivateChats((prev) => [...prev, newChat]);
    console.log("💬 Created private chat with:", participantName, chatId);
    return chatId;
  }, [privateChats]);

  // Add a message to a chat
  const addMessageToChat = useCallback((chatId: string, message: Omit<ChatMessage, "id" | "timestamp">) => {
    const newMessage: ChatMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    setPrivateChats((prev) =>
      prev.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, newMessage] }
          : chat
      )
    );
  }, []);

  // Send a private message
  const sendPrivateMessage = useCallback((chatId: string, content: string) => {
    const chat = privateChats.find((c) => c.id === chatId);
    if (!chat) {
      console.error("Chat not found:", chatId);
      return;
    }

    const currentClient = getCurrentClient();
    if (!currentClient) {
      console.error("Current client not found");
      return;
    }

    // Send to server
    socketClient.send({
      type: MESSAGE_TYPES.CHAT_PRIVATE,
      payload: {
        subType: CHAT_SUBTYPES.MESSAGE,
        senderId: currentClient.clientId,
        senderName: currentClient.clientUserName,
        receiverId: chat.participantId,
        content,
      },
    });

    // Add to local chat immediately (optimistic update)
    addMessageToChat(chatId, {
      senderId: currentClient.clientId,
      senderName: currentClient.clientUserName,
      content,
    });

    console.log("📤 Sent private message to:", chat.participantName);
  }, [privateChats, addMessageToChat]);

  // Leave a private chat
  const leavePrivateChat = useCallback((chatId: string) => {
    const chat = privateChats.find((c) => c.id === chatId);
    if (!chat) return;

    const currentClient = getCurrentClient();
    if (!currentClient) return;

    // Send leave message to server
    socketClient.send({
      type: MESSAGE_TYPES.CHAT_PRIVATE,
      payload: {
        subType: CHAT_SUBTYPES.LEAVE,
        senderId: currentClient.clientId,
        receiverId: chat.participantId,
      },
    });

    // Remove chat locally
    setPrivateChats((prev) => prev.filter((c) => c.id !== chatId));
    
    // Clear active chat if it was the one we left
    if (activePrivateChatId === chatId) {
      setActivePrivateChatId(null);
    }

    console.log("👋 Left private chat with:", chat.participantName);
  }, [privateChats, activePrivateChatId]);

  // Get private chat by participant ID
  const getPrivateChatByParticipant = useCallback((participantId: string): PrivateChat | undefined => {
    return privateChats.find((chat) => chat.participantId === participantId);
  }, [privateChats]);

  // Remove a private chat (called when other user leaves)
  const removePrivateChat = useCallback((chatId: string) => {
    setPrivateChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activePrivateChatId === chatId) {
      setActivePrivateChatId(null);
    }
  }, [activePrivateChatId]);

  // Listen for incoming private chat messages
  useEffect(() => {
    const unsubscribe = socketClient.onChatPrivate((message) => {
         const payload = JSON.parse(JSON.stringify(message));
      if (!payload) return;

      const currentClient = getCurrentClient();
      if (!currentClient) return;

      const subType = payload.subType;
      const senderId = payload.senderId;
      const senderName = payload.senderName || senderId;
      const targetId = payload.receiverId ?? payload.recieverId;

      // Only process messages meant for us
      if (targetId !== currentClient.clientId) return;

      switch (subType) {
        case CHAT_SUBTYPES.MESSAGE:
          // Find the chat with this sender
          const chat = privateChats.find((c) => c.participantId === senderId);
          if (chat) {
            addMessageToChat(chat.id, {
              senderId,
              senderName,
              content: payload.content || "",
            });
            console.log("📩 Received private message from:", senderName);
          } else {
            console.warn("⚠️ Received message but no chat found for sender:", senderId);
          }
          break;

        case CHAT_SUBTYPES.LEAVE:
          // Other user left the chat - find and remove it
          const chatToRemove = privateChats.find((c) => c.participantId === senderId);
          if (chatToRemove) {
            removePrivateChat(chatToRemove.id);
            console.log("👋 User left private chat:", senderName);
          }
          break;
      }
    });

    return unsubscribe;
  }, [privateChats, addMessageToChat, removePrivateChat]);

  return (
    <ChatContext.Provider
      value={{
        privateChats,
        activePrivateChatId,
        setActivePrivateChatId,
        createPrivateChat,
        addMessageToChat,
        sendPrivateMessage,
        leavePrivateChat,
        getPrivateChatByParticipant,
        removePrivateChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
