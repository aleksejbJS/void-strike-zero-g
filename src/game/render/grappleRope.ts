// Grapple rope from the fighter's shoulder to the hook, drawn inside the player's container.

import { Container, Graphics } from 'pixi.js';
import { Entity, Vector2 } from '../../types';

const LABEL = 'grappleRope';

/** `shoulder` is relative to the player's feet, in world pixels. */
export const drawGrappleRope = (c: Container, p: Entity, shoulder: Vector2, now: number) => {
    let rope = c.getChildByLabel(LABEL) as Graphics | null;
    if (!p.grapple.active) {
        if (rope) { c.removeChild(rope); rope.destroy(); }
        return;
    }
    if (!rope) {
        rope = new Graphics();
        rope.label = LABEL;
        c.addChildAt(rope, 0); // behind the fighter
    }
    rope.clear();

    const start = shoulder;
    const end = { x: p.grapple.pos.x - p.pos.x, y: p.grapple.pos.y - p.pos.y };
    const dx = end.x - start.x, dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const segments = Math.max(8, Math.floor(length / 20));
    const time = now * 0.003;

    rope.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 3, color: 0x94a3b8, alpha: 0.8 });
    rope.moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ width: 6, color: 0x60a5fa, alpha: 0.3 });

    // Chain links with a slight wave
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const wave = Math.sin(time + i * 0.5) * 2;
        const x = start.x + dx * t - (dy / length) * wave;
        const y = start.y + dy * t + (dx / length) * wave;
        const size = 2 + Math.sin(time * 2 + i) * 0.5;
        rope.circle(x, y, size).fill({ color: 0xe2e8f0, alpha: 0.9 });
        rope.circle(x, y, size + 1).stroke({ width: 1, color: 0x64748b, alpha: 0.6 });
    }

    const hookSize = 6;
    rope.circle(end.x, end.y, hookSize).fill(0x475569);
    rope.circle(end.x, end.y, hookSize - 2).fill(0x94a3b8);
    const pulse = 1 + Math.sin(time * 3) * 0.2;
    rope.circle(end.x, end.y, hookSize * pulse * 1.5).fill({ color: 0x60a5fa, alpha: 0.3 });
};
