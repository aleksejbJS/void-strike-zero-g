import localtunnel = require('localtunnel');
import * as ngrok from 'ngrok';

export interface TunnelOptions {
  port: number;
  provider: 'localtunnel' | 'ngrok';
  subdomain?: string;
  authtoken?: string;
}

export interface TunnelResult {
  url: string;
  provider: string;
  localPort: number;
}

export class TunnelingManager {
  private tunnel: any = null;
  private currentProvider: string = '';

  /**
   * Создает публичный туннель для локального сервера
   */
  async createTunnel(options: TunnelOptions): Promise<TunnelResult> {
    try {
      await this.cleanup();

      console.log(`Creating ${options.provider} tunnel on port ${options.port}...`);

      if (options.provider === 'ngrok') {
        return await this.createNgrokTunnel(options);
      } else {
        return await this.createLocalTunnelTunnel(options);
      }
    } catch (error) {
      console.error('Failed to create tunnel:', error);
      throw error;
    }
  }

  /**
   * Создает туннель через ngrok
   */
  private async createNgrokTunnel(options: TunnelOptions): Promise<TunnelResult> {
    if (options.authtoken) {
      await ngrok.authtoken(options.authtoken);
    }

    const url = await ngrok.connect({
      addr: options.port,
      subdomain: options.subdomain,
    });

    this.tunnel = { url, close: () => ngrok.disconnect(url) };
    this.currentProvider = 'ngrok';

    console.log(`Ngrok tunnel created: ${url}`);

    return {
      url,
      provider: 'ngrok',
      localPort: options.port,
    };
  }

  /**
   * Создает туннель через localtunnel
   */
  private async createLocalTunnelTunnel(options: TunnelOptions): Promise<TunnelResult> {
    const tunnel = await localtunnel({
      port: options.port,
      subdomain: options.subdomain,
    });

    this.tunnel = tunnel;
    this.currentProvider = 'localtunnel';

    console.log(`Localtunnel created: ${tunnel.url}`);

    return {
      url: tunnel.url,
      provider: 'localtunnel',
      localPort: options.port,
    };
  }

  /**
   * Получает текущий URL туннеля
   */
  getTunnelUrl(): string | null {
    return this.tunnel?.url || null;
  }

  /**
   * Проверяет, активен ли туннель
   */
  isTunnelActive(): boolean {
    return this.tunnel !== null;
  }

  /**
   * Закрывает туннель
   */
  async cleanup(): Promise<void> {
    if (this.tunnel) {
      try {
        if (this.currentProvider === 'ngrok') {
          await ngrok.disconnect(this.tunnel.url);
        } else {
          await this.tunnel.close();
        }
        console.log('Tunnel closed');
      } catch (error) {
        console.warn('Error closing tunnel:', error);
      }
      this.tunnel = null;
      this.currentProvider = '';
    }
  }

  /**
   * Получает информацию о туннеле
   */
  getTunnelInfo(): { url: string | null; provider: string; active: boolean } {
    return {
      url: this.getTunnelUrl(),
      provider: this.currentProvider,
      active: this.isTunnelActive(),
    };
  }
}

// Глобальный экземпляр
export const tunnelingManager = new TunnelingManager();
