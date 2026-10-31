// Web Worker entry for a browser-hosted game: runs the authoritative room in a
// background thread, so the match keeps full speed when the host switches tabs
// (browsers throttle timers in background tabs, but not in dedicated workers).

import { GameRoom } from './room';
import { RoomHost, runRoomLoop } from './roomHost';
import { ToWorker, FromWorker } from './hostProtocol';

const ctx = self as unknown as {
    postMessage(msg: FromWorker): void;
    onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

let host: RoomHost | null = null;

const handle = (msg: ToWorker) => {
    switch (msg.kind) {
        case 'start':
            if (host) return;
            host = new RoomHost(new GameRoom(msg.config));
            runRoomLoop(host, err => ctx.postMessage({ kind: 'error', message: err instanceof Error ? err.message : String(err) }));
            break;
        case 'connect':
            host?.connect({ id: msg.linkId, send: (event, data) => ctx.postMessage({ kind: 'send', linkId: msg.linkId, event, data }) });
            break;
        case 'message':
            host?.message(msg.linkId, msg.event, msg.data);
            break;
        case 'disconnect':
            host?.disconnect(msg.linkId);
            break;
    }
};

ctx.onmessage = e => {
    try {
        handle(e.data);
    } catch (err) {
        ctx.postMessage({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
};
