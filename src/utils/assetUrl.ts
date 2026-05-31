// Helpers for building viewable URLs from asset file keys and detecting an
// asset's type from a chosen file. The backend stores file *keys* (relative
// GCS object paths) and signs them on demand, but signed URLs expire after
// 15min — if the signed URL the wire payload carried is stale by the time the
// React modal opens, we fall back to the public bucket URL built here.

import type { Asset, AssetTypeEnum, AssetWithUrl } from '@/types';

export const GCS_PREFIX = 'https://storage.googleapis.com/hubtrub-bucket/';
const GCS_HOST = 'storage.googleapis.com';

const KNOWN_EXTS = [
  'png', 'jpg', 'jpeg', 'webp', 'gif',
  'mp4', 'webm', 'mov',
  'mp3', 'ogg', 'weba',
  'pdf', 'doc', 'docx', 'ppt', 'pptx',
];

/** Strip everything after the file extension on an uploaded GCS URL while
 *  leaving external (LINK) URLs untouched.
 *
 *  Signed read URLs carry query params like `?X-Goog-Algorithm=…&…` which the
 *  bucket also serves without — keeping only the path up to the extension
 *  yields a clean URL that's stable across renders and works with the
 *  publicly-readable bucket. External LINK destinations (e.g. monday.com)
 *  may need their full URL (path + query + fragment) so we leave them alone. */
export function cleanAssetUrl(url: string): string {
  if (!url) return '';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.host !== GCS_HOST) return url;

  // Find the last known extension in the path and truncate everything after it.
  const path = parsed.pathname;
  const lower = path.toLowerCase();
  for (const ext of KNOWN_EXTS) {
    const idx = lower.lastIndexOf(`.${ext}`);
    if (idx === -1) continue;
    // Only count when the extension ends the path or is followed by '/'.
    const end = idx + ext.length + 1;
    if (end === path.length || path[end] === '/') {
      return `${parsed.origin}${path.slice(0, end)}`;
    }
  }
  // No known extension matched — drop query params anyway since they're
  // typically the signed-URL boilerplate.
  return `${parsed.origin}${path}`;
}

/** Turn a file key (or already-absolute URL) into something an <img>/<video> can load. */
export function assetFileUrl(keyOrUrl: string): string {
  if (!keyOrUrl) return '';
  if (keyOrUrl.startsWith('http://') || keyOrUrl.startsWith('https://')) {
    return cleanAssetUrl(keyOrUrl);
  }
  return GCS_PREFIX + keyOrUrl;
}

/** Build the list of viewable URLs for an asset, preferring fresh signed URLs
 *  from the wire payload and falling back to the public bucket prefix. For
 *  LINK assets the data.url is already an external destination and is
 *  returned as-is. */
export function assetViewableUrls(asset: AssetWithUrl | Asset): string[] {
  const withUrl = asset as AssetWithUrl;
  const data = asset.data ?? [];
  if (withUrl.urls && withUrl.urls.length === data.length) {
    return withUrl.urls.map((u, i) => {
      const raw = u || assetFileUrl(data[i]?.url ?? '');
      return cleanAssetUrl(raw);
    });
  }
  return data.map((d) => assetFileUrl(d.url));
}

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov']);
const DOC_EXT = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx']);

/** Map a File's extension to an asset type. Throws when the extension isn't
 *  one we support — callers surface that to the user as a validation error. */
export function detectAssetType(file: File): AssetTypeEnum {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (IMAGE_EXT.has(ext)) return 'IMAGE';
  if (VIDEO_EXT.has(ext)) return 'VIDEO';
  if (DOC_EXT.has(ext)) return 'DOC';
  throw new Error(`Unsupported file type: .${ext || '(none)'}`);
}

/** Result of preparing an external LINK URL for embedding in our viewer iframe.
 *  Many sites (YouTube, Twitter/X, LinkedIn, Instagram, most news sites) ship
 *  X-Frame-Options or frame-ancestors headers that block raw embedding. For the
 *  ones we recognise we rewrite to a known embed URL; everything else gets the
 *  original URL plus `embeddable: false` so the UI can offer an "open in new
 *  tab" fallback. */
export interface EmbedLink {
  url: string;
  embeddable: boolean;
  /** Provider name when we matched a known pattern (e.g. "YouTube"). */
  provider?: string;
}

/** Extract a YouTube video ID from any of the common URL shapes:
 *  watch?v=, youtu.be/<id>, /shorts/<id>, /embed/<id>, /live/<id>. */
function youtubeVideoId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = u.pathname.split('/').filter(Boolean)[0];
    return id || null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live')) {
      return parts[1];
    }
  }
  return null;
}

function vimeoVideoId(u: URL): string | null {
  if (!u.hostname.endsWith('vimeo.com')) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  // https://vimeo.com/<id> or https://player.vimeo.com/video/<id>
  if (u.hostname.startsWith('player.')) {
    if (parts[0] === 'video' && parts[1]) return parts[1];
    return null;
  }
  const id = parts[0];
  return /^\d+$/.test(id ?? '') ? id : null;
}

/** Rewrite a user-supplied LINK URL into something an <iframe> can actually
 *  show. Returns `embeddable: false` for unknown hosts so callers can fall
 *  back to opening the link in a new tab instead of rendering a blank frame. */
export function prepareLinkEmbed(rawUrl: string): EmbedLink {
  if (!rawUrl) return { url: '', embeddable: false };
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { url: rawUrl, embeddable: false };
  }

  // YouTube
  const ytId = youtubeVideoId(u);
  if (ytId) {
    const params = new URLSearchParams();
    const t = u.searchParams.get('t') ?? u.searchParams.get('start');
    if (t) {
      // YouTube accepts plain seconds; strip a trailing 's' if present ("90s" → "90").
      const secs = t.replace(/s$/, '');
      if (/^\d+$/.test(secs)) params.set('start', secs);
    }
    const qs = params.toString();
    return {
      url: `https://www.youtube.com/embed/${ytId}${qs ? `?${qs}` : ''}`,
      embeddable: true,
      provider: 'YouTube',
    };
  }

  // Vimeo
  const vimId = vimeoVideoId(u);
  if (vimId) {
    return {
      url: `https://player.vimeo.com/video/${vimId}`,
      embeddable: true,
      provider: 'Vimeo',
    };
  }

  // Loom
  if (u.hostname.endsWith('loom.com')) {
    const m = u.pathname.match(/^\/(share|embed)\/([a-z0-9]+)/i);
    if (m) {
      return {
        url: `https://www.loom.com/embed/${m[2]}`,
        embeddable: true,
        provider: 'Loom',
      };
    }
  }

  // Spotify (track / playlist / album / episode / show)
  if (u.hostname === 'open.spotify.com') {
    return {
      url: `https://open.spotify.com/embed${u.pathname}${u.search}`,
      embeddable: true,
      provider: 'Spotify',
    };
  }

  // SoundCloud
  if (u.hostname.endsWith('soundcloud.com')) {
    return {
      url: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}`,
      embeddable: true,
      provider: 'SoundCloud',
    };
  }

  // Google Maps / Docs / Sheets / Slides — they support /embed paths but we
  // can't reliably rewrite an arbitrary share link, so leave as-is and let the
  // iframe attempt it. Google's own /embed and /preview URLs work fine.
  if (u.hostname.endsWith('google.com') && /\/(embed|preview)(\b|\/)/.test(u.pathname)) {
    return { url: rawUrl, embeddable: true, provider: 'Google' };
  }

  // CodePen / CodeSandbox / JSFiddle / GitHub Gist — known to allow embeds
  // when the URL points at their embed endpoint. We pass through anything that
  // already contains "/embed" in the path and otherwise mark as non-embeddable.
  const safeFramedHosts = ['codesandbox.io', 'codepen.io', 'jsfiddle.net', 'github.io'];
  if (safeFramedHosts.some((h) => u.hostname.endsWith(h))) {
    return { url: rawUrl, embeddable: true, provider: u.hostname };
  }

  // Anything else: we don't know if the target sends X-Frame-Options/CSP, so
  // bail out and let the UI render the open-in-new-tab fallback rather than a
  // blank iframe.
  return { url: rawUrl, embeddable: false };
}

/** Quickly verify every file in a batch shares the same detected type — used
 *  before multi-file upload so we never mix images and videos in one asset. */
export function detectBatchAssetType(files: File[]): AssetTypeEnum {
  if (files.length === 0) throw new Error('no files selected');
  const first = detectAssetType(files[0]);
  for (let i = 1; i < files.length; i++) {
    if (detectAssetType(files[i]) !== first) {
      throw new Error('all files must be the same type');
    }
  }
  if (files.length > 1 && first !== 'IMAGE') {
    throw new Error('only IMAGE assets can have multiple files');
  }
  return first;
}
