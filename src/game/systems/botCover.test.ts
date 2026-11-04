import { describe, it, expect } from 'vitest';
import { Entity, GameState, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { makeState, makeBot } from '../../test/botFixtures';
import { piece } from '../cover/coverTestKit';
import { Cover } from '../cover/coverTypes';
import { barrelToShoot, coverToShoot, findCoverSpot } from './botCover';

// One long floor, its top at y 1000 (pos = centre-x, bottom-y); the bot stands at x 0 and the
// threat crouches (45 px tall: a crate hides all of it, a standing fighter's head shows over one)
const FLOOR_Y = 1000;
const setup = (cover: Cover[], threatX = 300) => {
    const state: GameState = { ...makeState(), cover };
    state.platforms = [{ id: 'floor', x: -1000, y: FLOOR_Y, w: 3000, h: 100, color: '#000' }];
    const bot = makeBot('bot', Team.NONE, 0, FLOOR_Y) as unknown as Entity;
    const threat = { ...makeBot('threat', Team.NONE, threatX, FLOOR_Y), height: 45, isCrouching: true } as unknown as Entity;
    state.players = [bot, threat];
    return { state, bot, threat };
};
const armWith = (bot: Entity, type: WeaponType) => { bot.weapon = { ...WEAPONS_DATA[type] }; };

describe('findCoverSpot', () => {
    it('picks the far side of the nearest crate', () => {
        const { state, bot, threat } = setup([
            piece('behind', 'wood', -100, FLOOR_Y),  // not between bot and threat
            piece('near', 'wood', 100, FLOOR_Y),
            piece('far', 'metal', 200, FLOOR_Y),
            piece('past', 'wood', 400, FLOOR_Y),    // beyond the threat
        ]);
        // Crate side away from the threat: centre - (w/2 + 18)
        expect(findCoverSpot(state, bot, threat)).toEqual({ x: 100 - (25 + 18), y: FLOOR_Y });
    });

    it('takes the other side when the threat comes from the left', () => {
        const { state, bot, threat } = setup([piece('near', 'wood', -100, FLOOR_Y)], -300);
        expect(findCoverSpot(state, bot, threat)).toEqual({ x: -100 + 25 + 18, y: FLOOR_Y });
    });

    it('skips barrels and spots near barrels', () => {
        const { state, bot, threat } = setup([
            piece('keg', 'barrel', 30, FLOOR_Y),     // a barrel is no cover
            piece('near', 'wood', 100, FLOOR_Y),     // its spot (57) is 27 px from the barrel
            piece('next', 'wood', 250, FLOOR_Y),     // its spot (207) is 177 px from it
        ], 400);
        expect(findCoverSpot(state, bot, threat)).toEqual({ x: 207, y: FLOOR_Y });
    });

    it('finds nothing with only a barrel, a broken crate or a crate out of reach', () => {
        const broken = { ...piece('broken', 'wood', 100, FLOOR_Y), hp: 0 };
        expect(findCoverSpot(setup([piece('keg', 'barrel', 100, FLOOR_Y)]).state, setup([]).bot, setup([]).threat)).toBeNull();
        const a = setup([broken]);
        expect(findCoverSpot(a.state, a.bot, a.threat)).toBeNull();
        const b = setup([piece('far', 'wood', 500, FLOOR_Y)], 900);
        expect(findCoverSpot(b.state, b.bot, b.threat)).toBeNull(); // 500 px away, more than 400
    });
});

describe('coverToShoot', () => {
    it('ignores metal for a machine gun but not for a rocket launcher', () => {
        const { state, bot, threat } = setup([piece('plate', 'metal', 150, FLOOR_Y)]);
        expect(coverToShoot(state, bot, threat)).toBeNull();
        armWith(bot, WeaponType.ROCKET_LAUNCHER);
        expect(coverToShoot(state, bot, threat)?.id).toBe('plate');
        armWith(bot, WeaponType.GRENADE_LAUNCHER);
        expect(coverToShoot(state, bot, threat)?.id).toBe('plate');
    });

    it('shoots wood and glass with a machine gun', () => {
        const wood = setup([piece('crate', 'wood', 150, FLOOR_Y)]);
        expect(coverToShoot(wood.state, wood.bot, wood.threat)?.id).toBe('crate');
        const glass = setup([piece('pane', 'glass', 150, FLOOR_Y)]);
        expect(coverToShoot(glass.state, glass.bot, glass.threat)?.id).toBe('pane');
    });

    it('railgun ignores wood', () => {
        const { state, bot, threat } = setup([piece('crate', 'wood', 100, FLOOR_Y), piece('pane', 'glass', 200, FLOOR_Y)]);
        armWith(bot, WeaponType.RAILGUN);
        expect(coverToShoot(state, bot, threat)).toBeNull();
    });

    it('never shoots down the crate the bot hides behind', () => {
        const { state, bot, threat } = setup([piece('mine', 'wood', 43, FLOOR_Y)]); // bot on its far-side spot
        expect(coverToShoot(state, bot, threat)).toBeNull();
    });

    it('shoots over a crate at a standing target instead of into it', () => {
        const { state, bot, threat } = setup([piece('crate', 'wood', 150, FLOOR_Y)]);
        Object.assign(threat, { height: 72, isCrouching: false });
        expect(coverToShoot(state, bot, threat)).toBeNull();
    });

    it('never with a chainsaw: it cannot reach the cover from here', () => {
        const { state, bot, threat } = setup([piece('crate', 'wood', 150, FLOOR_Y)]);
        armWith(bot, WeaponType.CHAINSAW);
        expect(coverToShoot(state, bot, threat)).toBeNull();
    });

    it('is null with nothing in the way', () => {
        const { state, bot, threat } = setup([piece('aside', 'wood', -150, FLOOR_Y)]);
        expect(coverToShoot(state, bot, threat)).toBeNull();
    });
});

describe('barrelToShoot', () => {
    // Barrel at x 300 (centre 23 px above the floor), enemy 100 px past it
    const barrelSetup = (botX = 0) => {
        const { state, bot } = setup([piece('keg', 'barrel', 300, FLOOR_Y)]);
        bot.pos.x = botX;
        const enemy = makeBot('enemy', Team.BLUE, 400, FLOOR_Y) as unknown as Entity;
        state.players = [bot, enemy];
        return { state, bot, enemy };
    };

    it('shoots a barrel with an enemy next to it', () => {
        const { state, bot } = barrelSetup();
        expect(barrelToShoot(state, bot)?.id).toBe('keg');
    });

    it('refuses when a teammate or the bot is in the radius', () => {
        const mate = barrelSetup();
        mate.bot.team = Team.RED;
        mate.enemy.team = Team.BLUE;
        mate.state.players.push({ ...makeBot('mate', Team.RED, 150, FLOOR_Y) } as unknown as Entity); // 152 px from the centre
        expect(barrelToShoot(mate.state, mate.bot)).toBeNull();

        const self = barrelSetup(140); // 162 px from the centre: inside 170 + 20
        expect(barrelToShoot(self.state, self.bot)).toBeNull();
    });

    // The barrel's centre is 23 px above the floor: x 122 is 179.5 px from it (past the 170 px blast,
    // inside the 20 px margin), x 106 is 195.4 px (past the margin)
    it('never with a chainsaw: it cannot set a barrel off from range', () => {
        const { state, bot } = barrelSetup();
        armWith(bot, WeaponType.CHAINSAW);
        expect(barrelToShoot(state, bot)).toBeNull();
    });

    it('keeps a teammate 20 px clear of the blast', () => {
        const withMate = (mateX: number) => {
            const s = barrelSetup();
            s.bot.team = Team.RED;
            s.enemy.team = Team.BLUE;
            s.state.players.push({ ...makeBot('mate', Team.RED, mateX, FLOOR_Y) } as unknown as Entity);
            return barrelToShoot(s.state, s.bot);
        };
        expect(withMate(122)).toBeNull();
        expect(withMate(106)?.id).toBe('keg');
    });

    it('keeps the bot itself 20 px clear of the blast', () => {
        const near = barrelSetup(122);
        expect(barrelToShoot(near.state, near.bot)).toBeNull();
        const clear = barrelSetup(106);
        expect(barrelToShoot(clear.state, clear.bot)?.id).toBe('keg');
    });

    it('refuses with no enemy in the radius, or a barrel it cannot see', () => {
        const lonely = barrelSetup();
        lonely.enemy.pos.x = 600;
        expect(barrelToShoot(lonely.state, lonely.bot)).toBeNull();

        const hidden = barrelSetup();
        hidden.state.cover!.push(piece('crate', 'wood', 150, FLOOR_Y)); // blocks the view of the barrel
        expect(barrelToShoot(hidden.state, hidden.bot)).toBeNull();
    });
});
