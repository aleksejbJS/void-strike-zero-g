import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { GameState, PlayerInput, Projectile, GameMode, Team, WeaponType, ItemType, Pickup, MapId } from '../../src/types.js';
import { updatePhysics } from '../../src/game/systems/physics.js';
import { WEAPONS_DATA, INFILTRATION_TIMER } from './constants.js';
import { getPlatforms, getInitialPickups, baseFlagPos, HTF_FLAG_POS, INTEL_POS } from '../../src/game/data/level.js';
import { tunnelingManager, TunnelOptions } from './tunneling.js';
import { matchmakingServer } from './matchmaking.js';

// Конфигурация сервера
interface ServerConfig {
  port: number;
  name: string;
  maxPlayers: number;
  tunneling: {
    enabled: boolean;
    provider: 'localtunnel' | 'ngrok';
    authtoken?: string;
    subdomain?: string;
  };
  matchmaking: {
    enabled: boolean;
    server: string; // URL центрального matchmaking сервера
  };
}

// Загрузка конфигурации из переменных окружения
const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3001'),
  name: process.env.SERVER_NAME || 'Void Strike Server',
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '8'),
  tunneling: {
    enabled: process.env.TUNNELING_ENABLED === 'true',
    provider: (process.env.TUNNELING_PROVIDER as 'localtunnel' | 'ngrok') || 'localtunnel',
    authtoken: process.env.NGROK_AUTHTOKEN,
    subdomain: process.env.TUNNELING_SUBDOMAIN,
  },
  matchmaking: {
    enabled: process.env.MATCHMAKING_ENABLED === 'true',
    server: process.env.MATCHMAKING_SERVER || 'https://void-strike-matchmaking.herokuapp.com',
  },
};

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

// Интеграция matchmaking сервера
if (config.matchmaking.enabled) {
  app.use('/matchmaking', matchmakingServer['app']);
}

// --- GAME STATE ---
const initialMode = GameMode.DEATHMATCH;

const gameState: GameState = {
    mode: initialMode,
    scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
    players: [],
    projectiles: [],
    particles: [],
    decals: [],
    floatingTexts: [],
    platforms: getPlatforms(initialMode),
    pickups: getInitialPickups(initialMode),
    camera: { x: 0, y: 0, zoom: 1 },
    ragdollParts: [],
    lastHTFScore: 0,
    currentMap: MapId.DEFAULT,
    infiltrationEndTime: undefined,
    beams: []
};

// Map socket ID to player ID
const socketToPlayer = new Map<string, string>();
// Store inputs for the current frame
const playerInputs = new Map<string, PlayerInput>();

// Server management
let serverTunnelUrl: string | null = null;
let serverId: string = generateServerId();
let heartbeatInterval: NodeJS.Timeout | null = null;

function generateServerId(): string {
  return `server_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

async function setupTunneling(): Promise<void> {
  if (!config.tunneling.enabled) return;

  try {
    const tunnelOptions: TunnelOptions = {
      port: config.port,
      provider: config.tunneling.provider,
      subdomain: config.tunneling.subdomain,
      authtoken: config.tunneling.authtoken,
    };

    const tunnel = await tunnelingManager.createTunnel(tunnelOptions);
    serverTunnelUrl = tunnel.url;

    console.log(`🚀 Public tunnel created: ${serverTunnelUrl}`);
    console.log(`📢 Share this URL with friends: ${serverTunnelUrl}`);

    // Регистрация на matchmaking сервере
    if (config.matchmaking.enabled) {
      await registerOnMatchmakingServer();
      startHeartbeat();
    }
  } catch (error) {
    console.error('❌ Failed to create tunnel:', error);
    console.log('💡 Try running without tunneling: TUNNELING_ENABLED=false npm run dev');
  }
}

async function registerOnMatchmakingServer(): Promise<void> {
  if (!serverTunnelUrl) return;

  try {
    const serverInfo = {
      id: serverId,
      name: config.name,
      host: 'auto',
      url: serverTunnelUrl,
      port: config.port,
      playerCount: gameState.players.filter(p => p.type === 'player').length,
      maxPlayers: config.maxPlayers,
      gameMode: gameState.mode,
      map: gameState.currentMap,
      ping: 0,
      version: '1.0.0',
      region: process.env.SERVER_REGION || 'unknown',
    };

    const response = await fetch(`${config.matchmaking.server}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverInfo),
    });

    if (response.ok) {
      console.log('✅ Server registered on matchmaking server');
    } else {
      console.warn('⚠️ Failed to register on matchmaking server');
    }
  } catch (error) {
    console.warn('⚠️ Could not reach matchmaking server:', error instanceof Error ? error.message : String(error));
  }
}

function startHeartbeat(): void {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(async () => {
    if (!serverTunnelUrl) return;

    try {
      const update = {
        playerCount: gameState.players.filter(p => p.type === 'player').length,
        lastSeen: Date.now(),
      };

      await fetch(`${config.matchmaking.server}/heartbeat/${serverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
    } catch (error) {
      console.warn('Heartbeat failed:', error instanceof Error ? error.message : String(error));
    }
  }, 30000); // Каждые 30 секунд
}

async function cleanup(): Promise<void> {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  await tunnelingManager.cleanup();
}

// --- GAME LOOP ---
const TICK_RATE = 60;
const TICK_MS = 1000 / TICK_RATE;

const getSpawnPoint = (team: Team) => {
    if (team === Team.BLUE) return { x: -400 + Math.random() * 200, y: 400 };
    if (team === Team.RED) return { x: 2200 + Math.random() * 200, y: 400 };
    return { x: Math.random() * 2000, y: Math.random() > 0.5 ? 700 : 200 };
};

// Initialize Bots
const initBots = () => {
    const isTeamMode = gameState.mode === GameMode.CTF || gameState.mode === GameMode.HOLD_THE_FLAG || gameState.mode === GameMode.INFILTRATION;
    const botCount = isTeamMode ? 6 : 3;

    for (let i = 0; i < botCount; i++) {
        let team = Team.NONE;
        if (isTeamMode) {
            if (gameState.mode === GameMode.INFILTRATION) {
                team = i < 2 ? Team.BLUE : Team.RED;
            } else {
                team = i % 2 === 0 ? Team.RED : Team.BLUE;
            }
        }
        const pos = getSpawnPoint(team);
        const botWeapon = { ...WEAPONS_DATA[WeaponType.MACHINE_GUN] };

        gameState.players.push({
            id: `bot_${i}`, type: 'bot', pos, vel: { x: 0, y: 0 }, width: 30, height: 72,
            color: team === Team.RED ? '#ef4444' : '#3b82f6',
            headColor: team === Team.RED ? '#ef4444' : '#3b82f6',
            torsoColor: team === Team.RED ? '#ef4444' : '#3b82f6',
            armColor: team === Team.RED ? '#ef4444' : '#3b82f6',
            legColor: '#475569',
            isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
            jetpackFuel: 100, maxFuel: 100, jetpackColor: '#64748b', dead: false, respawnTimer: 0, team,
            facingRight: true, weapon: botWeapon, inventory: [botWeapon], lastFired: 0, skinId: 'classic',
            name: `Bot ${i + 1}`, score: 0,
            grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE,
            lastProcessedInput: 0
        });
    }
};

initBots();

setInterval(() => {
    // Apply Inputs & Physics
    // We pass empty local keys/mouse because server doesn't have a local player
    // All players are "remote" from server perspective, but updatePhysics expects local inputs for "player"
    // We need to adapt updatePhysics or just pass dummy values and rely on remoteInputs

    // Actually, updatePhysics logic treats 'player' specially.
    // We should probably rename 'player' to something else or ensure no player has ID 'player' on server?
    // Or just treat everyone as remote.

    // In our ported physics, we modified it to take `remoteInputs`.
    // We will pass ALL inputs as remoteInputs.

    const dummyKeys = {};
    const dummyMouse = { x: 0, y: 0 };

    // Convert Map to Record for updatePhysics
    const inputsRecord: Record<string, PlayerInput> = {};
    playerInputs.forEach((value, key) => {
        inputsRecord[key] = value;
    });

    updatePhysics(
        gameState,
        dummyKeys,
        dummyMouse,
        false, // hookPressed
        false, // mousePressed
        1920, // screenW (dummy)
        1080, // screenH (dummy)
        null, // setKillFeed (we can implement a server-side killfeed later)
        true, // isMuted
        getSpawnPoint,
        '', // localPlayerId (server has no local player)
        inputsRecord
    );

    // Broadcast State
    io.emit('stateUpdate', gameState);

    // Clear inputs? No, we keep them until new ones arrive (hold keys)
    // Actually, inputs are snapshots. If client stops sending, they stop moving?
    // Client sends input every frame.

}, TICK_MS);


// --- SOCKET HANDLING ---
io.on('connection', (socket: Socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join', (data: { name: string, color: string, skinId: string, headColor: string, torsoColor: string, armColor: string, legColor: string, jetpackColor: string, mapId?: MapId }) => {
        console.log(`Player joined: ${socket.id} (${data.name})`);

        // If it's the first player or we want to allow map switching, update the map
        if (data.mapId && Object.values(MapId).includes(data.mapId)) {
            // Only switch map if no game is in progress or just for simplicity always switch if requested
            // For now, let's switch if the requested map is different.
            if (gameState.currentMap !== data.mapId) {
                gameState.currentMap = data.mapId;
                gameState.platforms = getPlatforms(gameState.mode, gameState.currentMap);
                // Reset pickups for the new map
                gameState.pickups = getInitialPickups(gameState.mode, gameState.currentMap); // Note: getInitialPickups might need mapId too if we customize pickups per map
            }
        }

        const playerId = socket.id; // Use socket ID as player ID
        socketToPlayer.set(socket.id, playerId);

        // Determine Team
        const isTeamMode = gameState.mode === GameMode.CTF || gameState.mode === GameMode.HOLD_THE_FLAG || gameState.mode === GameMode.INFILTRATION;
        let team = Team.NONE;
        if (isTeamMode) {
            const blueCount = gameState.players.filter(p => p.team === Team.BLUE).length;
            const redCount = gameState.players.filter(p => p.team === Team.RED).length;
            team = blueCount <= redCount ? Team.BLUE : Team.RED;
        }

        // Replace a bot if available
        const botIndex = gameState.players.findIndex(p => p.type === 'bot' && (isTeamMode ? p.team === team : true));

        const startPos = getSpawnPoint(team);
        const startWeapon = { ...WEAPONS_DATA[WeaponType.MACHINE_GUN] };

        const newPlayer = {
            id: playerId,
            type: 'player' as const,
            pos: startPos,
            vel: { x: 0, y: 0 },
            width: 30, height: 72,
            color: data.color,
            headColor: data.headColor,
            torsoColor: data.torsoColor,
            armColor: data.armColor,
            legColor: data.legColor,
            jetpackColor: data.jetpackColor,
            isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
            jetpackFuel: 100, maxFuel: 100,
            dead: false, respawnTimer: 0, team,
            facingRight: true, weapon: startWeapon, inventory: [startWeapon], lastFired: 0, skinId: data.skinId,
            name: data.name, score: 0,
            grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE,
            lastProcessedInput: 0
        };

        if (botIndex !== -1) {
            // Inherit bot's position/team if replacing
            newPlayer.pos = gameState.players[botIndex].pos;
            newPlayer.team = gameState.players[botIndex].team;
            gameState.players[botIndex] = newPlayer;
        } else {
            gameState.players.push(newPlayer);
        }

        socket.emit('init', { id: playerId, state: gameState });
        console.log(`Player ${data.name} joined as ${playerId}`);
    });

    socket.on('input', (input: PlayerInput) => {
        const playerId = socketToPlayer.get(socket.id);
        if (playerId) {
            playerInputs.set(playerId, input);
        }
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        const playerId = socketToPlayer.get(socket.id);
        if (playerId) {
            // Remove player or convert to bot?
            // For now, just remove
            gameState.players = gameState.players.filter(p => p.id !== playerId);
            socketToPlayer.delete(socket.id);
            playerInputs.delete(playerId);

            // Optionally spawn a bot in their place to keep player count up
        }
    });
});

httpServer.listen(config.port, '0.0.0.0', async () => {
    console.log(`🎮 Void Strike Server "${config.name}" started!`);
    console.log(`📍 Local access: http://localhost:${config.port}`);
    console.log(`🌐 LAN access: http://<YOUR_LOCAL_IP>:${config.port}`);

    // Настройка tunneling для внешнего доступа
    await setupTunneling();

    if (serverTunnelUrl) {
        console.log(`\n🚀 PUBLIC ACCESS ENABLED!`);
        console.log(`🔗 Public URL: ${serverTunnelUrl}`);
        console.log(`📢 Share this URL with anyone in the world!\n`);
    } else {
        console.log(`\n⚠️  PUBLIC ACCESS DISABLED`);
        console.log(`💡 To enable public access, set TUNNELING_ENABLED=true`);
        console.log(`💡 For ngrok: add NGROK_AUTHTOKEN=your_token_here\n`);
    }

    // Запуск matchmaking сервера если нужно
    if (config.matchmaking.enabled) {
        matchmakingServer.start(3002);
    }

    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down server...');
        await cleanup();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Shutting down server...');
        await cleanup();
        process.exit(0);
    });
});
