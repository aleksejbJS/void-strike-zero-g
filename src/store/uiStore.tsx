import React, { createContext, useContext, useMemo, useReducer } from 'react';
import { GameMode, KillMessage, Weapon, WeaponType, NetworkMode, MapId } from '../types';
import { WEAPONS_DATA } from '../constants';

export type StatsState = { hp: number; arm: number; fuel: number; maxFuel?: number; ammo: number; dead: boolean; respawn: number };
type ScoresState = { red: number; blue: number };
export type PlayerScore = { id: string; name: string; score: number; isPlayer: boolean; isLocal?: boolean; gunLevel?: number; gunProgress?: number; gunTotalLevels?: number };

interface UIState {
  isPlaying: boolean;
  selectedSkin: string;
  selectedMode: GameMode;
  lastScore: number | null;
  stats: StatsState;
  scores: ScoresState;
  playerInventory: Weapon[];
  activeWeaponType: WeaponType;
  killFeed: KillMessage[];
  isMuted: boolean;
  playerScores: PlayerScore[];
  playerName: string;
  playerColor: string;
  headColor: string;
  torsoColor: string;
  armColor: string;
  legColor: string;
  jetpackColor: string;
  networkMode: NetworkMode;
  gameId: string | null;
  selectedMap: MapId;
}

type KillFeedUpdater = KillMessage[] | ((prev: KillMessage[]) => KillMessage[]);

interface UIActions {
  startGame: (mode: GameMode) => void;
  finishGame: (score: number) => void;
  setStats: (stats: StatsState) => void;
  setScores: (scores: ScoresState) => void;
  setPlayerInventory: (inv: Weapon[]) => void;
  setActiveWeaponType: (type: WeaponType) => void;
  setKillFeed: (update: KillFeedUpdater) => void;
  toggleMute: () => void;
  setPlayerScores: (scores: PlayerScore[]) => void;
  setPlayerCustomization: (name: string, colors: { torso: string; head: string; arms: string; legs: string; jetpack: string }) => void;
  selectSkin: (skinId: string) => void;
  selectMode: (mode: GameMode) => void;
  selectMap: (mapId: MapId) => void;
  setNetworkState: (mode: NetworkMode, gameId: string | null) => void;
}

// Load from localStorage or use defaults
const loadPlayerName = () => {
  try {
    return localStorage.getItem('playerName') || 'Anonymous';
  } catch { return 'Anonymous'; }
};

const loadPlayerColor = () => {
  try {
    return localStorage.getItem('playerColor') || '#3b82f6';
  } catch { return '#3b82f6'; }
};

const loadHeadColor = () => {
  try {
    return localStorage.getItem('headColor') || loadPlayerColor();
  } catch { return loadPlayerColor(); }
};

const loadTorsoColor = () => {
  try {
    return localStorage.getItem('torsoColor') || loadPlayerColor();
  } catch { return loadPlayerColor(); }
};

const loadArmColor = () => {
  try {
    return localStorage.getItem('armColor') || loadPlayerColor();
  } catch { return loadPlayerColor(); }
};

const loadLegColor = () => {
  try {
    return localStorage.getItem('legColor') || '#475569';
  } catch { return '#475569'; }
};

const loadJetpackColor = () => {
  try {
    return localStorage.getItem('jetpackColor') || '#ef4444';
  } catch { return '#ef4444'; }
};

const loadSkin = () => {
  try {
    return localStorage.getItem('selectedSkin') || 'classic';
  } catch { return 'classic'; }
};

const initialState: UIState = {
  isPlaying: false,
  selectedSkin: loadSkin(),
  selectedMode: GameMode.DEATHMATCH,
  lastScore: null,
  stats: { hp: 100, arm: 0, fuel: 100, ammo: 0, dead: false, respawn: 0 },
  scores: { red: 0, blue: 0 },
  playerInventory: [],
  activeWeaponType: WeaponType.MACHINE_GUN,
  killFeed: [],
  isMuted: false,
  playerScores: [],
  playerName: loadPlayerName(),
  playerColor: loadPlayerColor(),
  headColor: loadHeadColor(),
  torsoColor: loadTorsoColor(),
  armColor: loadArmColor(),
  legColor: loadLegColor(),
  jetpackColor: loadJetpackColor(),
  networkMode: NetworkMode.OFFLINE,
  gameId: null,
  selectedMap: MapId.DEFAULT,
};

type Action =
  | { type: 'startGame'; payload: { mode: GameMode } }
  | { type: 'selectMode'; payload: GameMode }
  | { type: 'selectSkin'; payload: string }
  | { type: 'finishGame'; payload: number }
  | { type: 'setStats'; payload: StatsState }
  | { type: 'setScores'; payload: ScoresState }
  | { type: 'setPlayerInventory'; payload: Weapon[] }
  | { type: 'setActiveWeaponType'; payload: WeaponType }
  | { type: 'setKillFeed'; payload: KillFeedUpdater }
  | { type: 'toggleMute' }
  | { type: 'setPlayerScores'; payload: PlayerScore[] }
  | { type: 'setPlayerCustomization'; payload: { name: string; colors: { torso: string; head: string; arms: string; legs: string; jetpack: string } } }
  | { type: 'setNetworkState'; payload: { mode: NetworkMode; gameId: string | null } }
  | { type: 'selectMap'; payload: MapId };

const reducer = (state: UIState, action: Action): UIState => {
  switch (action.type) {
    case 'selectMode':
      return { ...state, selectedMode: action.payload };
    case 'selectSkin': {
      try { localStorage.setItem('selectedSkin', action.payload); } catch { /* ignore */ }
      return { ...state, selectedSkin: action.payload };
    }
    case 'startGame':
      console.log('Reducer: startGame. Current state:', state);
      return {
        ...state,
        isPlaying: true,
        selectedMode: action.payload.mode,
        lastScore: null,
        scores: { red: 0, blue: 0 },
        killFeed: [],
      };
    case 'finishGame':
      return { ...state, lastScore: action.payload, isPlaying: false };
    case 'setStats':
      return { ...state, stats: action.payload };
    case 'setScores':
      return { ...state, scores: action.payload };
    case 'setPlayerInventory':
      return { ...state, playerInventory: action.payload };
    case 'setActiveWeaponType':
      return { ...state, activeWeaponType: action.payload };
    case 'setKillFeed': {
      const next = typeof action.payload === 'function' ? action.payload(state.killFeed) : action.payload;
      return { ...state, killFeed: next };
    }
    case 'toggleMute':
      return { ...state, isMuted: !state.isMuted };
    case 'setPlayerScores':
      return { ...state, playerScores: action.payload };
    case 'setPlayerCustomization':
      console.log('Reducer: setPlayerCustomization', action.payload);
      // Save to localStorage
      try {
        localStorage.setItem('playerName', action.payload.name);
        localStorage.setItem('playerColor', action.payload.colors.torso);
        localStorage.setItem('torsoColor', action.payload.colors.torso);
        localStorage.setItem('headColor', action.payload.colors.head);
        localStorage.setItem('armColor', action.payload.colors.arms);
        localStorage.setItem('legColor', action.payload.colors.legs);
        localStorage.setItem('jetpackColor', action.payload.colors.jetpack);
      } catch { /* ignore localStorage errors */ }
      return {
        ...state,
        playerName: action.payload.name,
        playerColor: action.payload.colors.torso,
        torsoColor: action.payload.colors.torso,
        headColor: action.payload.colors.head,
        armColor: action.payload.colors.arms,
        legColor: action.payload.colors.legs,
        jetpackColor: action.payload.colors.jetpack,
      };
    case 'setNetworkState':
      return { ...state, networkMode: action.payload.mode, gameId: action.payload.gameId };
    case 'selectMap':
      return { ...state, selectedMap: action.payload };
    default:
      return state;
  }
};

interface UIContextValue {
  state: UIState;
  actions: UIActions;
}

const UIContext = createContext<UIContextValue | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions: UIActions = useMemo(() => ({
    startGame: (mode) => dispatch({ type: 'startGame', payload: { mode } }),
    selectMode: (mode) => dispatch({ type: 'selectMode', payload: mode }),
    selectSkin: (skinId) => dispatch({ type: 'selectSkin', payload: skinId }),
    finishGame: score => dispatch({ type: 'finishGame', payload: score }),
    setStats: stats => dispatch({ type: 'setStats', payload: stats }),
    setScores: scores => dispatch({ type: 'setScores', payload: scores }),
    setPlayerInventory: inv => dispatch({ type: 'setPlayerInventory', payload: inv }),
    setActiveWeaponType: type => dispatch({ type: 'setActiveWeaponType', payload: type }),
    setKillFeed: update => dispatch({ type: 'setKillFeed', payload: update }),
    toggleMute: () => dispatch({ type: 'toggleMute' }),
    setPlayerScores: scores => dispatch({ type: 'setPlayerScores', payload: scores }),
    setPlayerCustomization: (name, colors) => dispatch({ type: 'setPlayerCustomization', payload: { name, colors } }),
    setNetworkState: (mode, gameId) => dispatch({ type: 'setNetworkState', payload: { mode, gameId } }),
    selectMap: mapId => dispatch({ type: 'selectMap', payload: mapId }),
  }), []);

  return <UIContext.Provider value={{ state, actions }}>{children}</UIContext.Provider>;
};

export const useUIStore = (): UIContextValue => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUIStore must be used within UIProvider');
  return ctx;
};
