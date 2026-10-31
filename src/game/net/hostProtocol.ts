// Messages between the browser host's main thread (WebRTC connections) and the
// Web Worker that runs the room (spec phase 2, decision P2).

import { RoomConfig } from './room';

export type ToWorker =
    | { kind: 'start'; config: RoomConfig }
    | { kind: 'connect'; linkId: string }
    | { kind: 'message'; linkId: string; event: string; data: unknown }
    | { kind: 'disconnect'; linkId: string };

export type FromWorker =
    | { kind: 'send'; linkId: string; event: string; data: unknown }
    | { kind: 'error'; message: string };

/** Link id of the host's own player (talks to the room without any network). */
export const LOCAL_LINK_ID = 'host-local';
