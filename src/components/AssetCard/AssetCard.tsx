import { useEffect, useRef, useState } from "react";
import type { Asset, AssetWithUrl, User } from "@/types";
import { userService } from "@/services/api";
import { assetViewableUrls } from "@/utils/assetUrl";
import "./AssetCard.css";

interface AssetCardProps {
  asset: AssetWithUrl | null;
  onClose: () => void;
  onView: (asset: Asset) => void;
}

// AssetCard is the small overlay that appears when a user clicks a placed
// asset in the world. It shows a type-appropriate thumbnail, caption,
// creator, and views/likes counts; "View" opens the full media in
// AssetViewerModal. When asset is null the card renders a loading shell so
// users get immediate feedback while we fetch details from the API.
export default function AssetCard({ asset, onClose, onView }: AssetCardProps) {
  const [creator, setCreator] = useState<User | null>(null);

  useEffect(() => {
    if (!asset?.userId) return;
    let cancelled = false;
    userService
      .getById(asset.userId)
      .then((data) => { if (!cancelled && data) setCreator(data); })
      .catch(() => { /* leave creator null on failure */ });
    return () => { cancelled = true; };
  }, [asset?.userId]);

  if (!asset) {
    return (
      <div className="asset-card">
        <button className="asset-card-close" onClick={onClose} aria-label="Close">
          <i className="pi pi-times" />
        </button>
        <div className="asset-card-loading">
          <div className="asset-card-skeleton asset-card-skeleton-preview" />
          <div className="asset-card-skeleton asset-card-skeleton-line" />
        </div>
      </div>
    );
  }

  return (
    <div className="asset-card">
      <button className="asset-card-close" onClick={onClose} aria-label="Close">
        <i className="pi pi-times" />
      </button>

      <AssetThumbnail asset={asset} />

      <div className="asset-card-meta">
        <p className="asset-card-creator">
          placed by <span>{creator?.username ?? asset.userId.slice(0, 6)}</span>
        </p>
        <p className="asset-card-stats">
          <span><i className="pi pi-eye" /> {asset.viewsCount ?? 0}</span>
          <span><i className="pi pi-heart" /> {asset.likesCount ?? 0}</span>
        </p>
      </div>


      <button
        className="asset-card-view-btn"
        onClick={() => onView(asset)}
        type="button"
      >
        <i className="pi pi-external-link" /> View
      </button>

    </div>
  );
}

// Type-specific small thumbnail at the top of the card.
//   IMAGE  -> first image
//   VIDEO  -> middle-frame screenshot
//   DOC    -> document icon
//   LINK   -> link icon
function AssetThumbnail({ asset }: { asset: AssetWithUrl }) {
  const urls = assetViewableUrls(asset);
  if (asset.type === "IMAGE" && urls.length > 0) {
    return (
      <img
        src={urls[0]}
        alt={asset.caption || asset.assetId}
        className="asset-card-preview asset-card-preview-image"
      />
    );
  }
  if (asset.type === "VIDEO" && urls.length > 0) {
    return <VideoMiddleFrame src={urls[0]} />;
  }
  if (asset.type === "LINK") {
    return (
      <div className="asset-card-preview asset-card-preview-doc">
        <i className="pi pi-link" />
      </div>
    );
  }
  // DOC and fallback — generic doc icon.
  return (
    <div className="asset-card-preview asset-card-preview-doc">
      <i className="pi pi-file" />
    </div>
  );
}

// VideoMiddleFrame renders a <video> tag that displays the middle frame.
// We seek to duration/2 once metadata is available; if duration isn't yet
// known we fall back to frame 0.
function VideoMiddleFrame({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const handler = () => {
      try {
        v.currentTime = isFinite(v.duration) && v.duration > 0 ? v.duration / 2 : 0;
      } catch { /* some codecs throw if not yet seekable */ }
    };
    v.addEventListener("loadedmetadata", handler);
    return () => v.removeEventListener("loadedmetadata", handler);
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="metadata"
      className="asset-card-preview asset-card-preview-video"
    />
  );
}
