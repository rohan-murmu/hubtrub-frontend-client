import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import './WelcomeScreen.css';

const PARALLAX_LAYERS = [
  { src: '/landing/parallax/5.webp', depth: 0.04, className: 'plx-layer plx-sky' },
  { src: '/landing/parallax/4.webp', depth: 0.08, className: 'plx-layer plx-far' },
  { src: '/landing/parallax/3.webp', depth: 0.14, className: 'plx-layer plx-mid' },
  { src: '/landing/parallax/2.webp', depth: 0.22, className: 'plx-layer plx-near' },
  { src: '/landing/parallax/1.webp', depth: 0.32, className: 'plx-layer plx-ground' },
];

export default function WelcomeScreen() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const heroRef = useRef<HTMLElement | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);

  const checking = state.status === 'pending';
  const signedIn = state.status === 'authenticated' || state.status === 'needs-profile';

  const handleGetStarted = () => {
    navigate(signedIn ? '/hub' : '/auth');
  };

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const onMove = (e: MouseEvent) => {
      const rect = hero.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      targetRef.current = { x, y };
    };

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 };
    };

    const tick = () => {
      const cur = currentRef.current;
      const tgt = targetRef.current;
      cur.x += (tgt.x - cur.x) * 0.08;
      cur.y += (tgt.y - cur.y) * 0.08;
      hero.style.setProperty('--mx', cur.x.toFixed(4));
      hero.style.setProperty('--my', cur.y.toFixed(4));
      rafRef.current = requestAnimationFrame(tick);
    };

    hero.addEventListener('mousemove', onMove);
    hero.addEventListener('mouseleave', onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      hero.removeEventListener('mousemove', onMove);
      hero.removeEventListener('mouseleave', onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section ref={heroRef} className="hero" aria-label="Hubtrub landing">
      <header className="hero-nav">
        <button
          type="button"
          className="hero-logo"
          onClick={() => navigate('/')}
          aria-label="hubtrub home"
        >
          hub<span className="hero-logo-accent">trub</span>
        </button>
        <span className="hero-beta" aria-label="beta version">beta version</span>
      </header>

      <div className="hero-parallax" aria-hidden="true">
        {PARALLAX_LAYERS.map((l) => (
          <div
            key={l.src}
            className={l.className}
            style={
              {
                backgroundImage: `url(${l.src})`,
                '--depth': l.depth,
              } as React.CSSProperties
            }
          />
        ))}
        <div className="plx-hubit" style={{ '--depth': 0.5 } as React.CSSProperties}>
          <img src="/landing/fun_hubit.png" alt="" draggable={false} />
        </div>
      </div>

      <div className="hero-content">
        <h1 className="hero-title">Live the Community</h1>
        <p className="hero-subtitle">Build pixel hubs. Meet your tribe. Live the adventure.</p>
        <button
          type="button"
          className="hero-cta"
          onClick={handleGetStarted}
          disabled={checking}
        >
          <span className="hero-cta-label">
            {checking ? 'Loading…' : 'Explore worlds'}
          </span>
          <span className="hero-cta-arrow" aria-hidden="true">▶</span>
        </button>
      </div>

      <div className="hero-vignette" aria-hidden="true" />
    </section>
  );
}
