// Game Event Bus — decouples physics from UI (sound, kill feed, etc.)

import type { FighterBuild } from '../build/buildParts';
import type { Team, Vector2, WeaponType } from '../../types';
import type { DeathKind } from './deathKind';
import type { CoverKind } from '../cover/coverTypes';

export type EffectKind = 'blood' | 'spark' | 'explosion' | 'shell' | 'respawn';

/** Which objective changed hands: a CTF team flag, the Hold the Flag neutral flag, the Infiltration intel. */
export type FlagKind = 'ctf' | 'hold' | 'intel';
export type FlagAction = 'grabbed' | 'lost' | 'returned' | 'captured';
/** What happened to a piece of cover: took a hit, broke, came back. */
export type CoverAction = 'hit' | 'break' | 'restore';

export type GameEvent =
    | { type: 'KILL'; killer: string; killerColor: string; weapon: string; victim: string; victimColor: string }
    | { type: 'SOUND'; sound: string; subtype?: string }
    | { type: 'FLOAT_TEXT'; x: number; y: number; text: string; color: string }
    // Cosmetic effects at a position — see effects.ts
    // `size`: explosion scale (1 = a rocket); other effects ignore it
    | { type: 'EFFECT'; effect: EffectKind; x: number; y: number; color?: string; count?: number; size?: number }
    | { type: 'DAMAGE'; x: number; y: number; amount: number }
    // How the fighter died, for the corpse each client simulates: `kind` (missing from older hosts: fall),
    // `from` = blast centre / muzzle / beam origin, `vel` = victim velocity, `weapon` = the gun it held,
    // `blast` = killed by an explosion's splash, not a shot (missing from older hosts),
    // `oneLeg` = it had already lost a leg to a railgun wound (missing from older hosts: two legs).
    | { type: 'DEATH'; x: number; y: number; color: string; height: number; parts?: RagdollColors;
        kind?: DeathKind; from?: Vector2; vel: Vector2; facing: 1 | -1; weapon?: WeaponType; blast?: boolean; oneLeg?: boolean }
    // A railgun beam tore a leg off a fighter who survived (a wound): where it stood, which way it faced,
    // `vel` = its velocity, `from` = beam origin, `parts` = its colours for the flying leg.
    | { type: 'LIMB'; x: number; y: number; facing: 1 | -1; vel: Vector2; from?: Vector2; parts?: RagdollColors }
    // An objective changed hands (HUD banner). `team`: the flag's team for CTF grabbed/lost/returned,
    // the scoring team for CTF captured, the holder's team in Hold the Flag, NONE for intel.
    | { type: 'FLAG'; kind: FlagKind; action: FlagAction; team: Team }
    // A piece of cover changed (cosmetics + sound): `kind` picks the look, x/y = the middle of the piece.
    | { type: 'COVER'; action: CoverAction; kind: CoverKind; x: number; y: number };

export type DeathEvent = Extract<GameEvent, { type: 'DEATH' }>;
export type LimbEvent = Extract<GameEvent, { type: 'LIMB' }>;
export type CoverEvent = Extract<GameEvent, { type: 'COVER' }>;

/** Colors of the body parts that fly apart on death, and the build whose parts they keep (none: the default build). `jet`: the jetpack. */
export interface RagdollColors { head: string; torso: string; arm: string; leg: string; jet?: string; build?: FighterBuild }

type Listener = (event: GameEvent) => void;

class GameEventBus {
    private listeners: Listener[] = [];

    emit(event: GameEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    on(cb: Listener): () => void {
        this.listeners.push(cb);
        return () => {
            this.listeners = this.listeners.filter(l => l !== cb);
        };
    }

    clear(): void {
        this.listeners = [];
    }
}

export const gameEvents = new GameEventBus();
