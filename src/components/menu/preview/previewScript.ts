// Scripts for the menu's mode previews: where each actor is at every moment of the loop,
// what it aims at, when it fires, dies and respawns. Pure data plus pure sampling, so the
// director only has to turn a sample into a GameState.

import { ItemType, Team, Vector2, WeaponType } from '../../../types';

/** How an actor travels from a key to the next one. */
export type Move = 'ground' | 'jet' | 'fall';

export interface Key {
    t: number;     // seconds into the loop
    x: number;     // feet position in preview-world px
    y: number;
    move?: Move;   // travel to the next key (default: ground)
}

/** Aim at another actor (by id) or at a point, for a time window. */
export interface Aim {
    from: number;
    to: number;
    at: string | Vector2;
}

export interface Shot {
    t: number;
    target: string;  // actor id
    hit: boolean;    // a miss flies past the target
}

/** Who the actor looks like: the viewer's own fighter or a standard bot colour. */
export type ActorLook = 'you' | 'red' | 'blue' | 'green';

export interface ActorScript {
    id: string;
    look: ActorLook;
    team: Team;
    weapon: WeaponType;
    keys: Key[];          // first at t = 0, last at t = duration, same spot for a seamless loop
    aims?: Aim[];
    shots?: Shot[];
    death?: { at: number; respawn: number; killer: string };
    hide?: Span;          // off stage without a ragdoll (walks back unseen), respawn flash at `to`
    weapons?: { t: number; weapon: WeaponType }[]; // switches after the start weapon (Gun Game)
    carry?: (Span & { team: Team })[];              // holds a flag or the intel
    label?: boolean;      // draw the "You" label over this actor
}

export interface Span {
    from: number;
    to: number;
}

/** Something lying on the map: a flag at its base, the intel case. Hidden while carried. */
export interface PropScript {
    id: string;
    type: ItemType;
    team?: Team;
    pos: Vector2;
    hidden?: Span[];
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface ModeScript {
    duration: number;     // loop length, seconds
    actors: ActorScript[];
    props?: PropScript[];
    texts?: { t: number; actor: string; text: string; color?: string }[]; // floating "+1" etc.
    zone?: { wide: Rect; tight: Rect };  // Hunger Games zone: shrinks to `tight` mid-loop, then reopens
}

export interface ActorSample {
    pos: Vector2;
    vel: Vector2;   // px per second
    move: Move;
}

const easing: Record<Move, (k: number) => number> = {
    ground: k => k,                                   // steady run, so the stride matches the speed
    jet: k => (1 - Math.cos(Math.PI * k)) / 2,        // jetpack: eases in and out
    fall: k => k * k,                                 // falling: picks up speed
};

const DT = 1 / 120;

const positionAt = (keys: Key[], t: number): { pos: Vector2; move: Move } => {
    if (t <= keys[0].t) return { pos: { x: keys[0].x, y: keys[0].y }, move: keys[0].move ?? 'ground' };
    for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        if (t > b.t) continue;
        const move = a.move ?? 'ground';
        const k = b.t > a.t ? easing[move]((t - a.t) / (b.t - a.t)) : 1;
        return { pos: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, move };
    }
    const last = keys[keys.length - 1];
    return { pos: { x: last.x, y: last.y }, move: last.move ?? 'ground' };
};

/** Where the actor is at time t, how fast it moves and how (run, jetpack, fall). */
export const sampleActor = (a: ActorScript, t: number): ActorSample => {
    const now = positionAt(a.keys, t);
    const next = positionAt(a.keys, t + DT);
    return {
        pos: now.pos,
        vel: { x: (next.pos.x - now.pos.x) / DT, y: (next.pos.y - now.pos.y) / DT },
        move: now.move,
    };
};

const within = (span: Span | undefined, t: number) => !!span && t >= span.from && t < span.to;

export const isDeadAt = (a: ActorScript, t: number) =>
    (!!a.death && t >= a.death.at && t < a.death.respawn) || within(a.hide, t);

export const weaponAt = (a: ActorScript, t: number): WeaponType =>
    a.weapons?.filter(w => w.t <= t).pop()?.weapon ?? a.weapon;

export const carriedAt = (a: ActorScript, t: number): Team =>
    a.carry?.find(c => within(c, t))?.team ?? Team.NONE;

export const isPropHidden = (p: PropScript, t: number) => !!p.hidden?.some(h => within(h, t));

/** The Hunger Games zone at time t: wide at the loop seam, tight in the middle. */
export const zoneAt = (zone: NonNullable<ModeScript['zone']>, t: number, duration: number): Rect => {
    const k = (1 - Math.cos((2 * Math.PI * t) / duration)) / 2;
    const mix = (a: number, b: number) => a + (b - a) * k;
    return { x: mix(zone.wide.x, zone.tight.x), y: mix(zone.wide.y, zone.tight.y), w: mix(zone.wide.w, zone.tight.w), h: mix(zone.wide.h, zone.tight.h) };
};

/** What the actor aims at, if anything, at time t. */
export const aimTargetAt = (a: ActorScript, t: number) => a.aims?.find(w => t >= w.from && t < w.to)?.at;

/** Whether `at` lies in (from, to], wrapping past the loop end. */
export const crossed = (at: number, from: number, to: number) =>
    from <= to ? at > from && at <= to : at > from || at <= to;
