// Public access: tunnel to the internet and (optional) listing on a matchmaking server

import { ServerConfig } from './config.js';
import { tunnelingManager, TunnelOptions } from './tunneling.js';

const HEARTBEAT_MS = 30000;

export interface ListingInfo {
  playerCount: () => number;
  mode: string;
  map: string;
}

export class PublicAccess {
  private tunnelUrl: string | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private readonly serverId = `server_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

  constructor(private readonly config: ServerConfig, private readonly listing: ListingInfo) {}

  get url() {
    return this.tunnelUrl;
  }

  async start(): Promise<void> {
    if (!this.config.tunneling.enabled) return;

    try {
      const options: TunnelOptions = {
        port: this.config.port,
        provider: this.config.tunneling.provider,
        subdomain: this.config.tunneling.subdomain,
        authtoken: this.config.tunneling.authtoken,
      };
      const tunnel = await tunnelingManager.createTunnel(options);
      this.tunnelUrl = tunnel.url;
      console.log(`🚀 Public tunnel created: ${this.tunnelUrl}`);
    } catch (error) {
      console.error('❌ Failed to create tunnel:', error);
      console.log('💡 Try running without tunneling: TUNNELING_ENABLED=false npm run dev');
      return;
    }

    if (this.config.matchmaking.enabled) {
      if (!this.config.matchmaking.server) {
        console.warn('⚠️ MATCHMAKING_ENABLED=true but MATCHMAKING_SERVER is not set — skipping listing');
        return;
      }
      await this.register();
      this.heartbeat = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_MS);
    }
  }

  async stop(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    await tunnelingManager.cleanup();
  }

  private async register(): Promise<void> {
    if (!this.tunnelUrl) return;
    const info = {
      id: this.serverId,
      name: this.config.name,
      host: 'auto',
      url: this.tunnelUrl,
      port: this.config.port,
      playerCount: this.listing.playerCount(),
      maxPlayers: this.config.maxPlayers,
      gameMode: this.listing.mode,
      map: this.listing.map,
      ping: 0,
      version: '1.0.0',
      region: process.env.SERVER_REGION || 'unknown',
    };

    try {
      const response = await fetch(`${this.config.matchmaking.server}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      });
      if (response.ok) console.log('✅ Server registered on matchmaking server');
      else console.warn(`⚠️ Matchmaking registration failed: HTTP ${response.status}`);
    } catch (error) {
      console.warn('⚠️ Could not reach matchmaking server:', error instanceof Error ? error.message : String(error));
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.tunnelUrl) return;
    try {
      const response = await fetch(`${this.config.matchmaking.server}/heartbeat/${this.serverId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerCount: this.listing.playerCount(), lastSeen: Date.now() }),
      });
      // The listing expires after a missed heartbeat window — register again
      if (response.status === 404) await this.register();
      else if (!response.ok) console.warn(`Heartbeat failed: HTTP ${response.status}`);
    } catch (error) {
      console.warn('Heartbeat failed:', error instanceof Error ? error.message : String(error));
    }
  }
}
