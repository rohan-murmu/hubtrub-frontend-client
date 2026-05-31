import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { socketClient, MESSAGE_TYPES, CHAT_SUBTYPES } from "@/services/socketClient";
import { userService, conversationService } from "@/services/api";
import { useCurrentUser } from "./UserContext";

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
  /** Other user's avatar catalogue key — populated when known (PlayerCard
   *  click, or fetched lazily on the auto-create path). When absent the
   *  Avatar component falls back to initials. */
  participantAvatarKey?: string;
  messages: ChatMessage[];
  createdAt: number;
  // historyLoaded flips true after the lazy fetch of past messages from the
  // /conversation/{id}/messages endpoint completes. Used to avoid double-fetch
  // when the window is closed and reopened.
  historyLoaded?: boolean;
}

interface ChatContextType {
  privateChats: PrivateChat[];
  activePrivateChatId: string | null;
  setActivePrivateChatId: (id: string | null) => void;
  createPrivateChat: (participantId: string, participantName: string, participantAvatarKey?: string) => string;
  addMessageToChat: (chatId: string, message: Omit<ChatMessage, "id" | "timestamp">) => void;
  sendPrivateMessage: (chatId: string, content: string) => void;
  leavePrivateChat: (chatId: string) => void;
  getPrivateChatByParticipant: (participantId: string) => PrivateChat | undefined;
  removePrivateChat: (chatId: string) => void;
  /** Fetch DB-stored history for a private chat and prepend it to messages.
   *  No-op after the first call per chat. */
  loadPrivateHistory: (chatId: string) => Promise<void>;
  // Floating chat windows
  openChatWindowIds: string[];
  openChatWindow: (chatId: string) => void;
  closeChatWindow: (chatId: string) => void;
  // Online user tracking
  onlineUserIds: string[];
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children, roomId }: { children: ReactNode; roomId?: string }) {
  const currentUser = useCurrentUser();

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
  const createPrivateChat = useCallback((participantId: string, participantName: string, participantAvatarKey?: string): string => {
    // Check if chat already exists
    const existing = privateChats.find((chat) => chat.participantId === participantId);
    if (existing) {
      // Backfill the avatar key if we didn't know it before.
      if (participantAvatarKey && !existing.participantAvatarKey) {
        setPrivateChats((prev) =>
          prev.map((c) =>
            c.id === existing.id ? { ...c, participantAvatarKey } : c,
          ),
        );
      }
      return existing.id;
    }

    const chatId = `private-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newChat: PrivateChat = {
      id: chatId,
      participantId,
      participantName,
      participantAvatarKey,
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

    if (!currentUser) {
      console.error("Current user not found");
      return;
    }

    // Send to server
    socketClient.send({
      type: MESSAGE_TYPES.CHAT_PRIVATE,
      payload: {
        subType: CHAT_SUBTYPES.MESSAGE,
        senderId: currentUser.userId,
        senderName: currentUser.username,
        receiverId: chat.participantId,
        content,
      },
    });

    // Add to local chat immediately (optimistic update)
    addMessageToChat(chatId, {
      senderId: currentUser.userId,
      senderName: currentUser.username,
      content,
    });

    console.log("📤 Sent private message to:", chat.participantName);
  }, [privateChats, addMessageToChat, currentUser]);

  // Leave a private chat
  const leavePrivateChat = useCallback((chatId: string) => {
    const chat = privateChats.find((c) => c.id === chatId);
    if (!chat) return;

    if (!currentUser) return;

    // Send leave message to server
    socketClient.send({
      type: MESSAGE_TYPES.CHAT_PRIVATE,
      payload: {
        subType: CHAT_SUBTYPES.LEAVE,
        senderId: currentUser.userId,
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
  }, [privateChats, activePrivateChatId, currentUser]);

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

  // Lazy history loader. Called from PrivateChatWindow on first mount per chat.
  // Hits two endpoints: one to resolve the conversation row, another to fetch
  // its messages. Idempotent — historyLoaded short-circuits later calls.
  const loadPrivateHistory = useCallback(async (chatId: string) => {
    if (!roomId) return;
    const chat = privateChats.find((c) => c.id === chatId);
    if (!chat || chat.historyLoaded) return;
    try {
      const conv = await conversationService.getOrCreatePrivate(roomId, chat.participantId);
      const msgs = await conversationService.getMessages(conv.convId, 100);
      const historyMessages: ChatMessage[] = msgs.map((m) => ({
        id: m.messageId,
        senderId: m.senderId,
        senderName:
          m.senderId === currentUser?.userId
            ? currentUser.username
            : chat.participantName,
        content: m.content,
        timestamp: new Date(m.createdAt).getTime(),
      }));
      setPrivateChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c;
          // Merge: history first, then anything received via socket in the
          // meantime. Live messages have client-side IDs (msg-<ts>-...) that
          // never match the server UUIDs in history, so we also dedup by
          // (senderId, content) within a 30s window. Why: the very first
          // message into an auto-created chat was getting duplicated — once
          // from the WS receive path and again from this lazy history fetch.
          const seenIds = new Set(historyMessages.map((m) => m.id));
          const live = c.messages.filter((m) => {
            if (seenIds.has(m.id)) return false;
            return !historyMessages.some(
              (h) =>
                h.senderId === m.senderId &&
                h.content === m.content &&
                Math.abs(h.timestamp - m.timestamp) < 30_000,
            );
          });
          return { ...c, messages: [...historyMessages, ...live], historyLoaded: true };
        }),
      );
    } catch (err) {
      console.error("Failed to load private chat history:", err);
    }
  }, [roomId, privateChats, currentUser]);

  // Listen for incoming private chat messages
  useEffect(() => {
    const unsubscribe = socketClient.onChatPrivate((message) => {
      const payload = JSON.parse(JSON.stringify(message));
      if (!payload) return;

      if (!currentUser) return;

      // The server sends fields at top level (senderId, receiverId, content)
      // React sends them inside payload.subType. Handle both.
      const subType = payload.subType ?? payload.payload?.subType;
      const senderId: string = payload.senderId ?? payload.payload?.senderId;
      const senderName: string = payload.senderName ?? payload.payload?.senderName ?? senderId;
      const content: string = payload.content ?? payload.payload?.content ?? "";

      // Only process messages meant for us
      if (senderId === currentUser.userId) return;
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
          // Auto-create chat for incoming message. We must seed the chat with
          // the first message in the same setState — splitting it across a
          // setTimeout(0) + addMessageToChat raced with React's commit, so the
          // map() in addMessageToChat sometimes ran against the pre-insert
          // snapshot and the message was silently dropped.
          const chatId = `private-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const firstMessage: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            senderId,
            senderName,
            content,
            timestamp: Date.now(),
          };
          const newChat: PrivateChat = {
            id: chatId,
            participantId: senderId,
            participantName: senderName,
            messages: [firstMessage],
            createdAt: Date.now(),
          };
          setPrivateChats((prev) => [...prev, newChat]);
          setOpenChatWindowIds((prev) => {
            if (prev.includes(chatId)) return prev;
            const next = [...prev, chatId];
            return next.length > MAX_OPEN_WINDOWS ? next.slice(next.length - MAX_OPEN_WINDOWS) : next;
          });
          // Always look up the sender so we can populate the avatar key
          // (and the username, if the server only sent the raw ID).
          userService.getById(senderId).then((u) => {
            if (!u) return;
            const actualName = u.username || senderName || senderId;
            setPrivateChats((prev) =>
              prev.map((c) =>
                c.id === chatId
                  ? {
                      ...c,
                      participantName: actualName,
                      participantAvatarKey: u.avatarKey ?? c.participantAvatarKey,
                    }
                  : c
              )
            );
          }).catch(() => { /* keep ID as fallback */ });
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
  }, [privateChats, addMessageToChat, removePrivateChat, currentUser]);

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
        loadPrivateHistory,
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
