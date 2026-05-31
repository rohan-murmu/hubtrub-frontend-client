import { useEffect, useRef, useState } from "react";
import "./InlineLoadingToast.css";

interface InlineLoadingToastProps {
  /** When true, the toast is visible. The component animates in/out on change. */
  visible: boolean;
  /** Text shown next to the spinner. */
  message?: string;
}

/** Tiny corner toast that replaces the full-screen GameLoadingOverlay for
 *  loading events that happen *after* the initial hub load (scene swaps,
 *  late asset spawns, etc.). Stays mounted briefly after `visible` flips
 *  false so the slide-out animation can play. */
export default function InlineLoadingToast({ visible, message }: InlineLoadingToastProps) {
  const [mounted, setMounted] = useState(visible);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (fadeTimer.current) {
        window.clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
    } else {
      fadeTimer.current = window.setTimeout(() => setMounted(false), 280);
    }
    return () => {
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    };
  }, [visible]);

  if (!mounted) return null;

  return (
    <div className={`inline-loading-toast ${visible ? "" : "is-hiding"}`} role="status" aria-live="polite">
      <span className="inline-loading-spinner" aria-hidden />
      <span className="inline-loading-text">{message || "Working…"}</span>
    </div>
  );
}
