
import React from 'react';
import { SKINS } from '../constants';
import { GameMode, NetworkMode, MapId, Language } from '../types';
import { useUIStore } from '../store/uiStore';
import { useTranslation } from '../i18n/useTranslation';
import { matchmakingClient } from '../game/systems/matchmaking';
import { ServerInfo } from '../../server/src/matchmaking';

const MainMenu: React.FC<{ onCustomize: () => void }> = ({ onCustomize }) => {
  const { state, actions } = useUIStore();
  const { t, language, changeLanguage } = useTranslation();
  const [gameMode, setGameMode] = React.useState<GameMode>(state.selectedMode);
  const [activeTab, setActiveTab] = React.useState<'local' | 'public'>('local');
  const [publicServers, setPublicServers] = React.useState<ServerInfo[]>([]);
  const [serversLoading, setServersLoading] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  // Keep local gameMode in sync with global selection (e.g., when returning from a game)
  React.useEffect(() => {
    setGameMode(state.selectedMode);
  }, [state.selectedMode]);

  React.useEffect(() => {
    if (gameMode === GameMode.HUNGER_GAMES && state.selectedMap !== MapId.HUNGER) {
      actions.selectMap(MapId.HUNGER);
    }
    if (gameMode === GameMode.DEATHMATCH && state.selectedMap === MapId.HUNGER) {
      actions.selectMap(MapId.DEFAULT);
    }
  }, [gameMode, state.selectedMap, actions]);

  // Загрузка публичных серверов
  const loadPublicServers = React.useCallback(async () => {
    setServersLoading(true);
    setServerError(null);
    try {
      const servers = await matchmakingClient.getServers();
      setPublicServers(servers);
    } catch (error) {
      setServerError(error.message || 'Failed to load servers');
      setPublicServers([]);
    } finally {
      setServersLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'public') {
      loadPublicServers();
    }
  }, [activeTab, loadPublicServers]);

  const handleDeploy = () => {
    // Save selected mode before navigating
    actions.selectMode(gameMode);
    onCustomize();
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#050b14] text-white overflow-hidden font-mono">

      {/* Animated Background Elements */}
      <div className="absolute inset-0 grid-bg animate-[pulse_4s_ease-in-out_infinite]"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050b14]/80 to-[#050b14]"></div>
      <div className="scanlines"></div>

      {/* Decorative Circles */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[100px]"></div>

      {/* Main Content Container */}
      <div className="relative z-20 flex flex-col items-center w-full max-w-4xl px-4">

        {/* Language Switcher */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={() => changeLanguage(language === 'en' ? 'ru' : 'en')}
            className="px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold rounded border border-gray-600 transition-colors"
          >
            {language === 'en' ? 'RU' : 'EN'}
          </button>
        </div>

        {/* Title Section */}
        <div className="mb-8 text-center transform hover:scale-105 transition-transform duration-500">
          <h1 className="text-6xl md:text-9xl font-black tracking-tighter italic bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-500 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
            {t('menu.title').split(' ')[0]}<br />{t('menu.title').split(' ')[1]}
          </h1>
          <div className="text-xl md:text-2xl tracking-[1em] text-cyan-500/80 mt-[-10px] font-bold uppercase">
            Zero Gravity
          </div>
        </div>

        <div className="flex flex-col w-full items-stretch max-w-2xl">

          {/* Tab Selector */}
          <div className="flex bg-gray-900/60 rounded-lg p-1 border border-gray-700 mb-6">
            <button
              onClick={() => setActiveTab('local')}
              className={`flex-1 py-2 text-sm font-bold rounded transition-all ${
                activeTab === 'local' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              🎮 Local Games
            </button>
            <button
              onClick={() => setActiveTab('public')}
              className={`flex-1 py-2 text-sm font-bold rounded transition-all ${
                activeTab === 'public' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              🌐 Public Servers
            </button>
          </div>

          {activeTab === 'local' ? (
            <>
              {/* Game Mode Selector */}
          <div className="flex bg-gray-900/60 rounded-lg p-1 border border-gray-700 mb-6">
            <button
              onClick={() => setGameMode(GameMode.DEATHMATCH)}
              className={`flex-1 py-3 text-sm font-bold rounded transition-all ${gameMode === GameMode.DEATHMATCH ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {t('mode.deathmatch')}
            </button>
            <button
              onClick={() => setGameMode(GameMode.GUN_GAME)}
              className={`flex-1 py-3 text-sm font-bold rounded transition-all ${gameMode === GameMode.GUN_GAME ? 'bg-fuchsia-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {t('mode.gungame')}
            </button>
            <button
              onClick={() => setGameMode(GameMode.CTF)}
              className={`flex-1 py-3 text-sm font-bold rounded transition-all ${gameMode === GameMode.CTF ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {t('mode.ctf')}
            </button>
            <button
              onClick={() => setGameMode(GameMode.HOLD_THE_FLAG)}
              className={`flex-1 py-3 text-sm font-bold rounded transition-all ${gameMode === GameMode.HOLD_THE_FLAG ? 'bg-amber-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {t('mode.htf')}
            </button>
            <button
              onClick={() => setGameMode(GameMode.INFILTRATION)}
              className={`flex-1 py-3 text-sm font-bold rounded transition-all ${gameMode === GameMode.INFILTRATION ? 'bg-emerald-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {t('mode.infiltration')}
            </button>
            <button
              onClick={() => setGameMode(GameMode.HUNGER_GAMES)}
              className={`flex-1 py-3 text-sm font-bold rounded transition-all ${gameMode === GameMode.HUNGER_GAMES ? 'bg-lime-500 text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {t('mode.hunger')}
            </button>
          </div>

          {/* Map Selection (Deathmatch Only) */}
          {(gameMode === GameMode.DEATHMATCH || gameMode === GameMode.GUN_GAME) && (
            <div className="flex bg-gray-900/60 rounded-lg p-1 border border-gray-700 mb-6">
              <button
                onClick={() => actions.selectMap(MapId.DEFAULT)}
                className={`flex-1 py-2 text-xs font-bold rounded transition-all ${state.selectedMap === MapId.DEFAULT ? 'bg-gray-600 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
              >
                DEFAULT MAP
              </button>
              <button
                onClick={() => actions.selectMap(MapId.TUNNELS)}
                className={`flex-1 py-2 text-xs font-bold rounded transition-all ${state.selectedMap === MapId.TUNNELS ? 'bg-amber-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
              >
                TUNNELS
              </button>
            </div>
          )}

          {/* Hunger Games Map Selector */}
          {gameMode === GameMode.HUNGER_GAMES && (
            <div className="flex bg-gray-900/60 rounded-lg p-1 border border-gray-700 mb-6">
              <button
                onClick={() => actions.selectMap(MapId.HUNGER)}
                className={`flex-1 py-2 text-xs font-bold rounded transition-all ${state.selectedMap === MapId.HUNGER ? 'bg-lime-600 text-black shadow' : 'text-gray-500 hover:text-gray-300'}`}
              >
                HUNGER ARENA
              </button>
            </div>
          )}

          {/* Deploy Button */}
          <button
            onClick={handleDeploy}
            className="group relative w-full py-6 bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl italic tracking-wider rounded-xl shadow-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] mb-6"
          >
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0] group-hover:bg-[position:200%_0] transition-[background-position] duration-1000 ease-in-out"></div>
            <span className="relative z-10 flex items-center justify-center gap-3">
              {t('menu.deploy')} <span className="text-blue-200 text-lg">►</span>
            </span>
          </button>

          {/* Multiplayer Section */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                actions.selectMode(gameMode);
                actions.setNetworkState(NetworkMode.HOST, null);
                onCustomize();
              }}
              className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {t('menu.createGame')}
            </button>

            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder={t('menu.gameId')}
                className="flex-1 bg-gray-900/60 border border-gray-700 rounded-xl px-4 text-sm focus:outline-none focus:border-purple-500"
                id="join-game-input"
              />
              <button
                onClick={() => {
                  const input = document.getElementById('join-game-input') as HTMLInputElement;
                  if (input.value) {
                    actions.selectMode(gameMode); // Mode doesn't matter for client really, but good to set
                    actions.setNetworkState(NetworkMode.CLIENT, input.value);
                    onCustomize();
                  }
                }}
                className="px-6 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {t('menu.join')}
              </button>
            </div>
          </div>

              {/* Controls Panel */}
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
                <h3 className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-4">{t('menu.controls')}</h3>
                <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-300">
                  <div className="flex items-center gap-2"><K>WASD</K> {t('menu.move')}</div>
                  <div className="flex items-center gap-2 justify-end">{t('menu.jetpack')} <K>SPACE</K></div>
                  <div className="flex items-center gap-2"><K>1-6</K> {t('menu.weapon')}</div>
                  <div className="flex items-center gap-2 justify-end">{t('menu.grapple')} <K>R-CLK / SHIFT</K></div>
                  <div className="flex items-center gap-2"><K>L-CLK</K> {t('menu.fire')}</div>
                  <div className="flex items-center gap-2 justify-end">{t('menu.dash')} <K>SHIFT</K></div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Public Servers */}
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-300 text-sm font-bold">Public Servers</h3>
                  <button
                    onClick={loadPublicServers}
                    disabled={serversLoading}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                  >
                    {serversLoading ? '...' : '🔄 Refresh'}
                  </button>
                </div>

                {serverError && (
                  <div className="text-red-400 text-sm mb-4 p-2 bg-red-900/20 rounded">
                    ⚠️ {serverError}
                  </div>
                )}

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {serversLoading ? (
                    <div className="text-gray-400 text-sm text-center py-4">
                      Loading servers...
                    </div>
                  ) : publicServers.length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-4">
                      No public servers found
                    </div>
                  ) : (
                    publicServers.map((server) => (
                      <div
                        key={server.id}
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm truncate">
                            {server.name}
                          </div>
                          <div className="text-gray-400 text-xs">
                            {server.gameMode} • {server.map} • {server.playerCount}/{server.maxPlayers} players
                          </div>
                          <div className="text-gray-500 text-xs">
                            🌐 {server.region || 'Unknown'} • Ping: {server.ping}ms
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            actions.selectMode(server.gameMode as GameMode);
                            actions.setNetworkState(NetworkMode.CLIENT, server.url);
                            onCustomize();
                          }}
                          disabled={server.playerCount >= server.maxPlayers}
                          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-sm rounded transition-colors ml-3"
                        >
                          {server.playerCount >= server.maxPlayers ? 'FULL' : 'JOIN'}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* How to Host */}
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
                <h3 className="text-gray-300 text-sm font-bold mb-3">🎮 How to Host Your Own Server</h3>
                <div className="text-gray-300 text-sm space-y-2">
                  <div>1. <code className="bg-gray-800 px-1 rounded">npm run server</code> in server folder</div>
                  <div>2. Set <code className="bg-gray-800 px-1 rounded">TUNNELING_ENABLED=true</code></div>
                  <div>3. Share the public URL with friends!</div>
                  <div className="text-gray-500 text-xs mt-3">
                    💡 For better performance, use ngrok: add <code className="bg-gray-800 px-1 rounded">NGROK_AUTHTOKEN=your_token</code>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

const K: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 min-w-[20px] bg-gray-800 border-b-2 border-gray-600 rounded font-bold text-gray-200 ${className}`}>
    {children}
  </span>
);

export default MainMenu;
