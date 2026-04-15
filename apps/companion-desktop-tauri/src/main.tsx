import React from 'react';
import { createRoot } from 'react-dom/client';
import { getCurrentWindow } from '@tauri-apps/api/window';
import App from './App';
import CharacterOverlay from './panels/CharacterOverlay';
import MiniTerminal from './panels/MiniTerminal';
import './styles.css';

/**
 * Multi-window entry point — renders different components based on window label.
 * main → full App shell
 * overlay → character overlay (transparent, always-on-top)
 * mini-terminal → quick command input popup
 */
function Root() {
  const [windowLabel, setWindowLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    const label = getCurrentWindow().label;
    setWindowLabel(label);
  }, []);

  if (windowLabel === null) return null;
  if (windowLabel === 'overlay') return <CharacterOverlay />;
  if (windowLabel === 'mini-terminal') return <MiniTerminal />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
