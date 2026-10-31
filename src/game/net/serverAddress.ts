// Turns what the player typed ("192.168.1.5", "host:4000", "https://x.loca.lt") into a server URL

export const DEFAULT_SERVER_PORT = 3001;

export const resolveServerUrl = (input: string | null | undefined, pageHost: string): string => {
    const raw = (input ?? '').trim();
    if (!raw) return `http://${pageHost}:${DEFAULT_SERVER_PORT}`;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
    const hasPort = /:\d+$/.test(raw);
    return `http://${raw}${hasPort ? '' : `:${DEFAULT_SERVER_PORT}`}`;
};
