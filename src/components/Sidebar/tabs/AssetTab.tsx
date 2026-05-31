import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import { useNavigate } from "react-router-dom";
import { assetService, authService } from "@/services/api";
import type { Asset, AssetTypeEnum, AssetWithUrl } from "@/types";
import { sendMessageToIframe, listenToIframeMessages } from "@/utils/godotBridge";
import { socketClient } from "@/services/socketClient";
import { detectBatchAssetType, assetViewableUrls } from "@/utils/assetUrl";
import { useCurrentUser } from "@/context/UserContext";
import { useAuth } from "@/context/AuthContext";
import { firebaseSignOut } from "@/lib/firebase";
import { isGuest } from "@/utils/isGuest";
import "./AssetTab.css";

interface AssetTabProps {
  roomId: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onViewAsset: (asset: Asset) => void;
}

const CAPTION_MAX = 200;
const MAX_IMAGES = 5;

// Map each asset type to a PrimeIcon. Centralised so the create form, the
// MyAssetPanel meta badge, and any future surface stay in sync.
const ASSET_TYPE_ICON: Record<AssetTypeEnum, string> = {
  IMAGE: "pi-image",
  VIDEO: "pi-video",
  AUDIO: "pi-volume-up",
  DOC: "pi-file",
  LINK: "pi-link",
};

// AssetTab is the room sidebar's upload + management slot. Each user can have
// exactly ONE active asset per room (DRAFT or PLACED). The tab has two modes:
//
//   - No asset yet  → CreateAssetForm with Upload/Link source toggle. The
//                     Upload dropzone auto-detects asset type by file extension;
//                     IMAGE allows multi-select, others enforce single file.
//   - Has an asset  → MyAssetPanel showing the asset, its views/likes,
//                     and Place/Edit/Delete actions. Edit toggles back to the
//                     form with prefilled fields.
export default function AssetTab({ roomId, iframeRef, onViewAsset }: AssetTabProps) {
  const user = useCurrentUser();
  const guest = isGuest(user);
  const [myAsset, setMyAsset] = useState<AssetWithUrl | null>(null);
  const [loading, setLoading] = useState(true);
  // ID of the asset Godot currently has in placement mode. We rely on this
  // (instead of asset.status === DRAFT) to decide whether the "Place in world"
  // CTA shows, so the button doesn't flicker on the round-trip between
  // ASSET_PLACED → backend → asset:update broadcast → refresh.
  const [placingId, setPlacingId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const a = await assetService.getMyAssetInRoom(roomId);
      setMyAsset(a);
    } catch (err) {
      console.error("Failed to load room asset:", err);
      setMyAsset(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // The server broadcasts asset:create/update/delete on the game socket; UI
    // listeners refresh on each so likes/views/status changes are reflected.
    const offCreate = socketClient.onAssetCreate(refresh);
    const offUpdate = socketClient.onAssetUpdate(refresh);
    const offDelete = socketClient.onAssetDelete(refresh);

    // Listen to iframe messages so the UI updates the moment Godot reports
    // the placement, instead of waiting for the HTTP round-trip + socket
    // broadcast (which is what caused "Place in world" to flash back on
    // before the backend caught up).
    const offIframe = listenToIframeMessages((message) => {
      if (!message?.payload?.assetId) return;

      if (message.type === "ASSET_PLACED") {
        const placedId: string = message.payload.assetId;
        setPlacingId((cur) => (cur === placedId ? null : cur));
        // Optimistic status flip — backend's asset:update broadcast will
        // confirm + sync xpos/ypos shortly. Doing this in the same tick as
        // clearing placingId avoids the gap where the status is still DRAFT
        // and the "Place in world" CTA would re-render.
        setMyAsset((prev) =>
          prev && prev.assetId === placedId && prev.status !== "PLACED"
            ? { ...prev, status: "PLACED" }
            : prev,
        );
      } else if (message.type === "ASSET_PLACEMENT_CANCELLED") {
        setPlacingId((cur) => (cur === message.payload.assetId ? null : cur));
      }
    });

    return () => { offCreate(); offUpdate(); offDelete(); offIframe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const handlePlace = (asset: AssetWithUrl) => {
    if (!iframeRef.current) return;
    const firstUrl = assetViewableUrls(asset)[0] ?? "";
    sendMessageToIframe(iframeRef.current, "START_ASSET_PLACEMENT", {
      assetId: asset.assetId,
      type: asset.type,
      url: firstUrl,
      caption: asset.caption,
    });
    setPlacingId(asset.assetId);
  };

  const handleDelete = async (assetId: string) => {
    try {
      await assetService.deleteAsset(assetId);
      setMyAsset(null);
      setPlacingId(null);
    } catch (err: any) {
      console.error("Failed to delete asset:", err);
      throw err; // let MyAssetPanel reset its "deleting" state on failure
    }
  };

  // Relocate the existing asset — same flow as initial placement, just on
  // an already-PLACED asset. Backend's place endpoint accepts re-positioning.
  const handleRelocate = () => {
    if (!myAsset) return;
    handlePlace(myAsset);
  };

  if (guest) {
    return (
      <div className="asset-tab">
        <div className="asset-header-title">
          <span className="asset-eyebrow">Asset Manager</span>
          <div className="asset-tab-header"><span>Your Asset</span></div>
        </div>
        <GuestUpgradePanel
          title="Sign up to place assets"
          message="Guests can browse hubs and chat. Create an account to upload images, videos, links and place them in this world."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="asset-tab">
        <div className="asset-header-title">
          <span className="asset-eyebrow">Asset Manager</span>
          <div className="asset-tab-header"><span>Your Asset</span></div>
        </div>
        <div className="asset-loading">
          <div className="asset-loading-meta">
            <div className="asset-loading-chip" />
            <div className="asset-loading-stats">
              <div className="asset-loading-pip" />
              <div className="asset-loading-pip" />
            </div>
          </div>
          <div className="asset-loading-bar tall" />
          <div className="asset-loading-row">
            <div className="asset-loading-bar small" />
            <div className="asset-loading-bar wide" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="asset-tab">
      <div className="asset-header-title">
        <span className="asset-eyebrow">Asset Manager</span>
        <div className="asset-tab-header"><span>Your Asset</span></div>
      </div>
      {myAsset ? (
        <MyAssetPanel
          asset={myAsset}
          isPlacing={placingId === myAsset.assetId}
          onPlace={() => handlePlace(myAsset)}
          onView={() => onViewAsset(myAsset)}
          onRelocate={handleRelocate}
          onDelete={() => handleDelete(myAsset.assetId)}
        />
      ) : (
        <CreateAssetForm
          roomId={roomId}
          iframeRef={iframeRef}
          onCreated={(a) => { setMyAsset(a); }}
        />
      )}
    </div>
  );
}

// ─── MyAssetPanel ──────────────────────────────────────────────────────────

function MyAssetPanel({
  asset,
  isPlacing,
  onPlace,
  onView,
  onRelocate,
  onDelete,
}: {
  asset: AssetWithUrl;
  isPlacing: boolean;
  onPlace: () => void;
  onView: () => void;
  onRelocate: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const isDraft = asset.status === "DRAFT";
  // Three-state delete:
  //   idle      → "Delete"
  //   arming    → "Confirm delete"  (second click commits; auto-disarms after 4s)
  //   deleting  → "Deleting…"       (awaiting the network call)
  const [deleteState, setDeleteState] = useState<"idle" | "arming" | "deleting">("idle");

  useEffect(() => {
    if (deleteState !== "arming") return;
    const t = window.setTimeout(() => setDeleteState("idle"), 4000);
    return () => window.clearTimeout(t);
  }, [deleteState]);

  const handleDeleteClick = async () => {
    if (deleteState === "deleting") return;
    if (deleteState === "arming") {
      setDeleteState("deleting");
      try {
        await onDelete();
        // On success the parent unmounts MyAssetPanel (myAsset → null), so we
        // don't need to flip state back. Reset for the failure path below.
      } catch {
        setDeleteState("idle");
      }
      return;
    }
    setDeleteState("arming");
  };

  const armingDelete = deleteState === "arming";
  const deleting = deleteState === "deleting";

  return (
    <div className="asset-existing">
      <div className="asset-existing-meta">
        <span
          className="asset-existing-type"
          title={asset.type}
          aria-label={`Asset type: ${asset.type}`}
        >
          <i className={`pi ${ASSET_TYPE_ICON[asset.type] ?? "pi-file"}`} />
        </span>
        <span className="asset-existing-stats">
          <i className="pi pi-eye" /> {asset.viewsCount ?? 0}
          {"  "}
          <i className="pi pi-heart" /> {asset.likesCount ?? 0}
        </span>
      </div>

      <div className="asset-existing-actions">
        {isPlacing ? (
          <button className="asset-action-btn primary" disabled type="button">
            <i className="pi pi-spin pi-spinner" /> Placing… click the world
          </button>
        ) : isDraft ? (
          <button className="asset-action-btn primary" onClick={onPlace} type="button" disabled={deleting}>
            <i className="pi pi-map-marker" /> Place in world
          </button>
        ) : (
          <button className="asset-action-btn primary" onClick={onRelocate} type="button" disabled={deleting}>
            <i className="pi pi-refresh" /> Relocate asset
          </button>
        )}
        <div className="asset-existing-row">
          <button
            className="asset-action-btn icon-only"
            onClick={onView}
            type="button"
            disabled={isPlacing || deleting}
            title={asset.type === "LINK" ? "Go to link" : "Full view"}
            aria-label={asset.type === "LINK" ? "Go to link" : "Full view"}
          >
            <i className={`pi ${asset.type === "LINK" ? "pi-external-link" : "pi-window-maximize"}`} />
          </button>
          <button
            className={`asset-action-btn ${deleting ? "danger-confirm" : armingDelete ? "danger-confirm" : "danger"}`}
            onClick={handleDeleteClick}
            type="button"
            disabled={isPlacing || deleting}
            aria-busy={deleting}
          >
            <i
              className={`pi ${
                deleting
                  ? "pi-spin pi-spinner"
                  : armingDelete
                    ? "pi-exclamation-triangle"
                    : "pi-trash"
              }`}
            />
            {deleting ? "Deleting…" : armingDelete ? "Confirm delete" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CreateAssetForm ───────────────────────────────────────────────────────

interface CreateAssetFormProps {
  roomId: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onCreated: (a: AssetWithUrl) => void;
  /** Optional — when present (e.g. after Replace), shows a Cancel button. */
  onCancel?: () => void;
}

// Single-source create form. The user picks ONE input mode — Upload or Link —
// via a top toggle; the other input is unmounted so they can't compete. Asset
// type is inferred from the chosen files' extensions.
type AssetSource = "upload" | "link";

function CreateAssetForm({ roomId, iframeRef, onCreated, onCancel }: CreateAssetFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nextSelectModeRef = useRef<"replace" | "append">("replace");

  const [source, setSource] = useState<AssetSource>("upload");
  const [files, setFiles] = useState<File[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [caption, setCaption] = useState("");

  const [detectedType, setDetectedType] = useState<AssetTypeEnum | null>(null);
  const [uploaded, setUploaded] = useState<AssetWithUrl | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const captionOk = caption.trim().length > 0 && caption.length <= CAPTION_MAX;
  const hasLink = linkUrl.trim().length > 0;

  // Switching source clears any in-flight input from the other mode so we
  // never submit with leftover state behind the inactive tab.
  const switchSource = (next: AssetSource) => {
    if (next === source) return;
    setError(null);
    if (next === "link") {
      setFiles([]);
      setDetectedType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setLinkUrl("");
    }
    setSource(next);
  };


  const acceptFiles = (next: FileList | File[] | null, mode: "replace" | "append" = "replace") => {
    if (!next) return;
    const incoming = Array.from(next);
    if (incoming.length === 0) return;
    try {
      const merged = mode === "append" ? [...files, ...incoming] : incoming;
      const type = detectBatchAssetType(merged);
      const capped = type === "IMAGE" ? merged.slice(0, MAX_IMAGES) : merged;
      setFiles(capped);
      setDetectedType(type);
      setError(
        type === "IMAGE" && merged.length > MAX_IMAGES
          ? `Only ${MAX_IMAGES} images allowed — extras were dropped.`
          : null,
      );
    } catch (err: any) {
      setError(err?.message ?? "Unsupported file selection");
      if (mode === "replace") {
        setFiles([]);
        setDetectedType(null);
      }
    }
  };

  const removeFileAt = (index: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setDetectedType(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
      return next;
    });
    setError(null);
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const mode = nextSelectModeRef.current;
    nextSelectModeRef.current = "replace";
    acceptFiles(e.target.files, mode);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    acceptFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const canSubmit = () => {
    if (submitting || !captionOk) return false;
    return source === "upload" ? files.length > 0 : hasLink;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    setError(null);

    try {
      if (source === "upload") {
        const type = detectedType ?? detectBatchAssetType(files);
        const created = await assetService.uploadFiles(files, roomId, type, caption.trim());
        setUploaded(created);
      } else {
        const created = await assetService.uploadLink(linkUrl.trim(), roomId, caption.trim());
        setUploaded(created);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.error;
      setError(serverMsg || (status ? `Failed (${status})` : err?.message || "Failed"));
    } finally {
      setSubmitting(false);
    }
  };

  // Once created, replace the entire form with a single Place button. The
  // click directly opens placement mode in the world (one tap = one action);
  // we also commit `uploaded` upward so the sidebar swaps to MyAssetPanel
  // while the user is positioning the ghost.
  if (uploaded) {
    const triggerPlacement = () => {
      const firstUrl = assetViewableUrls(uploaded)[0] ?? "";
      if (iframeRef?.current) {
        sendMessageToIframe(iframeRef.current, "START_ASSET_PLACEMENT", {
          assetId: uploaded.assetId,
          type: uploaded.type,
          url: firstUrl,
          caption: uploaded.caption,
        });
      }
      onCreated(uploaded);
    };
    // Skip — the asset is already saved as DRAFT in the backend, so hand it
    // up to the parent so we land directly on MyAssetPanel (same state the
    // user would see on a refresh / tab-switch), instead of resetting to
    // an empty create form for an asset that already exists.
    const skipPlacementNow = () => onCreated(uploaded);
    return (
      <div className="asset-create-form">
        <button
          className="asset-submit-btn"
          type="button"
          onClick={triggerPlacement}
        >
          <i className="pi pi-map-marker" /> Place in world
        </button>
        <button className="asset-action-btn" type="button" onClick={skipPlacementNow}>
          Skip for now
        </button>
      </div>
    );
  }

  return (
    <div className="asset-create-form">
      {/* Source toggle — pick exactly one input mode. */}
      <div className="asset-source-toggle" role="tablist" aria-label="Asset source">
        <button
          type="button"
          role="tab"
          aria-selected={source === "upload"}
          className={`asset-source-btn ${source === "upload" ? "active" : ""}`}
          onClick={() => switchSource("upload")}
        >
          <i className="pi pi-cloud-upload" /> Upload
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={source === "link"}
          className={`asset-source-btn ${source === "link" ? "active" : ""}`}
          onClick={() => switchSource("link")}
        >
          <i className="pi pi-link" /> Link
        </button>
      </div>

      {source === "upload" ? (
        <div
          className={`asset-dropzone ${dragOver ? "drag-over" : ""} ${files.length > 0 ? "has-file" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          role="button"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            multiple
            onChange={handleFileInput}
            hidden
          />
          {files.length === 0 ? (
            <>
              <i className="pi pi-cloud-upload asset-dropzone-icon" />
              <p>Drag &amp; drop or click to browse</p>
              <span className="asset-dropzone-hint">
                images (multi), video, doc · max 100MB each
              </span>
            </>
          ) : detectedType === "IMAGE" ? (
            <div className="asset-image-grid" onClick={(e) => e.stopPropagation()}>
              {files.map((f, i) => (
                <div key={i} className="asset-image-grid-item">
                  <img src={URL.createObjectURL(f)} alt={f.name} />
                  <button
                    type="button"
                    className="asset-image-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFileAt(i);
                    }}
                    aria-label={`Remove ${f.name}`}
                    title="Remove image"
                  >
                    <i className="pi pi-times" />
                  </button>
                </div>
              ))}
              {files.length < MAX_IMAGES && (
                <button
                  type="button"
                  className="asset-image-grid-add"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextSelectModeRef.current = "append";
                    fileInputRef.current?.click();
                  }}
                  title={`Add more images (${files.length}/${MAX_IMAGES})`}
                  aria-label="Add more images"
                >
                  <i className="pi pi-plus" />
                </button>
              )}
            </div>
          ) : (
            <>
              <i className={`pi ${detectedType === "VIDEO" ? "pi-video" : "pi-file"} asset-dropzone-icon`} />
              <p>{files[0].name}</p>
              <span className="asset-dropzone-hint">
                {detectedType} · {(files[0].size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </>
          )}
        </div>
      ) : (
        <input
          type="url"
          className="asset-url-input"
          placeholder="https://example.com"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
        />
      )}

      <div className="asset-caption-wrap">
        <textarea
          className="asset-caption-input"
          placeholder="Caption"
          maxLength={CAPTION_MAX}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={4}
        />
        <span className="asset-caption-count">{caption.length}/{CAPTION_MAX}</span>
      </div>

      {error && <p className="asset-error">{error}</p>}

      <button
        className="asset-submit-btn"
        onClick={handleSubmit}
        disabled={!canSubmit()}
        type="button"
      >
        {submitting ? "Uploading…" : "Upload"}
      </button>

      {onCancel && (
        <button className="asset-action-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

// ─── GuestUpgradePanel ─────────────────────────────────────────────────────
// Shown in place of the create-asset form for guest sessions. Tapping
// "Sign up" tears down the anonymous Firebase session + server cookie before
// routing to /auth so the user lands on a clean signup screen.

function GuestUpgradePanel({ title, message }: { title: string; message: string }) {
  const navigate = useNavigate();
  const { clear: clearAuth } = useAuth();
  const [busy, setBusy] = useState(false);

  const handleSignUp = async () => {
    setBusy(true);
    try {
      await authService.logout();
    } catch { /* server-side clear is best-effort */ }
    try {
      await firebaseSignOut();
    } catch { /* ditto */ }
    clearAuth();
    navigate("/auth");
  };

  return (
    <div className="asset-guest-upgrade">
      <i className="pi pi-lock asset-guest-upgrade__icon" aria-hidden="true" />
      <div className="asset-guest-upgrade__title">{title}</div>
      <p className="asset-guest-upgrade__message">{message}</p>
      <button
        className="asset-action-btn primary"
        type="button"
        onClick={handleSignUp}
        disabled={busy}
      >
        <i className="pi pi-user-plus" /> {busy ? "Signing out…" : "Sign up"}
      </button>
    </div>
  );
}
