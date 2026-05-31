import { useEffect, useRef, useState } from "react";
import "./GameLoadingOverlay.css";

export type LoadingStageId =
  | "fetch_room"
  | "engine_download"
  | "engine_ready"
  | "ws_connect"
  | "world_render"
  | "load_assets"
  | "load_players"
  | "ready";

export type StageStatus = "pending" | "active" | "done";

export interface LoadingStage {
  id: LoadingStageId;
  label: string;
  status: StageStatus;
  // Optional sub-progress (e.g. wasm download bytes, "3/8 assets").
  detail?: string;
}

interface Props {
  stages: LoadingStage[];
  currentMessage: string;
  visible: boolean;
}

const STAGE_ICON: Record<StageStatus, string> = {
  pending: "○",
  active: "◐",
  done: "●",
};

export default function GameLoadingOverlay({ stages, currentMessage, visible }: Props) {
  // Keep the overlay mounted briefly after `visible` flips false so the
  // fade-out animation can play before React unmounts it.
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
      fadeTimer.current = window.setTimeout(() => setMounted(false), 450);
    }
    return () => {
      if (fadeTimer.current) window.clearTimeout(fadeTimer.current);
    };
  }, [visible]);

  if (!mounted) return null;

  const doneCount = stages.filter((s) => s.status === "done").length;
  const percent = Math.round((doneCount / stages.length) * 100);

  return (
    <div className={`game-loading-overlay ${visible ? "" : "is-fading"}`}>
      <div className="game-loading-card">
        <div className="game-loading-title">Entering Hub</div>

        <div className="game-loading-bar">
          <div className="game-loading-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <div className="game-loading-percent">{percent}%</div>

        <ul className="game-loading-steps">
          {stages.map((stage) => (
            <li key={stage.id} className={`game-loading-step is-${stage.status}`}>
              <span className="game-loading-icon">{STAGE_ICON[stage.status]}</span>
              <span className="game-loading-label">{stage.label}</span>
              {stage.detail && (
                <span className="game-loading-detail">{stage.detail}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="game-loading-message" aria-live="polite">
          {currentMessage ? `> ${currentMessage}` : " "}
        </div>
      </div>
    </div>
  );
}
