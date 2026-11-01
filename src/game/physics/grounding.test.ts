// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GameRoom } from '../net/room';
import { GameMode, MapId } from '../../types';
import { clearBotMemory } from '../systems/bot';

afterEach(() => { vi.useRealTimers(); });

describe('standing on the ground', () => {
    // Gravity comes from the Force Pipeline, so a resting body touches the floor only every
    // other physics step. Grounding used to flicker: running fighters counted as airborne
    // about two thirds of the time and slid along floors with frozen legs.
    it('keeps fighters running on a platform grounded', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        const t0 = Date.now();
        clearBotMemory();
        const room = new GameRoom({ mode: GameMode.DEATHMATCH, map: MapId.DEFAULT, maxPlayers: 4 });
        const { players, platforms } = room.state;

        let onSurface = 0, grounded = 0;
        for (let tick = 1; tick <= 120 * 20; tick++) {
            vi.setSystemTime(t0 + tick * (1000 / 120));
            room.tick();
            for (const p of players) {
                if (p.dead || Math.abs(p.vel.x) <= 0.5 || p.jetpackOn || p.vel.y < -0.5) continue;
                const onTop = platforms.some(pl => p.pos.x >= pl.x && p.pos.x <= pl.x + pl.w && Math.abs(p.pos.y - pl.y) < 2.5);
                if (!onTop) continue;
                onSurface++;
                if (p.isGrounded) grounded++;
            }
        }
        room.dispose();

        expect(onSurface).toBeGreaterThan(500);
        expect(grounded / onSurface).toBeGreaterThan(0.95);
    });
});
