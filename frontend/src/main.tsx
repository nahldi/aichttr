import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'highlight.js/styles/atom-one-dark.css'
import App from './App.tsx'
import { installRemoteAccessFetch } from './lib/remoteAccess.ts'

installRemoteAccessFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* SW registration optional */ });
  });
}
