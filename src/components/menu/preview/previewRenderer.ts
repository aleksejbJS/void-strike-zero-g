// Draws a preview director's GameState with the match renderer: the map look (backdrop and
// platform art, no ads), fighters, flags, shots, particles and ragdolls, plus the "You" label.

import { Application, Container, Graphics, Text, Texture } from 'pixi.js';
import { GameState } from '../../../types';
import { drawZoneOverlay, syncVisuals } from '../../../game/systems/renderer';
import { createMapLook, MapLook } from '../../../game/render/scene/mapLook';
import { forgetPlayerVisual } from '../../../game/render/playerVisual';
import { ProjectileView } from '../../../game/render/projectiles/projectileView';
import { ParticleView } from '../../../game/render/effects/particleView';
import { BeamView } from '../../../game/render/projectiles/beamView';
import { STAGE_H, STAGE_W, toStage, VIEW_CENTER, VIEW_SCALE } from './previewWorld';

const OFF_SCREEN = { x: -100, y: -100 }; // the renderer draws a cursor at the mouse
const LABEL_ABOVE = 92;                   // world px above the feet

export interface PreviewRenderer {
    draw(state: GameState, labelledId: string | null): void;
    destroy(): void;
}

export const createPreviewRenderer = (app: Application, state: GameState, textures: Record<string, Texture>, youText: string): PreviewRenderer => {
    const world = new Container();
    world.scale.set(VIEW_SCALE);
    app.stage.addChild(world);
    const backgroundLayer = new Graphics();
    const decalLayer = new Container();
    const zoneLayer = new Graphics();
    const platformLayer = new Graphics();
    const gameLayer = new Container();
    const uiLayer = new Container();
    world.addChild(backgroundLayer, decalLayer, zoneLayer, platformLayer, gameLayer);
    app.stage.addChild(uiLayer);

    const cache = {
        players: new Map(),
        projectileView: null as ProjectileView | null,
        particleView: null as ParticleView | null,
        pickups: new Map(),
        decals: new Map(),
        floatingTexts: new Map(),
        beamView: null as BeamView | null,
        textures,
    };
    const look: MapLook = createMapLook({ stage: app.stage, world }, world, { platformLayer, backgroundLayer, cache }, undefined, { ads: false });
    look.redraw(state, STAGE_W, STAGE_H);

    const label = new Text({
        text: youText,
        style: { fontFamily: 'Barlow, "Fira Sans", sans-serif', fontSize: 13, fontWeight: '600', fill: 0xffc21a, stroke: { color: 0x000000, width: 3 } },
    });
    label.anchor.set(0.5, 1);
    uiLayer.addChild(label);
    const shake = { current: 0 };

    return {
        draw(s, labelledId) {
            syncVisuals(app, world, gameLayer, decalLayer, uiLayer, s, cache, shake, OFF_SCREEN, null, null, null, null, null, '');
            if (s.hungerZone) drawZoneOverlay(zoneLayer, s.hungerZone);
            look.update(VIEW_CENTER, Date.now(), STAGE_W, STAGE_H);
            const labelled = labelledId ? s.players.find(p => p.id === labelledId && !p.dead) : undefined;
            label.visible = !!labelled;
            if (labelled) {
                const at = toStage({ x: labelled.pos.x, y: labelled.pos.y - LABEL_ABOVE });
                label.position.set(at.x, at.y);
            }
        },
        destroy() {
            look.destroy();
            state.players.forEach(p => forgetPlayerVisual(p.id));
        },
    };
};
