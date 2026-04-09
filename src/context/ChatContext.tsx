import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { socketClient, MESSAGE_TYPES, CHAT_SUBTYPES } from "../services/socketClient";
import { userService } from "../services/api";

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
  // Floating chat windows
  openChatWindowIds: string[];
  openChatWindow: (chatId: string) => void;
  closeChatWindow: (chatId: string) => void;
  // Online user tracking
  onlineUserIds: string[];
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
  const [openChatWindowIds, setOpenChatWindowIds] = useState<string[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);

  const MAX_OPEN_WINDOWS = 3;

  const openChatWindow = useCallback((chatId: string) => {
    setOpenChatWindowIds((prev) => {
      if (prev.includes(chatId)) return prev;
      const next = [...prev, chatId];
      // Drop oldest window if over the limit
      return next.length > MAX_OPEN_WINDOWS ? next.slice(next.length - MAX_OPEN_WINDOWS) : next;
    });
  }, []);

  const closeChatWindow = useCallback((chatId: string) => {
    setOpenChatWindowIds((prev) => prev.filter((id) => id !== chatId));
  }, []);

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

      // The server sends fields at top level (senderId, receiverId, content)
      // React sends them inside payload.subType. Handle both.
      const subType = payload.subType ?? payload.payload?.subType;
      const senderId: string = payload.senderId ?? payload.payload?.senderId;
      const senderName: string = payload.senderName ?? payload.payload?.senderName ?? senderId;
      const targetId: string = payload.receiverId ?? payload.payload?.receiverId ?? payload.recieverId;
      const content: string = payload.content ?? payload.payload?.content ?? "";

      // Only process messages meant for us
      if (targetId !== currentClient.clientId) return;

      // Treat undefined subType (incoming from server) as a regular message
      const isRegularMessage = !subType || subType === CHAT_SUBTYPES.MESSAGE;

      if (isRegularMessage) {
        const existingChat = privateChats.find((c) => c.participantId === senderId);
        if (existingChat) {
          addMessageToChat(existingChat.id, { senderId, senderName, content });
          // If the stored name is still the raw ID, update it with the incoming senderName
          if (senderName && senderName !== senderId && existingChat.participantName === existingChat.participantId) {
            setPrivateChats((prev) =>
              prev.map((c) =>
                c.id === existingChat.id ? { ...c, participantName: senderName } : c
              )
            );
          }
          // Auto-open window if not already open, respecting the 3-window cap
          setOpenChatWindowIds((prev) => {
            if (prev.includes(existingChat.id)) return prev;
            const next = [...prev, existingChat.id];
            return next.length > MAX_OPEN_WINDOWS ? next.slice(next.length - MAX_OPEN_WINDOWS) : next;
          });
          console.log("📩 Received private message from:", senderName);
        } else {
          // Auto-create chat for incoming message
          const chatId = `private-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const newChat: PrivateChat = {
            id: chatId,
            participantId: senderId,
            participantName: senderName,
            messages: [],
            createdAt: Date.now(),
          };
          setPrivateChats((prev) => [...prev, newChat]);
          // If the server didn't send a real name (fallback = senderId), fetch it
          if (!senderName || senderName === senderId) {
            userService.getClientById(senderId).then((clientData) => {
              const actualName = clientData.clientUserName || senderId;
              setPrivateChats((prev) =>
                prev.map((c) =>
                  c.id === chatId ? { ...c, participantName: actualName } : c
                )
              );
            }).catch(() => { /* keep ID as fallback */ });
          }
          // Add message and open window after chat is created
          setTimeout(() => {
            addMessageToChat(chatId, { senderId, senderName, content });
            setOpenChatWindowIds((prev) => {
              if (prev.includes(chatId)) return prev;
              const next = [...prev, chatId];
              return next.length > MAX_OPEN_WINDOWS ? next.slice(next.length - MAX_OPEN_WINDOWS) : next;
            });
          }, 0);
          console.log("📩 Auto-created chat and received message from:", senderName);
        }
        return;
      }

      if (subType === CHAT_SUBTYPES.LEAVE) {
        const chatToRemove = privateChats.find((c) => c.participantId === senderId);
        if (chatToRemove) {
          removePrivateChat(chatToRemove.id);
          console.log("👋 User left private chat:", senderName);
        }
      }
    });

    return unsubscribe;
  }, [privateChats, addMessageToChat, removePrivateChat]);

  // Track online users via player join/leave
  useEffect(() => {
    const unsubJoin = socketClient.onPlayerJoin((message) => {
      const pid = message.payload?.pid as string | undefined;
      if (pid) {
        setOnlineUserIds((prev) => (prev.includes(pid) ? prev : [...prev, pid]));
      }
    });

    const unsubLeave = socketClient.onPlayerLeave((message) => {
      const pid = message.payload?.pid as string | undefined;
      if (pid) {
        setOnlineUserIds((prev) => prev.filter((id) => id !== pid));
      }
    });

    return () => {
      unsubJoin();
      unsubLeave();
    };
  }, []);

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
        openChatWindowIds,
        openChatWindow,
        closeChatWindow,
        onlineUserIds,
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
