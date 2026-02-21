import { ServerInfo } from '../../../server/src/matchmaking';

export interface MatchmakingConfig {
  serverUrl: string;
  timeout: number;
}

export class MatchmakingClient {
  private config: MatchmakingConfig;

  constructor(config: MatchmakingConfig = {
    serverUrl: 'https://void-strike-matchmaking.herokuapp.com',
    timeout: 10000,
  }) {
    this.config = config;
  }

  /**
   * Получает список активных серверов
   */
  async getServers(): Promise<ServerInfo[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.serverUrl}/servers`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.servers || [];
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - matchmaking server may be unreachable');
      }
      console.warn('Failed to fetch servers:', error);
      return [];
    }
  }

  /**
   * Проверяет доступность сервера
   */
  async pingServer(serverUrl: string): Promise<number> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      await fetch(`${serverUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return Date.now() - startTime;
    } catch (error) {
      return -1; // Server unreachable
    }
  }

  /**
   * Получает статистику matchmaking сервера
   */
  async getStats(): Promise<{
    totalServers: number;
    activeServers: number;
    totalPlayers: number;
    regions: string[];
  } | null> {
    try {
      const response = await fetch(`${this.config.serverUrl}/stats`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.warn('Failed to fetch matchmaking stats:', error);
      return null;
    }
  }

  /**
   * Обновляет URL matchmaking сервера
   */
  setServerUrl(url: string): void {
    this.config.serverUrl = url;
  }

  /**
   * Тестирует подключение к matchmaking серверу
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// Глобальный экземпляр
export const matchmakingClient = new MatchmakingClient();
