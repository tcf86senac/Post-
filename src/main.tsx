import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Automatically apply the updated build while preserving localStorage & IndexedDB
      window.dispatchEvent(new CustomEvent('postplus:sw-updating'));
      void updateSW(true);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
