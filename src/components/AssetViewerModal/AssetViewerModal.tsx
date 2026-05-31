import { useEffect, useRef, useState } from "react";
import type { AssetWithUrl } from "@/types";
import { assetService } from "@/services/api";
import { assetViewableUrls, prepareLinkEmbed } from "@/utils/assetUrl";
import { useCurrentUser } from "@/context/UserContext";
import { isGuest } from "@/utils/isGuest";
import "./AssetViewerModal.css";

interface AssetViewerModalProps {
  asset: AssetWithUrl;
  onClose: () => void;
}

// True when the URL points at our own backend (and so isn't reachable from
// Google's docs viewer service in local dev). We surface a download fallback
// for Office docs in that case.
const isLocalUrl = (url: string): boolean => {
  try {
    const u = new URL(url, window.location.origin);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname.endsWith(".local");
  } catch {
    return false;
  }
};

const isPdfUrl = (url: string): boolean => /\.pdf(\?|#|$)/i.test(url);

export default function AssetViewerModal({ asset, onClose }: AssetViewerModalProps) {
  const caption = asset.caption || asset.assetId;
  const urls = assetViewableUrls(asset);
  const firstUrl = urls[0] ?? "";
  const linkUrl = asset.type === "LINK" ? (asset.data?.[0]?.url ?? "") : "";

  // Track local counts so the heart/eye stats reflect the user's latest
  // action immediately, without waiting for the WS asset:update echo.
  const [viewsCount, setViewsCount] = useState(asset.viewsCount ?? 0);
  const [likesCount, setLikesCount] = useState(asset.likesCount ?? 0);
  const [liked, setLiked] = useState<boolean>(asset.likedByMe ?? false);
  const [busyLike, setBusyLike] = useState(false);
  const viewSent = useRef(false);

  // Guests get a read-only view: they can see the like count but can't toggle
  // it. The server rejects guest likes with 403 — we gate here too so the
  // button reads as disabled rather than failing silently on click.
  const guest = isGuest(useCurrentUser());

  // Record one view per modal open. Idempotent on the server, but we also
  // guard locally so React strict-mode double-mount doesn't fire two requests.
  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    assetService
      .recordView(asset.assetId)
      .then((r) => setViewsCount(r.viewsCount))
      .catch(() => { /* non-critical */ });
  }, [asset.assetId]);

  // ESC to close.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleLike = async () => {
    if (busyLike || guest) return;
    setBusyLike(true);
    try {
      const r = await assetService.toggleLike(asset.assetId);
      setLiked(r.liked);
      setLikesCount(r.likesCount);
    } catch { /* ignore */ }
    setBusyLike(false);
  };

  return (
    <div className="asset-viewer-overlay" onClick={onClose}>
      <div className="asset-viewer-frame" onClick={(e) => e.stopPropagation()}>
        <div className="asset-viewer-header">
          <button className="asset-viewer-close" onClick={onClose} aria-label="Close">
            <i className="pi pi-times" />
          </button>
        </div>

        <div className="asset-viewer-body">
          {asset.type === "IMAGE" && urls.length > 0 && (
            <ImageSlider urls={urls} caption={caption} />
          )}

          {asset.type === "VIDEO" && firstUrl && (
            <video src={firstUrl} controls autoPlay className="asset-viewer-video" />
          )}

          {asset.type === "AUDIO" && firstUrl && (
            <audio src={firstUrl} controls autoPlay className="asset-viewer-audio" />
          )}

          {asset.type === "LINK" && linkUrl && (() => {
            const embed = prepareLinkEmbed(linkUrl);
            if (!embed.embeddable) {
              return (
                <div className="asset-viewer-fallback">
                  <p>
                    This site can't be embedded here (it blocks iframes).
                    Open it in a new tab to view.
                  </p>
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="asset-viewer-download"
                  >
                    Open link
                  </a>
                  <p className="asset-viewer-fallback-url">{linkUrl}</p>
                </div>
              );
            }
            return (
              <iframe
                src={embed.url}
                title={caption}
                className="asset-viewer-iframe"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            );
          })()}

          {asset.type === "DOC" && firstUrl && (
            isPdfUrl(firstUrl) ? (
              <iframe
                src={firstUrl}
                title={caption}
                className="asset-viewer-iframe"
              />
            ) : isLocalUrl(firstUrl) ? (
              <div className="asset-viewer-fallback">
                <p>
                  Office document previews require a publicly reachable URL.
                  This file is hosted locally — open it directly:
                </p>
                <a href={firstUrl} target="_blank" rel="noreferrer" className="asset-viewer-download">
                  Download / open
                </a>
              </div>
            ) : (
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(firstUrl)}&embedded=true`}
                title={caption}
                className="asset-viewer-iframe"
              />
            )
          )}
        </div>

        <div className="asset-viewer-footer">
          {caption && (
            <p className="asset-viewer-footer-caption">{caption}</p>
          )}
          <div className="asset-viewer-footer-stats">
            <button
              className={`asset-viewer-like-btn ${liked ? "liked" : ""}`}
              onClick={handleLike}
              disabled={busyLike || guest}
              type="button"
              aria-pressed={liked}
              title={guest ? "Sign up to like assets" : liked ? "Unlike" : "Like"}
            >
              <i className={liked ? "pi pi-heart-fill" : "pi pi-heart"} /> {likesCount}
            </button>
            <span className="asset-viewer-views">
              <i className="pi pi-eye" /> {viewsCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple slider that lets the user step through multiple images.
function ImageSlider({ urls, caption }: { urls: string[]; caption: string }) {
  const [idx, setIdx] = useState(0);
  if (urls.length === 1) {
    return <img src={urls[0]} alt={caption} className="asset-viewer-image" />;
  }
  return (
    <div className="asset-viewer-slider">
      <button
        className="asset-viewer-slider-nav prev"
        onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
        aria-label="Previous image"
      >
        <i className="pi pi-chevron-left" />
      </button>
      <img src={urls[idx]} alt={`${caption} ${idx + 1}/${urls.length}`} className="asset-viewer-image" />
      <button
        className="asset-viewer-slider-nav next"
        onClick={() => setIdx((i) => (i + 1) % urls.length)}
        aria-label="Next image"
      >
        <i className="pi pi-chevron-right" />
      </button>
      <div className="asset-viewer-slider-dots">
        {urls.map((_, i) => (
          <span key={i} className={`dot ${i === idx ? "active" : ""}`} />
        ))}
      </div>
    </div>
  );
}
