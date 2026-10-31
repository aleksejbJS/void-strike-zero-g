// Turns what the player typed into something to connect to: a dedicated server
// ("192.168.1.5", "host:4000", "https://x.loca.lt") or a browser-hosted game (invite link)

export const DEFAULT_SERVER_PORT = 3001;

export const resolveServerUrl = (input: string | null | undefined, pageHost: string): string => {
    const raw = (input ?? '').trim();
    if (!raw) return `http://${pageHost}:${DEFAULT_SERVER_PORT}`;
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, '');
    const hasPort = /:\d+$/.test(raw);
    return `http://${raw}${hasPort ? '' : `:${DEFAULT_SERVER_PORT}`}`;
};

// Browser-hosted games are stored as "peer:<id>" (invite links carry ?host=<id>)
export const PEER_PREFIX = 'peer:';

export type JoinTarget = { kind: 'peer'; peerId: string } | { kind: 'server'; url: string };

/** Extract the host id from an invite link, or null if the text isn't one. */
export const inviteHostId = (text: string): string | null => {
    const match = text.match(/[?&]host=([^&#\s]+)/);
    return match ? decodeURIComponent(match[1]) : null;
};

export const parseJoinTarget = (input: string | null | undefined, pageHost: string): JoinTarget => {
    const raw = (input ?? '').trim();
    if (raw.startsWith(PEER_PREFIX)) return { kind: 'peer', peerId: raw.slice(PEER_PREFIX.length) };
    const hostId = inviteHostId(raw);
    if (hostId) return { kind: 'peer', peerId: hostId };
    return { kind: 'server', url: resolveServerUrl(raw, pageHost) };
};

export const inviteLink = (peerId: string, location: { origin: string; pathname: string }) =>
    `${location.origin}${location.pathname}?host=${encodeURIComponent(peerId)}`;
