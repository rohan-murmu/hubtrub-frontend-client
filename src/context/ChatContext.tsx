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
  // ─── Paginated history ────────────────────────────────────────────────
  // Previous messages are NOT fetched on open. The user pulls them in a page
  // at a time via the "Load previous chats" button (and again as they scroll
  // up). These fields track that pagination state per chat.
  //
  // convId         — resolved conversation row id, cached after the first page.
  // oldestHistoryAt — timestamp of the oldest DB message loaded so far; used as
  //                   the `before` cursor for the next page.
  // hasMoreHistory  — false once a page comes back smaller than the page size,
  //                   meaning there's nothing older left to load. undefined
  //                   means "not yet checked" (button still shown).
  // historyLoading  — a page fetch is in flight (disables the button / shows a
  //                   spinner).
  convId?: string;
  oldestHistoryAt?: number;
  hasMoreHistory?: boolean;
  historyLoading?: boolean;
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
  /** Fetch the next older page of DB-stored history for a private chat and
   *  prepend it. Called from the "Load previous chats" button — there is no
   *  automatic load on open. No-op while a fetch is in flight or once the
   *  start of history has been reached. */
  loadOlderMessages: (chatId: string) => Promise<void>;
  // Floating chat windows
  openChatWindowIds: string[];
  openChatWindow: (chatId: string) => void;
  closeChatWindow: (chatId: string) => void;
  // Online user tracking
  onlineUserIds: string[];
}

// How many older messages to pull per "Load previous chats" click.
const HISTORY_PAGE_SIZE = 20;

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

  // Paginated history loader. Fetches the next older page (relative to the
  // oldest message already loaded) and prepends it. Triggered explicitly by the
  // "Load previous chats" button — nothing is fetched automatically on open.
  const loadOlderMessages = useCallback(async (chatId: string) => {
    if (!roomId) return;
    const chat = privateChats.find((c) => c.id === chatId);
    // Skip if already fetching or if we've reached the start of history.
    if (!chat || chat.historyLoading || chat.hasMoreHistory === false) return;

    setPrivateChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, historyLoading: true } : c)),
    );

    try {
      // Resolve and cache the conversation row id (only needed once per chat).
      let convId = chat.convId;
      if (!convId) {
        const conv = await conversationService.getOrCreatePrivate(roomId, chat.participantId);
        convId = conv.convId;
      }

      // First page: most-recent messages (no cursor). Subsequent pages: strictly
      // older than the oldest message we've loaded so far.
      const before = chat.oldestHistoryAt
        ? new Date(chat.oldestHistoryAt).toISOString()
        : undefined;
      const msgs = await conversationService.getMessages(convId, HISTORY_PAGE_SIZE, before);

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
          // Dedup against everything already in the chat. Live messages carry
          // client-side IDs (msg-<ts>-...) that never match server UUIDs, so we
          // also match on (senderId, content) within a 30s window to catch the
          // page overlapping optimistic/live messages already on screen.
          const seenIds = new Set(c.messages.map((m) => m.id));
          const fresh = historyMessages.filter((h) => {
            if (seenIds.has(h.id)) return false;
            return !c.messages.some(
              (m) =>
                m.senderId === h.senderId &&
                m.content === h.content &&
                Math.abs(m.timestamp - h.timestamp) < 30_000,
            );
          });
          // msgs come back ascending (oldest → newest), so msgs[0] is the new
          // oldest. A short page means we've hit the beginning of history.
          const newOldest =
            msgs.length > 0 ? new Date(msgs[0].createdAt).getTime() : c.oldestHistoryAt;
          return {
            ...c,
            messages: [...fresh, ...c.messages],
            convId,
            oldestHistoryAt: newOldest,
            hasMoreHistory: msgs.length === HISTORY_PAGE_SIZE,
            historyLoading: false,
          };
        }),
      );
    } catch (err) {
      console.error("Failed to load older private messages:", err);
      setPrivateChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, historyLoading: false } : c)),
      );
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
        loadOlderMessages,
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
