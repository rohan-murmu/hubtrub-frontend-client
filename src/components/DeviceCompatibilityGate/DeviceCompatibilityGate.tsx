import { useEffect, useState, type ReactNode } from "react";
import "./DeviceCompatibilityGate.css";

// Allow only:
//   • viewport ≥ 1024px
//   • primary pointer is fine (mouse / trackpad)
//   • real hover support
//   • NO coarse pointer available at all (rejects touchscreen
//     laptops, 2-in-1s with detachable keyboards, etc.)
const COMPATIBLE_QUERY =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine) and (not (any-pointer: coarse))";

// JS-side belt-and-suspenders: navigator.maxTouchPoints is the most
// reliable signal across browsers for whether a touchscreen is
// physically attached. Anything > 0 means the device can be poked
// with a finger — block it.
const isTouchCapable = (): boolean => {
  if (typeof navigator === "undefined") return false;
  if ((navigator.maxTouchPoints ?? 0) > 0) return true;
  // Older WebKit fallback
  if ("ontouchstart" in window) return true;
  return false;
};

const computeCompatible = (): boolean => {
  if (typeof window === "undefined") return true;
  if (isTouchCapable()) return false;
  return window.matchMedia(COMPATIBLE_QUERY).matches;
};

interface Props {
  children: ReactNode;
}

export default function DeviceCompatibilityGate({ children }: Props) {
  const [compatible, setCompatible] = useState<boolean>(computeCompatible);

  useEffect(() => {
    const mql = window.matchMedia(COMPATIBLE_QUERY);
    const recompute = () => setCompatible(computeCompatible());
    mql.addEventListener("change", recompute);
    // Also re-check on resize for browsers that don't fire the
    // matchMedia listener on every viewport change.
    window.addEventListener("resize", recompute);
    return () => {
      mql.removeEventListener("change", recompute);
      window.removeEventListener("resize", recompute);
    };
  }, []);

  if (compatible) return <>{children}</>;

  return (
    <div className="device-gate" role="alertdialog" aria-modal="true">
      <div className="device-gate-card">
        <svg
          className="device-gate-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="3" width="20" height="13" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>

        <h1 className="device-gate-title">Desktop only — for now</h1>
        <p className="device-gate-lead">
          Hubtrub is built for desktops and laptops. Mobile and tablet
          support is coming soon.
        </p>
        <p className="device-gate-hint">
          Please open this link on a larger screen with a mouse or trackpad
          to continue.
        </p>

        <div className="device-gate-tag">Coming soon</div>
      </div>
    </div>
  );
}
