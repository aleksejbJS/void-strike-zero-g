// What the smoke needs to know about the flame engine, and nothing more: the nozzles that spray and the soot
// the flame lets off. Read-only and structural, so the smoke code never imports the flame engine.

export interface FlameAir {
    /** Every flamethrower stream: nozzle (world px), aim (radians), trigger and fade-in power (0..1). */
    streams(): Iterable<{ x: number; y: number; angle: number; firing: boolean; power: number }>;
    /** Every live smoke particle of the flame engine: where it is (world px) and how old it is (`age` of `ttl` seconds), so
     *  the soot it leaves can thin out as it ages. */
    soot(): Iterable<{ x: number; y: number; age: number; ttl: number }>;
    /** True while any smoke particle is alive: a cheap check, so a frame with no soot walks nothing. */
    hasSoot(): boolean;
}

interface StreamLike { x: number; y: number; angle: number; firing: boolean; power: number }
interface PoolLike { readonly count: number; readonly items: readonly { alive: boolean; x: number; y: number; age: number; ttl: number }[] }

/** A FlameAir over the engine's live stream map and smoke pool. Both are read each call, never copied;
 *  the yielded records are the engine's own and must not be written or kept. */
export function flameAirOf(streams: ReadonlyMap<string, StreamLike>, smoke: PoolLike): FlameAir {
    return {
        streams: () => streams.values(),
        *soot() {
            for (const p of smoke.items) if (p.alive) yield p;
        },
        hasSoot: () => smoke.count > 0,
    };
}
