import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameRoom } from '../../src/game/net/room.js';
import { Entity } from '../../src/types.js';
import { loadConfig } from './config.js';
import { PublicAccess } from './publicAccess.js';
import { startGameServer } from './gameServer.js';
import { matchmakingServer } from './matchmaking.js';

const config = loadConfig();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Allow all origins for now
    methods: ['GET', 'POST'],
  },
  // Join and input payloads are tiny; reject anything large outright
  maxHttpBufferSize: 16 * 1024,
});

// Built-in matchmaking server
if (config.matchmaking.enabled) {
  app.use('/matchmaking', matchmakingServer['app']);
}

const room = new GameRoom({ mode: config.mode, map: config.map, maxPlayers: config.maxPlayers });
const stopGame = startGameServer(io, room);

const publicAccess = new PublicAccess(config, {
  playerCount: () => room.state.players.filter((p: Entity) => p.type === 'player').length,
  mode: config.mode,
  map: config.map,
});

const shutdown = async () => {
  console.log('\n🛑 Shutting down server...');
  stopGame();
  room.dispose();
  await publicAccess.stop();
  process.exit(0);
};

httpServer.listen(config.port, '0.0.0.0', async () => {
  console.log(`🎮 Void Strike Server "${config.name}" started!`);
  console.log(`🕹️  Mode: ${config.mode}, map: ${config.map}, max players: ${config.maxPlayers}`);
  console.log(`📍 Local access: http://localhost:${config.port}`);
  console.log(`🌐 LAN access: http://<YOUR_LOCAL_IP>:${config.port}`);

  await publicAccess.start();

  if (publicAccess.url) {
    console.log(`\n🚀 PUBLIC ACCESS ENABLED!`);
    console.log(`🔗 Public URL: ${publicAccess.url}`);
    console.log(`📢 Share this URL with anyone in the world!\n`);
  } else {
    console.log(`\n⚠️  PUBLIC ACCESS DISABLED`);
    console.log(`💡 To enable public access, set TUNNELING_ENABLED=true`);
    console.log(`💡 For ngrok: add NGROK_AUTHTOKEN=your_token_here\n`);
  }

  if (config.matchmaking.enabled) {
    matchmakingServer.start(3002);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
