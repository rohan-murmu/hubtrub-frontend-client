import { useEffect, useState } from "react";
import "./ReviewPopup.css";

interface ReviewPopupProps {
  /** Persist the review. Resolves on success; rejects so we can surface an error. */
  onSubmit: (review: string) => Promise<void>;
  /** Dismiss without submitting ("Maybe later" / close / ESC / backdrop). */
  onDismiss: () => void;
}

const MAX_LEN = 4000;

// In-app product-feedback prompt that surfaces after a user has explored the
// platform for a while. Text-only — a single free-text suggestion. Closing
// without submitting counts as "seen" upstream, so this only ever shows once.
export default function ReviewPopup({ onSubmit, onDismiss }: ReviewPopupProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC dismisses, matching the asset viewer's affordance.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [busy, onDismiss]);

  const trimmed = text.trim();

  const handleSubmit = async () => {
    if (busy || trimmed === "") return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      setDone(true);
      // Let the thank-you land before unmounting.
      window.setTimeout(onDismiss, 1400);
    } catch {
      setError("Couldn't send your feedback. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div
      className="review-popup-overlay"
      onClick={() => { if (!busy) onDismiss(); }}
    >
      <div
        className="review-popup-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Share your feedback"
      >
        {!busy && (
          <button
            className="review-popup-close"
            onClick={onDismiss}
            aria-label="Close"
            type="button"
          >
            <i className="pi pi-times" />
          </button>
        )}

        {done ? (
          <div className="review-popup-thanks">
            <div className="review-popup-thanks-icon">
              <i className="pi pi-check-circle" />
            </div>
            <h2 className="review-popup-title">Thank you!</h2>
            <p className="review-popup-subtitle">
              Your feedback helps us make Hubtrub better.
            </p>
          </div>
        ) : (
          <>
            <div className="review-popup-badge">
              <i className="pi pi-comment" />
            </div>
            <h2 className="review-popup-title">Enjoying Hubtrub?</h2>
            <p className="review-popup-subtitle">
              You've been exploring for a bit — we'd love to hear what you think.
              Drop a quick suggestion to help us improve.
            </p>

            <textarea
              className="review-popup-textarea"
              placeholder="What's working well? What could be better?"
              value={text}
              maxLength={MAX_LEN}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              autoFocus
              disabled={busy}
            />

            {error && <p className="review-popup-error">{error}</p>}

            <div className="review-popup-actions">
              <button
                className="review-popup-btn ghost"
                onClick={onDismiss}
                type="button"
                disabled={busy}
              >
                Maybe later
              </button>
              <button
                className="review-popup-btn accent"
                onClick={handleSubmit}
                type="button"
                disabled={busy || trimmed === ""}
              >
                {busy ? "Sending…" : "Send feedback"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
