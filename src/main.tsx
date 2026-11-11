import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import type { HostConfig } from './storage';

/**
 * Mount the app into any element. Used when embedding inside the PHP site:
 *   window.SuspectFamilyTree.mount(document.getElementById('family-tree'), { userId, userName, apiBase, token })
 * Without a call, it mounts itself into #root (standalone mode).
 */
function mount(el: HTMLElement, config?: Partial<HostConfig>): Root {
  if (config) window.SFT_CONFIG = { ...(window.SFT_CONFIG ?? {}), ...config };
  const root = createRoot(el);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  return root;
}

declare global {
  interface Window {
    SuspectFamilyTree?: { mount: typeof mount };
  }
}

window.SuspectFamilyTree = { mount };

const auto = document.getElementById('root');
if (auto && !auto.dataset.manual) mount(auto);
