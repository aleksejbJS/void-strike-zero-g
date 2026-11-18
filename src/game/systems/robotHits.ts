// What a hit on a fighter throws: red blood, or sparks and a few oil drops for a robot.
// Uses the existing `spark` and `blood` effects, so the network protocol is unchanged.
import type { Entity } from '../../types';
import { emitEffect } from './effects';
import { ROBOT_OIL, ROBOT_SPARK, isRobotEntity } from './robotDamage';

export const emitHitEffect = (victim: Pick<Entity, 'build' | 'skinId'>, x: number, y: number): void => {
    if (!isRobotEntity(victim)) {
        emitEffect('blood', x, y, '#ef4444', 6);
        return;
    }
    emitEffect('spark', x, y, ROBOT_SPARK, 6);
    emitEffect('blood', x, y, ROBOT_OIL, 3);
};
