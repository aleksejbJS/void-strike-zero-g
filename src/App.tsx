
import React, { Suspense, lazy, useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/menu/MainMenu';
import PlayerCustomization from './components/setup/CharacterSetup';
import { useUIStore } from './store/uiStore';
import { PEER_PREFIX } from './game/net/serverAddress';

// Hidden ads admin page, loaded only when someone opens #ads-admin
const AdsAdmin = lazy(() => import('./components/ads/AdsAdmin').then(m => ({ default: m.AdsAdmin })));

const useHash = () => {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
};

const App: React.FC = () => {
  const { state, actions } = useUIStore();
  const [showingCustomization, setShowingCustomization] = useState(false);
  const hash = useHash();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // ?host=<id>: invite to a browser-hosted game; ?game=<address>: a dedicated server
    const hostId = params.get('host');
    const target = hostId ? `${PEER_PREFIX}${hostId}` : params.get('game');
    if (target) {
      // Auto-join flow
      import('./types').then(({ NetworkMode }) => {
        actions.setNetworkState(NetworkMode.CLIENT, target);
        setShowingCustomization(true);
      }).catch(err => console.error('Failed to start auto-join:', err));
    }
  }, []);

  if (hash === '#ads-admin') {
    return <Suspense fallback={null}><AdsAdmin /></Suspense>;
  }

  if (state.isPlaying) {
    return <GameCanvas />;
  }

  if (showingCustomization) {
    return (
      <PlayerCustomization
        onContinue={() => setShowingCustomization(false)}
        onBack={() => setShowingCustomization(false)}
      />
    );
  }

  return <MainMenu onCustomize={() => setShowingCustomization(true)} />;
};

export default App;
