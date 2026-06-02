import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'

// Belt-and-braces pinch-zoom kill for iOS Safari, which ignores
// user-scalable=no (set in index.html) in several versions. These gesture*
// events only fire on Safari; preventing them blocks pinch-zoom platform-wide.
const preventGesture = (e: Event) => e.preventDefault();
document.addEventListener('gesturestart', preventGesture, { passive: false });
document.addEventListener('gesturechange', preventGesture, { passive: false });
document.addEventListener('gestureend', preventGesture, { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
