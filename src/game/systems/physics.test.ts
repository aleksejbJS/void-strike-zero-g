import { describe, it, expect, vi } from 'vitest';
import { GameState, GameMode, ItemType, WeaponType, Entity, Team } from '../../types';
import { getInitialPickups } from '../data/level';
import { updatePhysics } from './physics';
import { GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../../constants';

// Helper to create a mock state
const createMockState = (mode: GameMode): GameState => ({
    mode,
    scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
    players: [],
    projectiles: [],
    particles: [],
    platforms: [],
    pickups: [],
    decals: [],
    floatingTexts: [],
    camera: { x: 0, y: 0, zoom: 1 },
    beams: [],
});

// Helper to create a mock player
const createMockPlayer = (id: string, team: Team): Entity => ({
    id,
    type: 'player',
    team,
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    width: 30,
    height: 72,
    color: '#ffffff',
    health: 100,
    maxHealth: 100,
    armor: 0,
    maxArmor: 100,
    jetpackFuel: 100,
    maxFuel: 100,
    inventory: [],
    weapon: {
        type: WeaponType.MACHINE_GUN,
        name: 'Machine Gun',
        damage: 10,
        fireRate: 100,
        speed: 10,
        color: '#fff',
        ammo: 100,
        maxAmmo: 100,
        recoil: 0
    },
    isGrounded: false,
    isCrouching: false,
    facingRight: true,
    score: 0,
    dead: false,
    respawnTimer: 0,
    name: 'TestPlayer',
    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
    hasFlag: Team.NONE,
    lastFired: 0,
    gunLevel: 0,
    gunProgress: 0,
    jetpackColor: '#fff',
    skinId: 'classic',
    lastDash: 0,
    lastProcessedInput: 0
});

describe('Gun Game Logic', () => {
    it('should not have weapon pickups in Gun Game mode', () => {
        const pickups = getInitialPickups(GameMode.GUN_GAME);
        const weaponPickups = pickups.filter(p => p.type === ItemType.WEAPON);
        expect(weaponPickups.length).toBe(0);
    });

    it('should upgrade weapon after required kills', () => {
        const state = createMockState(GameMode.GUN_GAME);
        const player = createMockPlayer('p1', Team.BLUE);
        const victim = createMockPlayer('p2', Team.RED);

        // Position victim so projectile hits center mass
        victim.pos = { x: 200, y: 200 };

        state.players.push(player, victim);

        // Mock setKillFeed
        const setKillFeed = vi.fn();

        // Simulate kills up to level up
        for (let i = 0; i < GUN_GAME_KILLS_PER_LEVEL; i++) {
            // Reset victim
            victim.dead = false;
            victim.health = 10; // Low health to ensure 1-shot

            // Create a projectile from 'player' that hits 'victim'
            state.projectiles.push({
                id: `proj_${i}`,
                ownerId: player.id,
                type: WeaponType.ROCKET_LAUNCHER,
                pos: { x: 200, y: 170 }, // Center of victim
                vel: { x: 0, y: 0 },
                active: true,
                radius: 5
            });

            // Run physics update
            updatePhysics(state, {}, {}, false, false, 800, 600, setKillFeed, true, () => ({ x: 0, y: 0 }), 'p1');
        }

        // After GUN_GAME_KILLS_PER_LEVEL kills, level should increase
        expect(player.gunLevel).toBe(1);
        expect(player.gunProgress).toBe(0);
        expect(player.weapon.type).toBe(GUN_GAME_LADDER[1]);
    });

    it('should downgrade weapon on death', () => {
        const state = createMockState(GameMode.GUN_GAME);
        const player = createMockPlayer('p1', Team.BLUE);
        const killer = createMockPlayer('p2', Team.RED);

        // Set player to level 2
        player.gunLevel = 2;
        player.weapon.type = GUN_GAME_LADDER[2];
        player.pos = { x: 100, y: 100 };

        state.players.push(player, killer);

        // Kill the player via damage
        player.health = 1;

        // Projectile from killer hits player
        state.projectiles.push({
            id: 'death_proj',
            ownerId: killer.id,
            type: WeaponType.ROCKET_LAUNCHER,
            pos: { x: 100, y: 70 }, // Center mass
            vel: { x: 0, y: 0 },
            active: true,
            radius: 5
        });

        // Run physics to process death
        const getSpawnPoint = () => ({ x: 0, y: 0 });
        updatePhysics(state, {}, {}, false, false, 800, 600, vi.fn(), true, getSpawnPoint, 'p1');

        // Should have downgraded to level 1
        expect(player.gunLevel).toBe(1);
        expect(player.weapon.type).toBe(GUN_GAME_LADDER[1]);
    });
});
