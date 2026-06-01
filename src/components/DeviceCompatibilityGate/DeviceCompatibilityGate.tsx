import { useEffect, useState, type ReactNode } from "react";
import "./DeviceCompatibilityGate.css";

// We only want to block phones and pure-touch tablets — NOT laptops, including
// touchscreen laptops, 2-in-1s, and desktops with a touchscreen. So the gate is
// about "is this a big-screen / pointer-equipped device", not "is touch
// present".
//
// Allow when EITHER holds (comma = logical OR in a media query):
//   • a fine pointer exists anywhere (any-pointer: fine) — a mouse or trackpad,
//     which every laptop/desktop has even if it also has a touchscreen. This
//     also lets a desktop user keep working in a narrow browser window.
//   • the viewport is ≥ 1024px wide — covers touchscreen laptops / desktop-touch
//     where the emulated/primary pointer reports coarse and hides the fine one.
//
// Phones and portrait tablets have neither a fine pointer nor a wide viewport,
// so they're blocked. A landscape tablet ≥ 1024px slips through, but that's an
// acceptable trade vs. wrongly blocking laptops. We intentionally do NOT look at
// maxTouchPoints, which is what was rejecting touchscreen laptops.
const COMPATIBLE_QUERY = "(min-width: 1024px), (any-pointer: fine)";

const computeCompatible = (): boolean => {
  if (typeof window === "undefined") return true;
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
