import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { isGuest } from "@/utils/isGuest";
import { reviewService } from "@/services/api";
import ReviewPopup from "./ReviewPopup";

// How much *active* time spent *inside a hub room* (tab focused) a user
// accrues before the feedback popup is armed, and how often we tick. Time
// outside a room does NOT count; a backgrounded tab does NOT count. Once armed,
// the popup only actually appears once the user has left the room.
const DEFAULT_THRESHOLD_SECONDS = 180; // ~3 minutes inside a room
const TICK_SECONDS = 5;

const STORAGE_PREFIX = "hubtrub.review.v1.";
const THRESHOLD_OVERRIDE_KEY = "hubtrub.review.thresholdSeconds";

// Active-seconds threshold before the popup shows. Overridable from the console
// for QA — `localStorage.setItem('hubtrub.review.thresholdSeconds', '10')` —
// without a rebuild. Falls back to 3 minutes for real users.
function thresholdSeconds(): number {
  const override = Number(localStorage.getItem(THRESHOLD_OVERRIDE_KEY));
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_THRESHOLD_SECONDS;
}

interface GateState {
  /** Submitted or dismissed — the popup is done for this account, forever. */
  seen: boolean;
  /** Accrued active seconds spent inside a hub room. */
  seconds: number;
}

const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

function readGate(userId: string): GateState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GateState>;
      return { seen: !!parsed.seen, seconds: Number(parsed.seconds) || 0 };
    }
  } catch { /* corrupt entry — start fresh */ }
  return { seen: false, seconds: 0 };
}

function writeGate(userId: string, state: GateState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch { /* storage full / disabled — non-critical */ }
}

// True for the immersive room view (/hub/:roomId), where the popup must never
// appear. /hub, /hub/create, and /hub/:roomId/edit are list/form pages and are
// fair game.
function isRoomPath(pathname: string): boolean {
  const m = pathname.match(/^\/hub\/([^/]+)\/?$/);
  return !!m && m[1] !== "create";
}

// ReviewGate is mounted once at the app root (inside the router + auth
// provider) so it survives route changes and can accrue active time across the
// whole session. It renders nothing until the threshold is reached, then shows
// the feedback popup — but never inside a room.
export default function ReviewGate() {
  const { state } = useAuth();
  const location = useLocation();
  const [show, setShow] = useState(false);

  const user = state.status === "authenticated" ? state.user : null;
  const eligible = !!user && !isGuest(user);
  const userId = user?.userId ?? null;

  // Refs the interval reads, so it always sees current values without
  // re-subscribing on every tick / navigation.
  const pathRef = useRef(location.pathname);
  pathRef.current = location.pathname;
  const seenRef = useRef(false);
  const secondsRef = useRef(0);
  const readyRef = useRef(false); // local + server gate resolved
  const shownRef = useRef(false);

  // Resolve the gate when a user becomes eligible: read local accrual, then
  // confirm with the server they haven't already reviewed (covers a fresh
  // device where localStorage is empty).
  useEffect(() => {
    if (!eligible || !userId) return;
    let cancelled = false;

    const local = readGate(userId);
    secondsRef.current = local.seconds;
    seenRef.current = local.seen;
    readyRef.current = false;
    shownRef.current = false;
    setShow(false);

    if (local.seen) return; // already submitted/dismissed here — never show

    reviewService
      .status()
      .then(({ reviewed }) => {
        if (cancelled) return;
        if (reviewed) {
          seenRef.current = true;
          writeGate(userId, { seen: true, seconds: secondsRef.current });
          return;
        }
        readyRef.current = true;
      })
      .catch(() => {
        // Be lenient: if the status check fails, still allow the popup so a
        // transient error doesn't permanently suppress feedback collection.
        if (!cancelled) readyRef.current = true;
      });

    return () => { cancelled = true; };
  }, [eligible, userId]);

  // Accrual loop. Counts focused, in-foreground time spent *inside* a hub room.
  // Once enough room time is banked, the popup is armed — but it only actually
  // surfaces once the user is *outside* a room (it must never show in-room).
  useEffect(() => {
    if (!eligible || !userId) return;
    const id = window.setInterval(() => {
      if (!readyRef.current || seenRef.current || shownRef.current) return;
      const active = document.visibilityState === "visible" && document.hasFocus();
      const inRoom = isRoomPath(pathRef.current);

      // Bank active time only while inside a room.
      if (active && inRoom) {
        secondsRef.current += TICK_SECONDS;
        writeGate(userId, { seen: false, seconds: secondsRef.current });
      }

      // Fire the popup once the room-time threshold is met AND we're outside a
      // room (e.g. the user just left the hub for the home/explore page).
      if (secondsRef.current >= thresholdSeconds() && !inRoom) {
        shownRef.current = true;
        setShow(true);
      }
    }, TICK_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [eligible, userId]);

  // Belt-and-suspenders: never render inside a room, even if the user walked
  // into one with the popup already queued.
  if (!show || !userId || isRoomPath(location.pathname)) return null;

  const markSeen = () => {
    seenRef.current = true;
    writeGate(userId, { seen: true, seconds: secondsRef.current });
  };

  return (
    <ReviewPopup
      onSubmit={async (text) => {
        await reviewService.submit(text);
        markSeen();
      }}
      onDismiss={() => {
        markSeen();
        setShow(false);
      }}
    />
  );
}
