// Bots-only match on a simulated clock, for measuring how well bots play (botBenchmark.test.ts).
// Math.random is seeded so a run is repeatable.

import { vi } from 'vitest';
import { GameRoom } from '../game/net/room';
import { GameEvent } from '../game/systems/events';
import * as botBrain from '../game/systems/bot';
import { GameMode, MapId, Team, Vector2 } from '../types';

export interface BenchResult {
    kills: number;
    captures: number;
    flagPickups: number;   // CTF: times a bot took the enemy flag
    longestStillMs: number; // longest time a living bot stayed within STILL_RADIUS of one spot
    stillBot: string;
    longestStuckMs: number; // longest time a bot pressed to move (walk, jetpack, reel) yet stayed within STUCK_RADIUS
    stuckBot: string;
}

const TICK_MS = 1000 / 120;
const STILL_RADIUS = 40;
const STUCK_RADIUS = 10;

const seeded = (seed: number) => {
    let s = seed >>> 0 || 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

export const runBotMatch = (mode: GameMode, map: MapId, seconds: number, seed: number): BenchResult => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const random = vi.spyOn(Math, 'random').mockImplementation(seeded(seed));
    const t0 = Date.now();
    const room = new GameRoom({ mode, map, maxPlayers: 4 });
    const state = room.state;
    let kills = 0, captures = 0, flagPickups = 0, longestStillMs = 0, stillBot = '';
    const carrying = new Set<string>();
    const still = new Map<string, { at: Vector2; since: number }>();
    // What each bot pressed on its last tick (crouching behind cover is not trying to move)
    const moving = new Map<string, boolean>();
    const brain = botBrain.updateBotAI;
    const spy = vi.spyOn(botBrain, 'updateBotAI').mockImplementation((...args: Parameters<typeof brain>) => {
        const c = brain(...args);
        moving.set(args[0].id, c.inputX !== 0 || c.isFlying || c.reel);
        return c;
    });
    const stuck = new Map<string, { at: Vector2; since: number }>();
    let longestStuckMs = 0, stuckBot = '';
    let scores = { ...state.scores };
    try {
        const ticks = Math.round((seconds * 1000) / TICK_MS);
        for (let i = 1; i <= ticks; i++) {
            const now = t0 + i * TICK_MS;
            vi.setSystemTime(now);
            room.tick();
            room.drainEvents().forEach((e: GameEvent) => { if (e.type === 'KILL') kills++; });
            for (const team of [Team.RED, Team.BLUE]) captures += Math.max(0, state.scores[team] - scores[team]);
            scores = { ...state.scores };
            for (const p of state.players) {
                if (p.hasFlag !== Team.NONE && !carrying.has(p.id)) flagPickups++;
                if (p.hasFlag !== Team.NONE) carrying.add(p.id); else carrying.delete(p.id);
                const t = stuck.get(p.id);
                if (p.dead || !moving.get(p.id) || !t || Math.hypot(p.pos.x - t.at.x, p.pos.y - t.at.y) > STUCK_RADIUS) {
                    stuck.set(p.id, { at: { ...p.pos }, since: now });
                } else if (now - t.since > longestStuckMs) {
                    longestStuckMs = now - t.since;
                    stuckBot = `${p.id} at ${Math.round(t.at.x)},${Math.round(t.at.y)}`;
                }
                const s = still.get(p.id);
                if (p.dead || !s || Math.hypot(p.pos.x - s.at.x, p.pos.y - s.at.y) > STILL_RADIUS) {
                    still.set(p.id, { at: { ...p.pos }, since: now });
                    continue;
                }
                const enemyAlive = state.players.some(o => o !== p && !o.dead && (o.team === Team.NONE || o.team !== p.team));
                if (!enemyAlive) s.since = now;
                else if (now - s.since > longestStillMs) { longestStillMs = now - s.since; stillBot = `${p.id} at ${Math.round(s.at.x)},${Math.round(s.at.y)}`; }
            }
        }
    } finally {
        room.dispose();
        spy.mockRestore();
        random.mockRestore();
        vi.useRealTimers();
    }
    return { kills, captures, flagPickups, longestStillMs, stillBot, longestStuckMs, stuckBot };
};
