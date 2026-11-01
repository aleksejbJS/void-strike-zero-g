
import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/menu/MainMenu';
import PlayerCustomization from './components/setup/CharacterSetup';
import { useUIStore } from './store/uiStore';
import { PEER_PREFIX } from './game/net/serverAddress';

const App: React.FC = () => {
  const { state, actions } = useUIStore();
  const [showingCustomization, setShowingCustomization] = useState(false);

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
