import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Entity, GameState, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { makeState, makeBot } from '../../test/botFixtures';
import { piece } from '../cover/coverTestKit';
import { Cover } from '../cover/coverTypes';
import { clearBotMemory, updateBotAI } from './bot';
import { preferredRange } from './botCombatMoves';
import { BOT_FLAME_PREFERRED_RANGE, FLAME_RANGE } from './flameConstants';

beforeEach(() => clearBotMemory());
afterEach(() => { vi.restoreAllMocks(); });

// A long floor at y 0 (pos = centre-x, bottom-y); the bot at x `botX`, one standing enemy at `enemyX`
const setup = (weapons: WeaponType[], enemyX: number, botX = 0, cover: Cover[] = []) => {
    const state: GameState = { ...makeState(), cover };
    state.platforms = [{ id: 'floor', x: -1000, y: 0, w: 3000, h: 100, color: '#000' }];
    const bot = makeBot('bot', Team.NONE, botX, 0) as unknown as Entity;
    bot.inventory = weapons.map(t => ({ ...WEAPONS_DATA[t] }));
    bot.weapon = bot.inventory[0];
    const enemy = makeBot('enemy', Team.NONE, enemyX, 0) as unknown as Entity;
    state.players = [bot, enemy];
    const think = (now: number) => updateBotAI(bot, state, now, () => {});
    return { bot, think };
};
const FLAME_AND_GUN = [WeaponType.FLAMETHROWER, WeaponType.MACHINE_GUN];
const GUN_AND_FLAME = [WeaponType.MACHINE_GUN, WeaponType.FLAMETHROWER];

describe('preferredRange', () => {
    it('keeps 320 for a gun and 120 for a shotgun or chainsaw', () => {
        expect(preferredRange(setup([WeaponType.MACHINE_GUN], 300).bot)).toBe(320);
        expect(preferredRange(setup([WeaponType.SHOTGUN, WeaponType.FLAMETHROWER], 300).bot)).toBe(120);
        expect(preferredRange(setup([WeaponType.CHAINSAW], 300).bot)).toBe(120);
    });

    it('is the flame standoff with a flamethrower in hand or in the pack', () => {
        expect(preferredRange(setup(FLAME_AND_GUN, 300).bot)).toBe(BOT_FLAME_PREFERRED_RANGE);
        expect(preferredRange(setup(GUN_AND_FLAME, 300).bot)).toBe(BOT_FLAME_PREFERRED_RANGE);
    });

    it('stops inside the distance where pickBestWeapon swaps to the flamethrower', () => {
        expect(BOT_FLAME_PREFERRED_RANGE).toBeLessThan(FLAME_RANGE - 20);
    });

    it('falls back to 320 when the flamethrower is empty', () => {
        const { bot } = setup(GUN_AND_FLAME, 300);
        bot.inventory[1].ammo = 0;
        expect(preferredRange(bot)).toBe(320);
        const inHand = setup(FLAME_AND_GUN, 300).bot;
        inHand.weapon.ammo = 0;
        expect(preferredRange(inHand)).toBe(320);
    });
});

describe('a bot with a flamethrower closes in', () => {
    it('walks towards an enemy 250 px away, with the flamethrower or the gun in hand', () => {
        expect(setup(FLAME_AND_GUN, 250).think(10_000).inputX).toBe(1);
        const gunInHand = setup(GUN_AND_FLAME, 250);
        expect(gunInHand.think(10_000).inputX).toBe(1);
        expect(gunInHand.bot.weapon.type).toBe(WeaponType.FLAMETHROWER); // swapped in under 280 px
    });

    it('does not back off at 150 px (a gun bot would)', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // the strafe roll: away when too close, else sideways towards
        expect(setup(FLAME_AND_GUN, 150).think(10_000).inputX).not.toBe(-1);
        clearBotMemory(); // both bots are called 'bot': forget the first one's strafe
        expect(setup([WeaponType.MACHINE_GUN], 150).think(10_000).inputX).toBe(-1);
    });
});

describe('a bot with a flamethrower and cover', () => {
    // Crate at 100 with its far-side spot at x 57: the bot stands there, the enemy 250 px from the origin
    const crate = () => [piece('crate', 'wood', 100, 0)];

    it('does not hide just because the enemy is inside 320 px', () => {
        expect(setup([WeaponType.MACHINE_GUN], 250, 57, crate()).think(10_000).wantsDown).toBe(true); // control
        clearBotMemory();
        const flame = setup(FLAME_AND_GUN, 250, 57, crate()).think(10_000);
        expect(flame.wantsDown).toBeFalsy();
        expect(flame.inputX).toBe(1);
    });

    it('does not hide at close range either', () => {
        expect(setup(FLAME_AND_GUN, 200, 57, crate()).think(10_000).wantsDown).toBeFalsy();
    });

    it('still ducks behind the crate after a hit', () => {
        const { bot, think } = setup(FLAME_AND_GUN, 250, 0, crate());
        think(10_000);
        bot.health -= 10;
        expect(think(10_008).inputX).toBe(1); // heads for the spot at x 57
        bot.pos.x = 57;
        expect(think(10_016).wantsDown).toBe(true);
    });
});
