// FNV-1a hash of the id seeds a small PRNG (mulberry32): the same id always gives the same sequence,
// so smoke layouts and swirls repeat across frames, clients and tests. Smoke code never draws unseeded random numbers.
export const seededRandom = (id: string): (() => number) => {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return () => {
        h = (h + 0x6d2b79f5) | 0;
        let t = Math.imul(h ^ (h >>> 15), 1 | h);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
