import Matter from 'matter-js';
import { Platform, Entity, Vector2 } from '../../types';

export class MatterPhysicsEngine {
    public engine: Matter.Engine;
    public world: Matter.World;

    // Maps game entity/platform ID to Matter.Body
    public bodies: Map<string, Matter.Body> = new Map();
    // Reverse map: Matter body id -> game id (for collision lookups)
    private bodyToId: Map<number, string> = new Map();
    // Set of player IDs currently grounded
    private groundedSet: Set<string> = new Set();

    constructor() {
        this.engine = Matter.Engine.create();
        this.world = this.engine.world;

        // Gravity managed by Force Pipeline (movement.ts) — Matter handles collisions only
        this.world.gravity.x = 0;
        this.world.gravity.y = 0;

        // Clear grounded state before each physics step
        Matter.Events.on(this.engine, 'beforeUpdate', () => {
            this.groundedSet.clear();
        });

        // Detect grounding from active collisions (fires every step for ongoing contacts)
        Matter.Events.on(this.engine, 'collisionActive', (event) => {
            for (const pair of event.pairs) {
                this.checkGrounding(pair);
            }
        });

        // Also check on collision start (first frame of contact)
        Matter.Events.on(this.engine, 'collisionStart', (event) => {
            for (const pair of event.pairs) {
                this.checkGrounding(pair);
            }
        });
    }

    private checkGrounding(pair: Matter.Pair) {
        const { bodyA, bodyB } = pair;

        let playerBody: Matter.Body | null = null;
        let otherBody: Matter.Body | null = null;

        if (bodyA.label === 'player' && bodyB.isStatic) {
            playerBody = bodyA;
            otherBody = bodyB;
        } else if (bodyB.label === 'player' && bodyA.isStatic) {
            playerBody = bodyB;
            otherBody = bodyA;
        }

        if (!playerBody || !otherBody) return;

        // Player is grounded if their bottom edge is near the platform's top edge
        const playerBottom = playerBody.bounds.max.y;
        const platformTop = otherBody.bounds.min.y;

        // Also check horizontal overlap to avoid wall-hugging counting as grounded
        const playerLeft = playerBody.bounds.min.x;
        const playerRight = playerBody.bounds.max.x;
        const otherLeft = otherBody.bounds.min.x;
        const otherRight = otherBody.bounds.max.x;
        const horizontalOverlap = Math.min(playerRight, otherRight) - Math.max(playerLeft, otherLeft);

        if (horizontalOverlap > 3 && playerBottom >= platformTop - 5 && playerBottom <= platformTop + 15) {
            const playerId = this.bodyToId.get(playerBody.id);
            if (playerId) this.groundedSet.add(playerId);
        }
    }

    public step(deltaMs: number) {
        Matter.Engine.update(this.engine, deltaMs);
    }

    public addPlatform(platform: Platform) {
        const centerX = platform.x + platform.w / 2;
        const centerY = platform.y + platform.h / 2;

        const body = Matter.Bodies.rectangle(centerX, centerY, platform.w, platform.h, {
            isStatic: true,
            friction: 0.1,
            restitution: 0.2,
            label: 'platform'
        });

        this.bodies.set(platform.id, body);
        this.bodyToId.set(body.id, platform.id);
        Matter.World.add(this.world, body);
    }

    public addPlayer(player: Entity) {
        // Game coords: pos.x = centerX, pos.y = bottomY (feet)
        const centerX = player.pos.x;
        const centerY = player.pos.y - player.height / 2;

        const body = Matter.Bodies.rectangle(centerX, centerY, player.width, player.height, {
            isStatic: false,
            friction: 0,         // Force Pipeline owns all friction
            frictionAir: 0,      // Force Pipeline owns all air resistance
            restitution: 0,
            inertia: Infinity,
            label: 'player'
        });

        this.bodies.set(player.id, body);
        this.bodyToId.set(body.id, player.id);
        Matter.World.add(this.world, body);
    }

    public setPosition(id: string, position: Vector2) {
        const body = this.bodies.get(id);
        if (!body) return;
        // Game coords (centerX, bottomY) → Matter center
        const h = body.bounds.max.y - body.bounds.min.y;
        Matter.Body.setPosition(body, { x: position.x, y: position.y - h / 2 });
    }

    public applyForce(id: string, force: Vector2) {
        const body = this.bodies.get(id);
        if (!body) return;
        Matter.Body.applyForce(body, body.position, force);
    }

    public setVelocity(id: string, velocity: Vector2) {
        const body = this.bodies.get(id);
        if (!body) return;
        Matter.Body.setVelocity(body, velocity);
    }

    public removeBody(id: string) {
        const body = this.bodies.get(id);
        if (body) {
            Matter.World.remove(this.world, body);
            this.bodyToId.delete(body.id);
            this.bodies.delete(id);
        }
    }

    public clear() {
        Matter.World.clear(this.world, false);
        Matter.Engine.clear(this.engine);
        this.bodies.clear();
        this.bodyToId.clear();
        this.groundedSet.clear();
    }

    // Sync Matter.js positions/velocities back to game state
    public syncGameState(state: { platforms: Platform[], players: Entity[] }) {
        for (const player of state.players) {
            const body = this.bodies.get(player.id);
            if (body) {
                // Matter center → game coords (centerX, bottomY)
                player.pos.x = body.position.x;
                player.pos.y = body.position.y + player.height / 2;

                player.vel.x = body.velocity.x;
                player.vel.y = body.velocity.y;

                // Set grounded state from collision detection
                player.isGrounded = this.groundedSet.has(player.id);
            }
        }
    }

    // Resize the body when the player's height changes (crouch/stand).
    // Position is re-anchored to the feet by the caller right after.
    private matchBodyHeight(body: Matter.Body, height: number) {
        const current = body.bounds.max.y - body.bounds.min.y;
        if (Math.abs(current - height) < 0.01) return;
        Matter.Body.scale(body, 1, height / current);
        // scale() recomputes inertia; keep the player from rotating
        Matter.Body.setInertia(body, Infinity);
    }

    // Push game state velocity/position changes back to Matter bodies
    // Call this after updatePhysics modifies velocities (jetpack, grapple, bots, etc.)
    public syncFromGameState(state: { players: Entity[] }) {
        for (const player of state.players) {
            const body = this.bodies.get(player.id);
            if (body) {
                this.matchBodyHeight(body, player.height);
                // Dead players must not block others: make the body a non-colliding sensor until respawn
                if (body.isSensor !== player.dead) body.isSensor = player.dead;
                const vel = player.dead ? { x: 0, y: 0 } : player.vel;
                Matter.Body.setVelocity(body, { x: vel.x, y: vel.y });
                // Game coords (centerX, bottomY) → Matter center
                const centerX = player.pos.x;
                const centerY = player.pos.y - player.height / 2;
                Matter.Body.setPosition(body, { x: centerX, y: centerY });
            }
        }
    }
}
