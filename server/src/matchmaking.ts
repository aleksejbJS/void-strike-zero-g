import express from 'express';

export interface ServerInfo {
  id: string;
  name: string;
  host: string;
  url: string;
  port: number;
  playerCount: number;
  maxPlayers: number;
  gameMode: string;
  map: string;
  ping: number;
  lastSeen: number;
  version: string;
  region?: string;
}

export interface MatchmakingOptions {
  port: number;
  heartbeatTimeout: number; // ms
}

export class MatchmakingServer {
  private servers = new Map<string, ServerInfo>();
  private app: express.Application;
  private heartbeatTimeout: number;

  constructor(options: MatchmakingOptions) {
    this.app = express();
    this.heartbeatTimeout = options.heartbeatTimeout;
    this.setupRoutes();

    // Очистка неактивных серверов
    setInterval(() => {
      this.cleanupInactiveServers();
    }, 30000); // Каждые 30 секунд
  }

  private setupRoutes() {
    this.app.use(express.json());

    // Регистрация сервера
    this.app.post('/register', (req, res) => {
      try {
        const serverInfo: Omit<ServerInfo, 'lastSeen'> = req.body;

        const server: ServerInfo = {
          ...serverInfo,
          lastSeen: Date.now(),
        };

        this.servers.set(server.id, server);
        console.log(`Server registered: ${server.name} (${server.url})`);

        res.json({ success: true, message: 'Server registered' });
      } catch (error) {
        res.status(400).json({ success: false, message: 'Invalid server data' });
      }
    });

    // Обновление статуса сервера (heartbeat)
    this.app.post('/heartbeat/:serverId', (req, res) => {
      const { serverId } = req.params;
      const update: Partial<ServerInfo> = req.body;

      const server = this.servers.get(serverId);
      if (server) {
        Object.assign(server, update, { lastSeen: Date.now() });
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, message: 'Server not found' });
      }
    });

    // Получение списка серверов
    this.app.get('/servers', (req, res) => {
      const servers = Array.from(this.servers.values())
        .filter(server => server.lastSeen > Date.now() - this.heartbeatTimeout)
        .map(server => ({
          ...server,
          ping: Date.now() - server.lastSeen,
        }));

      res.json({
        servers,
        total: servers.length,
      });
    });

    // Получение конкретного сервера
    this.app.get('/servers/:serverId', (req, res) => {
      const server = this.servers.get(req.params.serverId);
      if (server) {
        res.json(server);
      } else {
        res.status(404).json({ message: 'Server not found' });
      }
    });

    // Удаление сервера
    this.app.delete('/servers/:serverId', (req, res) => {
      const deleted = this.servers.delete(req.params.serverId);
      res.json({ success: deleted });
    });

    // Статистика
    this.app.get('/stats', (req, res) => {
      const activeServers = Array.from(this.servers.values())
        .filter(server => server.lastSeen > Date.now() - this.heartbeatTimeout);

      res.json({
        totalServers: this.servers.size,
        activeServers: activeServers.length,
        totalPlayers: activeServers.reduce((sum, server) => sum + server.playerCount, 0),
        regions: [...new Set(activeServers.map(s => s.region).filter(Boolean))],
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });
  }

  private cleanupInactiveServers() {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, server] of this.servers.entries()) {
      if (now - server.lastSeen > this.heartbeatTimeout) {
        toDelete.push(id);
      }
    }

    toDelete.forEach(id => {
      console.log(`Removing inactive server: ${this.servers.get(id)?.name}`);
      this.servers.delete(id);
    });

    if (toDelete.length > 0) {
      console.log(`Cleaned up ${toDelete.length} inactive servers`);
    }
  }

  getServers(): ServerInfo[] {
    return Array.from(this.servers.values());
  }

  getActiveServers(): ServerInfo[] {
    const now = Date.now();
    return Array.from(this.servers.values())
      .filter(server => server.lastSeen > now - this.heartbeatTimeout);
  }

  getServerById(id: string): ServerInfo | undefined {
    return this.servers.get(id);
  }

  start(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`Matchmaking server running on port ${port}`);
        resolve();
      });
    });
  }

  stop(): void {
    // В Express нет простого способа остановки, но для разработки это ок
    console.log('Matchmaking server stopped');
  }
}

// Глобальный экземпляр
export const matchmakingServer = new MatchmakingServer({
  port: 3002,
  heartbeatTimeout: 60000, // 1 минута
});
