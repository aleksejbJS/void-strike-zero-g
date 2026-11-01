// F3 debug overlay: each bot's planned route on the navigation graph, for tuning by eye.
// Offline play only — online the bots think on the server or in the host's worker.

import { Graphics } from 'pixi.js';
import { GameState, Vector2 } from '../../types';
import { peekBotMemory } from '../systems/botMemory';
import { EdgeKind } from '../systems/botNavGraph';

const KIND_COLOR: Record<EdgeKind, number> = { walk: 0xe2e8f0, drop: 0x38bdf8, jet: 0xfb923c, hook: 0xa3e635 };
const RUN_COLOR = 0x94a3b8;
const LIFT = 6; // draw a little above the surface so the line isn't hidden by it

export const drawBotPaths = (g: Graphics, state: GameState, visible: boolean) => {
    g.clear();
    if (!visible) return;
    for (const bot of state.players) {
        if (bot.type !== 'bot' || bot.dead) continue;
        const nav = peekBotMemory(bot.id)?.nav;
        if (!nav?.graph || nav.path.length === 0) continue;
        const { nodes } = nav.graph;
        let at: Vector2 = { x: bot.pos.x, y: bot.pos.y - LIFT };
        for (const e of nav.path) {
            const start = { x: e.startX, y: nodes[e.from].y - LIFT };
            const end = { x: e.endX, y: nodes[e.to].y - LIFT };
            // Run along the surface to where the move starts, then the move itself
            g.moveTo(at.x, at.y).lineTo(start.x, start.y).stroke({ width: 2, color: RUN_COLOR, alpha: 0.5 });
            g.moveTo(start.x, start.y);
            if (e.anchor) g.lineTo(e.anchor.x, e.anchor.y).circle(e.anchor.x, e.anchor.y, 5).moveTo(e.anchor.x, e.anchor.y);
            g.lineTo(end.x, end.y).stroke({ width: 3, color: KIND_COLOR[e.kind], alpha: 0.9 });
            at = end;
        }
        g.circle(at.x, at.y, 8).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
    }
};
