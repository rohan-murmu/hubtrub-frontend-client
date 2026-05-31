import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/context/UserContext';
import { findScene } from '@/utils/scenes';
import { sendMessageToIframe, listenToIframeMessages } from '@/utils/godotBridge';
import Button from '@/components/ui/Button';
import './ExplorePage.css';

/** Standalone scene preview. Boots the Godot build in "explore" mode — the
 *  game renders the chosen world and a single local player with NO websocket
 *  and NO backend. Deliberately does not reuse RoomPage. */
export default function ExplorePage() {
  const [params] = useSearchParams();
  const currentUser = useCurrentUser();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const worldKey = findScene(params.get('world'))?.key ?? 'first_land';
  const scene = findScene(worldKey);
  const [ready, setReady] = useState(false);

  // Clear the iframe src on unmount so the engine tears down cleanly.
  useEffect(() => {
    return () => {
      if (iframeRef.current) iframeRef.current.src = 'about:blank';
    };
  }, []);

  useEffect(() => {
    const cleanup = listenToIframeMessages((message) => {
      if (message?.type === 'GODOT_READY' && iframeRef.current) {
        sendMessageToIframe(iframeRef.current, 'SET_CONNECTION_CONFIG', {
          mode: 'explore',
          worldKey,
          playerKey: currentUser?.avatarKey || 'hubit',
        });
      }
      const isReadyStage =
        message?.type === 'LOADING_PROGRESS' &&
        message.payload?.stage === 'ready' &&
        message.payload?.status === 'done';
      const isExploreAck =
        message?.type === 'CONNECTION_ACKNOWLEDGED' &&
        message.payload?.status === 'explore';
      if (isReadyStage || isExploreAck) setReady(true);
    });
    return cleanup;
  }, [worldKey, currentUser]);

  return (
    <div className="explore-page">
      <div className="explore-bar">
        <Button variant="ghost" size="sm" icon="pi pi-times" onClick={() => window.close()}>
          Close
        </Button>
        <span className="explore-bar__title">
          Exploring <strong>{scene?.label ?? worldKey}</strong>
        </span>
        <span className="explore-bar__badge">Preview · WASD / arrows to move</span>
      </div>

      <div className="explore-stage">
        <iframe
          ref={iframeRef}
          src="/game/index.html"
          title="Explore world"
          className="explore-iframe"
        />
        {!ready && (
          <div className="explore-loading">
            <div className="explore-spinner" />
            <p>Loading {scene?.label ?? worldKey}…</p>
          </div>
        )}
      </div>
    </div>
  );
}
