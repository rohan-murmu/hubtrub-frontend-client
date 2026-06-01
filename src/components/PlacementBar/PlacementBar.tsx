import "./PlacementBar.css";

interface PlacementBarProps {
  onCancel: () => void;
}

/**
 * Touch-only guidance for asset placement. On phones/tablets the Godot ghost
 * can't follow a hover, so the user taps a spot to preview the asset there and
 * double-taps to drop it. This bar shows the instruction and a Cancel button
 * (which sends CANCEL_ASSET_PLACEMENT to the game).
 */
export default function PlacementBar({ onCancel }: PlacementBarProps) {
  return (
    <div className="placement-bar" role="dialog" aria-label="Place asset">
      <span className="placement-bar-hint">
        <strong>Double-tap</strong> where you want to place the asset
      </span>
      <button
        type="button"
        className="placement-bar-btn placement-bar-cancel"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
