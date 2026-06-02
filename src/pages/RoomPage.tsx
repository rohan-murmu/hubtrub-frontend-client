import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Button from "@/components/ui/Button";
import type { Asset, AssetWithUrl, Room, User } from "@/types";
import { assetService, roomService, userService } from "@/services/api";
import { useCurrentUser } from "@/context/UserContext";
import { sendMessageToIframe, cleanupGodotSession, listenToIframeMessages } from "@/utils/godotBridge";
import { socketClient } from "@/services/socketClient";
import { ChatProvider, useChat } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar/Sidebar";
import PlayerCard from "@/components/PlayerCard/PlayerCard";
import AssetCard from "@/components/AssetCard/AssetCard";
import AssetViewerModal from "@/components/AssetViewerModal/AssetViewerModal";
import PrivateChatWindow from "@/components/PrivateChatWindow/PrivateChatWindow";
import FollowingBanner from "@/components/FollowingBanner/FollowingBanner";
import FollowedByBanner from "@/components/FollowedByBanner/FollowedByBanner";
import PublicChatOverlay from "@/components/PublicChatOverlay/PublicChatOverlay";
import PlacementBar from "@/components/PlacementBar/PlacementBar";
import GameLoadingOverlay, {
  type LoadingStage,
  type LoadingStageId,
} from "@/components/GameLoadingOverlay/GameLoadingOverlay";
import InlineLoadingToast from "@/components/InlineLoadingToast/InlineLoadingToast";
import "./RoomPage.css";

const INITIAL_STAGES: LoadingStage[] = [
  { id: "fetch_room", label: "Fetching room", status: "pending" },
  { id: "engine_download", label: "Downloading game engine", status: "pending" },
  { id: "engine_ready", label: "Initializing engine", status: "pending" },
  { id: "ws_connect", label: "Connecting to game server", status: "pending" },
  { id: "world_render", label: "Rendering world", status: "pending" },
  { id: "load_assets", label: "Loading assets", status: "pending" },
  { id: "load_players", label: "Loading players", status: "pending" },
  { id: "ready", label: "Ready to play", status: "pending" },
];

// Godot's WebSocketPeer and HTTPClient can't resolve relative URLs against a
// page origin like the browser does, so convert VITE_API_URL (which may be
// "/api" in same-origin docker deployments) to an absolute base before
// handing it to the iframe.
const toAbsolute = (value: string): string =>
  /^https?:/i.test(value) ? value : `${window.location.origin}${value.startsWith('/') ? value : '/' + value}`;

const GODOT_API_BASE = toAbsolute((import.meta.env.VITE_API_URL as string) || 'http://localhost:9000');
const WS_URL: string =
  (import.meta.env.VITE_WS_URL as string) || GODOT_API_BASE.replace(/^http/i, 'ws');

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
  const currentUser = useCurrentUser();
  const userRef = useRef<User | null>(currentUser);
  userRef.current = currentUser;

  const [room, setRoom] = useState<Room | null>(null);
  const [roomHost, setRoomHost] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [godotConfigSent, setGodotConfigSent] = useState(false);

  // ─── Loading-stage tracking ──────────────────────────────────────────
  // Stages progress from React (room fetch, socket open) and from Godot
  // (engine download, engine ready, world render, asset/player spawn, self
  // joined). The overlay stays mounted on top of the iframe until the
  // final "ready" stage is marked done.
  const [loadingStages, setLoadingStages] = useState<LoadingStage[]>(INITIAL_STAGES);
  const [loadingMessage, setLoadingMessage] = useState("Connecting...");
  // Once the initial load completes, latch the big overlay shut. Late
  // LOADING_PROGRESS events from Godot (asset spawns, scene swaps) would
  // otherwise flip a stage back to "active" and re-show the full splash —
  // those are now surfaced via the small InlineLoadingToast instead.
  const [initialReady, setInitialReady] = useState(false);

  const markStage = (
    id: LoadingStageId,
    status: "active" | "done",
    opts?: { detail?: string; message?: string },
  ) => {
    setLoadingStages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail: opts?.detail ?? s.detail } : s)),
    );
    if (opts?.message) setLoadingMessage(opts.message);
  };

  const allStagesDone = loadingStages.every((s) => s.status === "done");
  // `allLoaded` (old name) is kept as a synonym for the splash overlay's
  // visibility — true once we've gone ready, never flips false again.
  const allLoaded = initialReady || allStagesDone;
  const hasActiveStage = loadingStages.some((s) => s.status === "active");
  const showInlineLoader = initialReady && hasActiveStage;

  useEffect(() => {
    if (allStagesDone && !initialReady) {
      setInitialReady(true);
    }
  }, [allStagesDone, initialReady]);
  // Unified overlay-card state — only one of player/asset cards is ever
  // visible at a time, so we track which kind is active and clear the others
  // whenever a new one is selected.
  type ActiveCard =
    | { kind: "player"; playerId: string; user: User | null }
    | { kind: "asset"; assetId: string; asset: AssetWithUrl | null }
    | null;
  const [activeCard, setActiveCard] = useState<ActiveCard>(null);
  const closeActiveCard = () => setActiveCard(null);
  // Show the player card immediately in a loading (skeleton) state, then fill in
  // the user details once the API call returns — mirrors the asset card flow so
  // selecting a player gives instant feedback instead of a blank pause.
  const showPlayerCard = (playerId: string) => {
    setActiveCard({ kind: "player", playerId, user: null });
    userService.getById(playerId)
      .then((data) => {
        if (!data) return;
        setActiveCard((prev) =>
          prev && prev.kind === "player" && prev.playerId === playerId
            ? { ...prev, user: data }
            : prev,
        );
      })
      .catch((err) => console.error("Failed to fetch selected player:", err));
  };
  const selectedPlayer = activeCard?.kind === "player" ? activeCard.user : null;
  const selectedPlayerId = activeCard?.kind === "player" ? activeCard.playerId : null;
  const selectedAsset = activeCard?.kind === "asset" ? activeCard.asset : null;
  const selectedAssetId = activeCard?.kind === "asset" ? activeCard.assetId : null;

  const [followingPlayer, setFollowingPlayer] = useState<User | null>(null);
  const [followerIds, setFollowerIds] = useState<string[]>([]);
  const [followersMap, setFollowersMap] = useState<Record<string, User>>({});

  // Asset full-view modal (separate from the card overlay above).
  const [viewingAsset, setViewingAsset] = useState<Asset | null>(null);

  // Touch asset-placement: on coarse-pointer devices the Godot ghost can't
  // follow a hover, so it's dragged with a finger and committed/cancelled from
  // an on-screen bar instead of a click. We show that bar while a placement is
  // in flight (Godot announces it via ASSET_PLACEMENT_STARTED).
  const [placingAssetId, setPlacingAssetId] = useState<string | null>(null);
  // Mirror Godot's DisplayServer.is_touchscreen_available() (touch points /
  // ontouchstart) so the bar shows exactly when the game uses the drag-to-place
  // ghost — including touchscreen laptops, which a coarse-pointer check misses.
  const [isTouchDevice] = useState(
    () =>
      typeof navigator !== "undefined" &&
      ((navigator.maxTouchPoints ?? 0) > 0 || "ontouchstart" in window),
  );

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
      if (userRef.current?.userId && socketClient.isConnected()) {
        socketClient.send({
          type: "player:leave",
          payload: { pid: userRef.current.userId },
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

  // Fetch room data
  useEffect(() => {
    const initializeRoom = async () => {
      try {
        if (!roomId) {
          setError("Room ID not provided");
          return;
        }

        markStage("fetch_room", "active", { message: "Fetching room metadata..." });
        markStage("engine_download", "active", { message: "Downloading game engine..." });

        const roomData = await roomService.getRoomById(roomId);
        setRoom(roomData);
        markStage("fetch_room", "done", { message: `Room "${roomData?.name ?? roomId}" loaded` });
        // Resolve the host's username so the Info panel shows a name, not a raw userId
        if (roomData?.userId) {
          userService.getById(roomData.userId)
            .then((host) => { if (host) setRoomHost(host); })
            .catch(() => { /* fall back to userId in UI */ });
        }
      } catch (err) {
        console.error("Failed to fetch room data:", err);
        setError("Failed to load room");
      }
    };

    initializeRoom();
  }, [roomId]);

  useEffect(() => {
    const cleanup = listenToIframeMessages((message) => {
      if (message?.type === "GODOT_READY") {
        console.log("🎮 Godot is ready!");
        markStage("engine_download", "done", { message: "Engine downloaded" });
        markStage("engine_ready", "done", { message: "Engine initialized" });

        if (iframeRef.current) {
          sendMessageToIframe(
            iframeRef.current,
            "SET_CONNECTION_CONFIG",
            {
              wsBaseUrl: WS_URL,
              // Backend HTTP base — used by the game to fetch usernames and
              // asset images. Must be absolute since Godot's HTTPClient can't
              // resolve relative paths against a page origin.
              apiBaseUrl: GODOT_API_BASE,
              roomId: roomId,
              clientId: currentUser?.userId,
              worldKey: room?.sceneKey,
              playerKey: currentUser?.avatarKey,
            }
          );
          console.log("✅ Godot config sent, marking as ready for React socket connection");
          markStage("ws_connect", "active", { message: "Opening game socket..." });
          setGodotConfigSent(true);
        }
      }

      // Loading-stage updates pushed by Godot. Payload: { stage, message?, detail? }.
      if (message?.type === "LOADING_PROGRESS") {
        const payload = message.payload ?? {};
        const stage: LoadingStageId | undefined = payload.stage;
        const status: "active" | "done" = payload.status === "done" ? "done" : "active";
        if (stage) {
          markStage(stage, status, {
            detail: payload.detail,
            message: payload.message,
          });
        } else if (payload.message) {
          setLoadingMessage(payload.message);
        }
      }

      // Engine download progress streamed from public/game/index.html's
      // engine.startGame onProgress hook. Comes as { current, total } in
      // bytes — convert to a percent for the side-detail chip.
      if (message?.type === "ENGINE_DOWNLOAD_PROGRESS") {
        const { current = 0, total = 0 } = message.payload ?? {};
        if (total > 0) {
          const pct = Math.min(100, Math.round((current / total) * 100));
          markStage("engine_download", "active", {
            detail: `${pct}%`,
            message: `Downloading game engine (${pct}%)...`,
          });
        }
      }

      if (message?.type === "PLAYER_CLICKED") {
        const clickedClientId = message.payload?.clientId;
        console.log("👆 RoomPage received PLAYER_CLICKED:", clickedClientId);
        if (clickedClientId) showPlayerCard(clickedClientId);
      }

      if (message?.type === "OBJECT_SELECTED" && message.payload?.objectType === "player") {
        const objectId = message.payload?.objectId;
        if (objectId) showPlayerCard(objectId);
      }

      if (message?.type === "OBJECT_SELECTED" && message.payload?.objectType === "asset") {
        const objectId = message.payload?.objectId;
        if (objectId) {
          // Show the card immediately in a loading state, then fill in details
          // once the API call returns.
          setActiveCard({ kind: "asset", assetId: objectId, asset: null });
          assetService.getAssetById(objectId)
            .then((data) => {
              setActiveCard((prev) =>
                prev && prev.kind === "asset" && prev.assetId === objectId
                  ? { ...prev, asset: data }
                  : prev,
              );
            })
            .catch((err) => console.error("Failed to fetch selected asset:", err));
        }
      }

      if (message?.type === "PLAYER_DESELECTED" || message?.type === "OBJECT_DESELECTED") {
        setActiveCard(null);
      }

      // Godot entered placement mode — show the touch placement bar.
      if (message?.type === "ASSET_PLACEMENT_STARTED") {
        setPlacingAssetId(message.payload?.assetId ?? null);
      }

      // Godot finished placement — persist coords. Backend transitions the
      // DRAFT row to PLACED and broadcasts asset:create to the room, so we
      // don't need to spawn anything here ourselves.
      if (message?.type === "ASSET_PLACED") {
        const { assetId, xpos, ypos } = message.payload ?? {};
        if (assetId && Number.isFinite(xpos) && Number.isFinite(ypos)) {
          assetService.placeAsset(assetId, Number(xpos), Number(ypos))
            .catch((err) => console.error("Failed to place asset:", err));
        }
        setPlacingAssetId(null);
      }

      if (message?.type === "ASSET_PLACEMENT_CANCELLED") {
        // The draft row stays in the AssetTab so the user can try again; just
        // dismiss the placement bar.
        setPlacingAssetId(null);
      }
    });

    return cleanup;
  }, [room, currentUser, roomId]);

  // Connect React to WebSocket server and setup listeners
  useEffect(() => {
    if (!currentUser || !roomId || socketConnectedRef.current || !godotConfigSent) {
      return;
    }

    let unsubscribePlayerJoin: (() => void) | undefined;
    let unsubscribePlayerLeave: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    const connectToSocket = async () => {
      try {
        console.log("🔗 Attempting React WebSocket connection...");
        await socketClient.connect(roomId);
        socketConnectedRef.current = true;
        console.log("✅ React WebSocket connected successfully");
        markStage("ws_connect", "done", { message: "Game server connected" });

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
          // Fetch user details for any IDs we haven't resolved yet
          ids.forEach((id) => {
            setFollowersMap((prev) => {
              if (prev[id]) return prev;
              userService.getById(id)
                .then((data) => { if (data) setFollowersMap((m) => ({ ...m, [id]: data })); })
                .catch(() => { });
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

        // ─── Asset lifecycle listeners ───────────────────────────
        // The game handles instantiating/removing asset nodes itself; here we
        // need to:
        //   - close the open card / viewer when the asset is deleted
        //   - refresh the open card / viewer when likes/views change
        socketClient.onAssetDelete((message) => {
          const id = message.payload?.id;
          if (!id) return;
          setActiveCard((prev) =>
            prev?.kind === "asset" && prev.assetId === id ? null : prev,
          );
          setViewingAsset((prev) => (prev && prev.assetId === id ? null : prev));
        });
        socketClient.onAssetUpdate((message) => {
          const payload = (message.payload ?? {}) as Record<string, any>;
          const id = payload.id;
          if (!id) return;
          // The asset:update payload uses the slim wire shape — flatten it
          // back into the Asset type the UI expects.
          const mergeAsset = <T extends Asset | AssetWithUrl>(current: T): T => ({
            ...current,
            type: payload.type ?? current.type,
            caption: payload.caption ?? current.caption,
            status: payload.status ?? current.status,
            xpos: payload.xpos ?? payload.pos?.x ?? current.xpos,
            ypos: payload.ypos ?? payload.pos?.y ?? current.ypos,
            viewsCount: payload.viewsCount ?? current.viewsCount,
            likesCount: payload.likesCount ?? current.likesCount,
          });
          setActiveCard((prev) => {
            if (prev?.kind !== "asset" || prev.assetId !== id || !prev.asset) return prev;
            return { ...prev, asset: mergeAsset(prev.asset) };
          });
          setViewingAsset((prev) => (prev && prev.assetId === id ? mergeAsset(prev) : prev));
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
      if (currentUser?.userId && socketClient.isConnected()) {
        socketClient.send({
          type: "player:leave",
          payload: {
            pid: currentUser.userId,
          },
        });
        console.log("👋 Sent player leave message on unmount for:", currentUser.userId);
      }
      if (unsubscribePlayerJoin) unsubscribePlayerJoin();
      if (unsubscribePlayerLeave) unsubscribePlayerLeave();
      if (unsubscribeError) unsubscribeError();
      socketConnectedRef.current = false;
      socketClient.disconnect();
      cleanupGodotSession();
    };
  }, [currentUser, roomId, godotConfigSent]);

  // ─── Follow Handlers ───────────────────────────────────────────────

  const handleFollow = (target: User) => {
    if (!target.userId || !iframeRef.current) return;
    sendMessageToIframe(iframeRef.current, "FOLLOW_PLAYER", { clientId: target.userId });
    setFollowingPlayer(target);
    if (currentUser?.userId) {
      socketClient.sendFollow(currentUser.userId, target.userId);
    }
  };

  const handleStopFollow = () => {
    if (iframeRef.current) {
      sendMessageToIframe(iframeRef.current, "STOP_FOLLOW", {});
    }
    if (currentUser?.userId && followingPlayer?.userId) {
      socketClient.sendUnfollow(currentUser.userId, followingPlayer.userId);
    }
    setFollowingPlayer(null);
  };

  const handleStopFollower = (followerId: string) => {
    if (!currentUser?.userId) return;
    socketClient.sendUnfollow(followerId, currentUser.userId);
  };

  const handleStopAllFollowers = () => {
    if (!currentUser?.userId) return;
    socketClient.sendStopAllFollowers(currentUser.userId);
  };

  const handleGoBack = () => {
    // Emit player leave message before navigating
    if (currentUser?.userId && socketClient.isConnected()) {
      socketClient.send({
        type: "player:leave",
        payload: {
          pid: currentUser.userId,
        },
      });
      console.log("👋 Sent player leave message for:", currentUser.userId);
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

  if (error) {
    return (
      <div className="room-page-error">
        <div className="error-container">
          <div className="error-icon" aria-hidden="true">
            <i className="pi pi-exclamation-triangle" />
          </div>
          <h2>Hub unavailable</h2>
          <p>{error}</p>
          <Button icon="pi pi-arrow-left" onClick={handleGoBack}>
            Back to hubs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider roomId={roomId}>
      <div className="room-page">
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
          {/* Custom loading overlay — sits on top of the iframe while Godot
              boots so the user sees a unified progress UI instead of the
              default Godot splash + our "Loading room..." screen. Stays
              mounted (with fade-out) until every stage reports done. */}
          <GameLoadingOverlay
            stages={loadingStages}
            currentMessage={loadingMessage}
            visible={!allLoaded}
          />
          {/* In-session loader — small toast for late-arriving LOADING_PROGRESS
              events (scene swaps, deferred asset loads). Replaces the
              full-screen splash for anything that happens after the initial
              hub load completes. */}
          <InlineLoadingToast
            visible={showInlineLoader}
            message={loadingMessage}
          />
          {/* Only one of player/asset cards is ever visible — selecting
              another in the world replaces the previous one. */}
          {selectedPlayerId && (
            <PlayerCard
              user={selectedPlayer}
              onFollow={handleFollow}
              onClose={closeActiveCard}
            />
          )}
          {selectedAssetId && (
            <AssetCard
              asset={selectedAsset}
              onClose={closeActiveCard}
              onView={(a) => setViewingAsset(a)}
            />
          )}
          {/* Public chat overlay — bottom-left, fades messages upward */}
          {currentUser?.userId && (
            <PublicChatOverlay
              senderId={currentUser.userId}
              senderName={currentUser.username}
            />
          )}
        </div>

        <Sidebar
          onLeaveHub={handleGoBack}
          roomName={room?.name}
          roomDescription={room?.description}
          roomAdmin={roomHost?.username ?? room?.userId}
          roomId={roomId}
          iframeRef={iframeRef}
          onViewAsset={(a) => setViewingAsset(a)}
        />
      </div>

      {/* Touch placement controls — drag the ghost in the game, then commit. */}
      {placingAssetId && isTouchDevice && (
        <PlacementBar
          onCancel={() => {
            if (iframeRef.current) {
              sendMessageToIframe(iframeRef.current, "CANCEL_ASSET_PLACEMENT", {});
            }
            setPlacingAssetId(null);
          }}
        />
      )}

      {/* Asset full-screen viewer */}
      {viewingAsset && (
        <AssetViewerModal
          asset={viewingAsset}
          onClose={() => setViewingAsset(null)}
        />
      )}

      {/* Floating private chat windows — stacked at bottom-right */}
      <ChatWindowsLayer />

      {/* Following banner — bottom center (shown to the player who is following) */}
      {followingPlayer && (
        <FollowingBanner target={followingPlayer} onStopFollow={handleStopFollow} />
      )}

      {/* Followed-by banner — bottom left (shown to the player being followed) */}
      <FollowedByBanner
        followers={followerIds.map((id) => followersMap[id]).filter(Boolean) as User[]}
        onStopFollower={handleStopFollower}
        onStopAllFollowers={handleStopAllFollowers}
      />
    </ChatProvider>
  );
}
