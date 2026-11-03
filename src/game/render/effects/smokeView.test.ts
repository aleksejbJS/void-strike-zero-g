import { describe, it, expect } from 'vitest';
import { Container, Text } from 'pixi.js';
import { BeamView } from '../projectiles/beamView';
import { ProjectileView } from '../projectiles/projectileView';
import { SmokeView } from './smokeView';

const cloud = { id: 'smoke_1', pos: { x: 0, y: 0 }, radius: 110, bornAt: 0, endsAt: 10_000 };

// One frame in renderer order: projectiles, (floating text added), beams, smoke last
const frame = (layer: Container, views: { proj: ProjectileView; beam: BeamView; smoke: SmokeView }, addText: boolean) => {
    views.proj.sync([], 1000);
    if (addText) layer.addChild(new Text({ text: '-25' }));
    views.beam.sync([]);
    views.smoke.sync([cloud], 1000, null);
};

describe('SmokeView stacking', () => {
    it('stays the topmost child even after a floating text reshuffles the other effect views', () => {
        const layer = new Container();
        const views = { proj: new ProjectileView(layer), beam: new BeamView(layer), smoke: new SmokeView(layer) };
        frame(layer, views, true);  // a damage number appears mid-frame
        frame(layer, views, false); // next frame the projectile view lifts itself over the text
        frame(layer, views, false);
        const top = layer.children[layer.children.length - 1];
        expect(top).toBe((views.smoke as unknown as { gfx: unknown }).gfx);
        views.smoke.clear();
        expect(layer.children).not.toContain((views.smoke as unknown as { gfx: unknown }).gfx);
    });
});
