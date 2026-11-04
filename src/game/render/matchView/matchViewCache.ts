// The per-view sprite cache syncVisuals fills (the same shape GameCanvas keeps), plus the view's own fighter
// animator: tiles show the same player ids, so they must not share run cycles, recoil or landing state.

import { Container, Graphics, Texture } from 'pixi.js';
import { FighterAnimator } from '../fighter/fighterAnimator';
import type { ProjectileView } from '../projectiles/projectileView';
import type { ParticleView } from '../effects/particleView';
import type { BeamView } from '../projectiles/beamView';
import type { SmokeView } from '../effects/smokeView';
import type { CorpseView } from '../ragdoll/corpseView';

export const newVisualCache = (textures: Record<string, Texture>) => ({
    players: new Map<string, Container>(),
    projectileView: null as ProjectileView | null,
    particleView: null as ParticleView | null,
    pickups: new Map<string, Container>(),
    decals: new Map<string, Graphics>(),
    floatingTexts: new Map<string, Container>(),
    beamView: null as BeamView | null,
    smokeView: null as SmokeView | null,
    corpses: new Map<string, CorpseView>(),
    textures,
    animator: new FighterAnimator(),
});
