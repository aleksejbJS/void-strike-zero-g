// Authoritative game room: owns the simulation for one match.
// Transport-agnostic — the Node server drives it over socket.io today,
// a browser host can drive it over WebRTC later.

import { GameMode, GameState, MapId, PlayerInput } from '../../types';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { updatePhysics } from '../systems/physics';
import { gameEvents, GameEvent } from '../systems/events';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { InputQueue } from './inputQueue';
import { JoinRequest, JoinRejected, Snapshot, buildSnapshot } from './protocol';
import { createRoomState, createBots, createJoinedPlayer, spawnPointFor, pickTeam, resetHungerRound, resetMatch } from './roomSetup';
import { isHungerRoundOver } from '../systems/hungerRound';
import { isMatchOver } from '../systems/matchRound';
import { duelSpawnPoint } from '../systems/duelRules';

const MAX_BODY_SPEED_X = 15;

export interface RoomConfig {
    mode: GameMode;
    map: MapId;
    maxPlayers: number;
    /** Bots at the start; defaults to the mode's usual number (none in a duel). */
    bots?: number;
    /** Start the next match after the results screen (default true); a tournament duel stays on its result. */
    restartMatches?: boolean;
}

export type JoinResult = { ok: true } | { ok: false; reason: JoinRejected['reason'] };

export class GameRoom {
    readonly state: GameState;
    private readonly physics = new MatterPhysicsEngine();
    private readonly inputs = new Map<string, InputQueue>();
    private events: GameEvent[] = [];
    private readonly unsubscribeEvents: () => void;
    private readonly spawnPoint: ReturnType<typeof spawnPointFor>;

    constructor(private readonly config: RoomConfig) {
        this.spawnPoint = spawnPointFor(config.mode);
        this.state = createRoomState(config.mode, config.map);
        this.state.players.push(...createBots(config.mode, config.bots));
        this.state.platforms.forEach(p => this.physics.addPlatform(p));
        this.state.players.forEach(p => this.physics.addPlayer(p));
        // The event bus is global: one room per process (true for the Node server)
        this.unsubscribeEvents = gameEvents.on(e => this.events.push(e));
    }

    join(id: string, req: JoinRequest): JoinResult {
        if (this.state.players.some(p => p.id === id)) return { ok: false, reason: 'already_joined' };
        const humans = this.state.players.filter(p => p.type === 'player').length;
        if (humans >= this.config.maxPlayers) return { ok: false, reason: 'full' };

        const team = pickTeam(this.state);
        const player = createJoinedPlayer(id, req, this.state.mode, team);
        const hunger = this.state.mode === GameMode.HUNGER_GAMES;
        const duel = this.state.mode === GameMode.DUEL;
        if (duel) player.pos = duelSpawnPoint(this.state, id); // opposite side from the opponent
        if (hunger) {
            // A round is in progress: watch until the next one (spec phase 2, H1)
            player.dead = true;
            player.respawnTimer = Number.MAX_SAFE_INTEGER;
        }

        // Take a bot's slot (same team in team modes) to keep the match size stable.
        // Hunger Games keeps its fighters; bots make room at the next round instead.
        // A duel's bot is the opponent, so it stays.
        const botIndex = hunger || duel ? -1 : this.state.players.findIndex(p => p.type === 'bot' && p.team === team);
        if (botIndex !== -1) {
            this.physics.removeBody(this.state.players[botIndex].id);
            this.state.players[botIndex] = player;
        } else {
            this.state.players.push(player);
        }

        this.physics.addPlayer(player);
        this.inputs.set(id, new InputQueue());
        return { ok: true };
    }

    leave(id: string) {
        this.physics.removeBody(id);
        this.state.players = this.state.players.filter(p => p.id !== id);
        this.inputs.delete(id);
    }

    /** Returns false if the input was dropped. */
    pushInput(id: string, input: PlayerInput): boolean {
        return this.inputs.get(id)?.push(input) ?? false;
    }

    /** Advance the simulation by one fixed step. */
    tick() {
        const inputs: Record<string, PlayerInput> = {};
        for (const [id, queue] of this.inputs) {
            const input = queue.next();
            if (!input) continue;
            inputs[id] = input;
            const player = this.state.players.find(p => p.id === id);
            if (!player) continue;
            player.lastProcessedInput = input.sequence;
            const selected = input.weaponIndex !== undefined ? player.inventory[input.weaponIndex] : undefined;
            if (selected) player.weapon = selected;
        }

        // Same order as the offline client loop
        this.physics.step(FIXED_STEP_MS);
        this.physics.syncGameState(this.state);
        updatePhysics(this.state, {}, { x: 0, y: 0 }, false, false, 0, 0, this.spawnPoint, '', inputs);
        this.physics.syncFromGameState(this.state);
        this.clampBodySpeed();

        if (this.state.mode === GameMode.HUNGER_GAMES && isHungerRoundOver(this.state, Date.now())) {
            resetHungerRound(this.state, Date.now());
            this.syncBodies();
        }
        if (this.config.restartMatches !== false && isMatchOver(this.state, Date.now())) {
            resetMatch(this.state);
            this.syncBodies();
        }
    }

    snapshot(now: number): Snapshot {
        return buildSnapshot(this.state, now);
    }

    drainEvents(): GameEvent[] {
        const out = this.events;
        this.events = [];
        return out;
    }

    dispose() {
        this.unsubscribeEvents();
        this.physics.clear();
    }

    /** Bodies for exactly the current players (after bots were removed between rounds). */
    private syncBodies() {
        const ids = new Set(this.state.players.map(p => p.id));
        for (const id of [...this.physics.bodies.keys()]) {
            if (!ids.has(id) && !this.state.platforms.some(pl => pl.id === id)) this.physics.removeBody(id);
        }
        this.physics.syncFromGameState(this.state);
    }

    private clampBodySpeed() {
        for (const player of this.state.players) {
            const body = this.physics.bodies.get(player.id);
            if (!body || Math.abs(body.velocity.x) <= MAX_BODY_SPEED_X) continue;
            this.physics.setVelocity(player.id, { x: Math.sign(body.velocity.x) * MAX_BODY_SPEED_X, y: body.velocity.y });
        }
    }
}
