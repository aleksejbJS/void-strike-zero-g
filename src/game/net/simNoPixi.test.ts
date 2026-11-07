// The simulation runs in Node (the server) and in a Web Worker (the browser host): neither has Pixi.
// Walks the static value imports from the room and the worker and fails if any reaches 'pixi.js'.

import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOTS = ['src/game/net/room.ts', 'src/game/net/hostWorker.ts'];
// `import x from '…'`, `export … from '…'` and bare `import '…'`; `import type` / `export type` are erased at build
const IMPORT = /^\s*(import|export)\s+(?!type\s)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;

/** A relative specifier as a file on disk (the server spells .ts files as .js). */
const resolveFile = (from: string, spec: string): string | undefined => {
    const base = resolve(dirname(from), spec.replace(/\.js$/, ''));
    return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, base].find(f => existsSync(f) && f.match(/\.tsx?$/));
};

/** The import chain from a root to 'pixi.js', or undefined when there is none. */
const pathToPixi = (root: string): string[] | undefined => {
    const seen = new Set<string>();
    const walk = (file: string, chain: string[]): string[] | undefined => {
        if (seen.has(file)) return undefined;
        seen.add(file);
        for (const [, , spec] of readFileSync(file, 'utf8').matchAll(IMPORT)) {
            if (spec === 'pixi.js' || spec.startsWith('pixi.js/')) return [...chain, file, spec];
            if (!spec.startsWith('.')) continue;
            const next = resolveFile(file, spec);
            const found = next && walk(next, [...chain, file]);
            if (found) return found;
        }
        return undefined;
    };
    return walk(resolve(root), []);
};

describe('the simulation import graph', () => {
    it.each(ROOTS)('%s reaches no pixi.js', root => {
        const chain = pathToPixi(root)?.map(f => f.replace(`${process.cwd()}/`, '')).join(' → ');
        expect(chain, chain).toBeUndefined(); // on failure the message is the chain of files that leads to pixi.js
    });

    it('the walker does find pixi.js where it is imported', () => {
        expect(pathToPixi('src/game/render/playerVisual.ts')).toBeDefined();
    });
});
