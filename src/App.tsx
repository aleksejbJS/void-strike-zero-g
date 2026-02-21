
import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/MainMenu';
import PlayerCustomization from './components/PlayerCustomization';
import { useUIStore } from './store/uiStore';

const App: React.FC = () => {
  const { state, actions } = useUIStore();
  const [showingCustomization, setShowingCustomization] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gameId = params.get('game');
    if (gameId) {
      // Auto-join flow
      import('./types').then(({ NetworkMode }) => {
        actions.setNetworkState(NetworkMode.CLIENT, gameId);
        setShowingCustomization(true);
      });
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
