
import React, { Suspense, lazy, useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/menu/MainMenu';
import PlayerCustomization from './components/setup/CharacterSetup';
import { ProfileScreen } from './components/profile/ProfileScreen';
import { LeaderboardScreen } from './components/leaderboard/LeaderboardScreen';
import { TournamentScreens } from './components/tournament/TournamentScreens';
import { useUIStore } from './store/uiStore';
import { PEER_PREFIX } from './game/net/serverAddress';
import { ADS_ADMIN_HASH, rememberAdminFlag } from './components/ads/adminAccess';
import { exitFullscreen } from './components/fullscreen';

const TOURNAMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const [showingProfile, setShowingProfile] = useState(false);
  const [showingLeaderboard, setShowingLeaderboard] = useState(false);
  const hash = useHash();

  // A match may have gone full screen on a phone; the menu is shown with the browser bar again
  useEffect(() => {
    if (!state.isPlaying) void exitFullscreen();
  }, [state.isPlaying]);

  React.useEffect(() => {
    rememberAdminFlag(window.location.search);
    const params = new URLSearchParams(window.location.search);
    // ?tournament=<id>: a friend's invite to a tournament
    const tournamentId = params.get('tournament');
    if (tournamentId !== null) {
      if (TOURNAMENT_ID.test(tournamentId)) actions.openTournament(tournamentId);
      else console.warn('[tournament] ignoring an invite link with a malformed id:', tournamentId);
    }
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

  if (hash === ADS_ADMIN_HASH) {
    return <Suspense fallback={null}><AdsAdmin /></Suspense>;
  }

  if (state.isPlaying) {
    return <GameCanvas />;
  }

  // From a tournament screen, the setup screen only picks the name and look, then goes back there
  const inTournament = state.tournamentNav !== null;
  const screen = showingCustomization ? (
    <PlayerCustomization
      forTournament={inTournament}
      onContinue={() => setShowingCustomization(false)}
      onBack={() => setShowingCustomization(false)}
      onOpenProfile={() => setShowingProfile(true)}
    />
  ) : inTournament ? (
    <TournamentScreens onCustomize={() => setShowingCustomization(true)} />
  ) : (
    <MainMenu
      onCustomize={() => setShowingCustomization(true)}
      onOpenProfile={() => setShowingProfile(true)}
      onOpenLeaderboard={() => setShowingLeaderboard(true)}
    />
  );

  // The profile and the Top screen open over the menu or the setup screen, which stay mounted underneath
  // (hidden), so Back returns to that screen as it was left. Register on the Top screen goes to the profile,
  // where sign-up lives; Back from there returns to the menu.
  const overlay = showingProfile ? (
    <ProfileScreen onBack={() => setShowingProfile(false)} />
  ) : showingLeaderboard ? (
    <LeaderboardScreen
      onBack={() => setShowingLeaderboard(false)}
      onRegister={() => { setShowingLeaderboard(false); setShowingProfile(true); }}
    />
  ) : null;
  return (
    <>
      <div className={overlay ? 'hidden' : undefined}>{screen}</div>
      {overlay}
    </>
  );
};

export default App;
