// The per-view sprite cache syncVisuals fills (the same shape GameCanvas keeps), plus the view's own fighter
// animator: tiles show the same player ids, so they must not share run cycles, recoil or landing state.

import { Container, Graphics, Texture } from 'pixi.js';
import { FighterAnimator } from '../fighter/fighterAnimator';
import type { ProjectileView } from '../projectiles/projectileView';
import type { ParticleView } from '../effects/particleView';
import type { FlameFx } from '../flame/flameFx';
import type { FlameQuality } from '../flame/flameTuning';
import type { BeamView } from '../projectiles/beamView';
import type { SmokeView } from '../effects/smokeView';
import type { CoverView } from '../cover/coverView';
import type { CorpseView } from '../ragdoll/corpseView';

export const newVisualCache = (textures: Record<string, Texture>) => ({
    players: new Map<string, Container>(),
    projectileView: null as ProjectileView | null,
    particleView: null as ParticleView | null,
    flameFx: null as FlameFx | null,
    flameQuality: 'low' as FlameQuality, // several tiles share one screen
    pickups: new Map<string, Container>(),
    decals: new Map<string, Graphics>(),
    floatingTexts: new Map<string, Container>(),
    beamView: null as BeamView | null,
    smokeView: null as SmokeView | null,
    coverView: null as CoverView | null,
    corpses: new Map<string, CorpseView>(),
    textures,
    animator: new FighterAnimator(),
});
