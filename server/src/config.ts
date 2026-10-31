// Server configuration from environment variables

import { GameMode, MapId } from '../../src/types.js';

export interface ServerConfig {
  port: number;
  name: string;
  maxPlayers: number;
  mode: GameMode;
  map: MapId;
  tunneling: {
    enabled: boolean;
    provider: 'localtunnel' | 'ngrok';
    authtoken?: string;
    subdomain?: string;
  };
  matchmaking: {
    enabled: boolean;
    server: string; // URL of the central matchmaking server
  };
}

// Hunger Games round restarts are driven by the offline client UI and don't exist online yet
const ONLINE_MODES = Object.values(GameMode).filter(m => m !== GameMode.HUNGER_GAMES);

const parseEnum = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T, name: string): T => {
  if (!value) return fallback;
  const upper = value.toUpperCase();
  const match = allowed.find(a => a.toUpperCase() === upper);
  if (match) return match;
  console.warn(`⚠️ ${name}="${value}" is not supported, using ${fallback}. Allowed: ${allowed.join(', ')}`);
  return fallback;
};

const parsePositiveInt = (value: string | undefined, fallback: number, name: string): number => {
  if (!value) return fallback;
  const n = parseInt(value, 10);
  if (Number.isInteger(n) && n > 0) return n;
  console.warn(`⚠️ ${name}="${value}" is not a positive integer, using ${fallback}`);
  return fallback;
};

export const loadConfig = (): ServerConfig => ({
  port: parsePositiveInt(process.env.PORT, 3001, 'PORT'),
  name: process.env.SERVER_NAME || 'Void Strike Server',
  maxPlayers: parsePositiveInt(process.env.MAX_PLAYERS, 8, 'MAX_PLAYERS'),
  mode: parseEnum(process.env.SERVER_MODE, ONLINE_MODES, GameMode.DEATHMATCH, 'SERVER_MODE'),
  map: parseEnum(process.env.SERVER_MAP, Object.values(MapId), MapId.DEFAULT, 'SERVER_MAP'),
  tunneling: {
    enabled: process.env.TUNNELING_ENABLED === 'true',
    provider: process.env.TUNNELING_PROVIDER === 'ngrok' ? 'ngrok' : 'localtunnel',
    authtoken: process.env.NGROK_AUTHTOKEN,
    subdomain: process.env.TUNNELING_SUBDOMAIN,
  },
  matchmaking: {
    enabled: process.env.MATCHMAKING_ENABLED === 'true',
    server: process.env.MATCHMAKING_SERVER || '',
  },
});
