import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Suppress noisy console.error output in non-development environments.
// Keep original behavior in development so errors are visible during debugging.
try {
  if (process.env.NODE_ENV !== 'development' && typeof window !== 'undefined') {
    const _origConsoleError = console.error.bind(console);
    // Store original for future debugging if needed
    window.__UBND_originalConsoleError = _origConsoleError;
    console.error = function () {
      // Optionally, we could filter messages here. For now, no-op to reduce noise.
      return undefined;
    };
  }
} catch (e) {
  // If anything goes wrong, don't block app startup — preserve original console.error
}

const root = ReactDOM.createRoot(document.getElementById('root'));

// Set CSS variable --vh to handle mobile browser UI/toolbars reliably.
// This helps modals compute max-height relative to the actual viewport height
// (accounts for address bar / taskbar overlays on mobile and some desktop setups).
function setVh() {
  try {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
  } catch (e) {
    // ignore
  }
}
setVh();
window.addEventListener('resize', setVh);
if (window.visualViewport) window.visualViewport.addEventListener('resize', setVh);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);