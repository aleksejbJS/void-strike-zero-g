import { describe, it, expect, afterEach } from 'vitest';
import { GameMode, MapId } from '../../types';
import { GameRoom } from './room';
import { RoomHost, PeerLink } from './roomHost';
import { MSG, SNAPSHOT_RATE } from './protocol';
import { FIXED_STEP_MS } from '../systems/fixedStep';

const join = { name: 'Alex', color: '#ff0000', headColor: '#ff0000', torsoColor: '#ff0000', armColor: '#ff0000', legColor: '#ff0000', jetpackColor: '#ff0000', skinId: 'classic' };

const rooms: GameRoom[] = [];
afterEach(() => rooms.splice(0).forEach(r => r.dispose()));

/** A host with one joined link; returns a counter of snapshots that link received. */
const hostWithPlayer = () => {
    const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 2 });
    rooms.push(room);
    const host = new RoomHost(room);
    let snapshots = 0;
    const link: PeerLink = { id: 'a', send: event => { if (event === MSG.SNAPSHOT) snapshots++; } };
    host.connect(link);
    host.message('a', MSG.JOIN, join);
    return { host, snapshots: () => snapshots };
};

describe('RoomHost snapshot rate', () => {
    it('sends exactly SNAPSHOT_RATE snapshots per second of simulation', () => {
        const { host, snapshots } = hostWithPlayer();
        for (let i = 0; i < 121; i++) host.update(FIXED_STEP_MS); // one second (+1 tick against float rounding)
        expect(snapshots()).toBe(SNAPSHOT_RATE);
    });

    it('keeps the rate when updates arrive at uneven intervals', () => {
        const { host, snapshots } = hostWithPlayer();
        // None of these are near a half-tick multiple, so the stepper's vsync snapping leaves them alone
        const pattern = [3, 5, 6, 2, 3, 5];
        let elapsed = 0;
        for (let i = 0; elapsed < 2010; i++) {
            const ms = pattern[i % pattern.length];
            host.update(ms);
            elapsed += ms;
        }
        expect(snapshots()).toBe(SNAPSHOT_RATE * 2);
    });

    it('runs real time with the 4 ms loop timer, not a snapped 4.17 ms', () => {
        const { host, snapshots } = hostWithPlayer();
        for (let i = 0; i < 251; i++) host.update(4); // 1004 ms: 120 ticks, or 125 if snapped
        expect(snapshots()).toBe(SNAPSHOT_RATE);
    });

    it('sends a single snapshot, not a burst, after a long stall', () => {
        const { host, snapshots } = hostWithPlayer();
        host.update(500);
        expect(snapshots()).toBe(1);
    });
});
