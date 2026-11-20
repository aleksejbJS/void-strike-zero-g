import type { Entity, GameState, Vector2 } from '../../../types';
import { segmentRectEntry } from '../../utils/math';
import { mapPoint } from './layout';

export const LAST_STOP_SPAWNS: readonly Vector2[] = [
    mapPoint(41, 491), mapPoint(278, 491), mapPoint(292, 246),
    mapPoint(756, 455), mapPoint(988, 515), mapPoint(715, 280),
    mapPoint(1498, 501), mapPoint(1678, 491), mapPoint(1520, 164),
    mapPoint(257, 765), mapPoint(756, 780), mapPoint(1519, 755),
];

const MIN_SEPARATION = 130;

export const lastStopSpawn = (
    state: Pick<GameState, 'platforms' | 'players'>,
    occupants: readonly Entity[] = state.players,
): Vector2 => {
    const opponents = occupants.filter(p => !p.dead);
    let best = LAST_STOP_SPAWNS[0];
    let bestScore = -Infinity;
    for (const pos of LAST_STOP_SPAWNS) {
        const chest = { x: pos.x, y: pos.y - 40 };
        let nearest = Infinity;
        let exposed = 0;
        for (const enemy of opponents) {
            const distance = Math.hypot(pos.x - enemy.pos.x, pos.y - enemy.pos.y);
            nearest = Math.min(nearest, distance);
            if (distance > 2200) continue;
            const eye = { x: enemy.pos.x, y: enemy.pos.y - enemy.height * 0.7 };
            if (!state.platforms.some(p => segmentRectEntry(eye, chest, p) !== null)) exposed++;
        }
        const score = (nearest < MIN_SEPARATION ? -100_000 : 0) - exposed * 3000 + Math.min(nearest, 3000);
        if (score > bestScore) {
            best = pos;
            bestScore = score;
        }
    }
    return { ...best };
};
