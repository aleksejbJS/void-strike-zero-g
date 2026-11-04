// Test double for PeerSocket: a fake host link the test drives (no PeerJS, no network).
// Kept apart from matchTileTestKit so a vi.mock factory can load it without loading MatchTile.

import { FakeSocket } from '../../../game/net/spectatorTestKit';

/** Every PeerSocket the tile opened, newest last. */
export const sockets: FakePeerSocket[] = [];

export class FakePeerSocket extends FakeSocket {
    constructor(public peerId: string) {
        super();
        sockets.push(this);
    }
}
