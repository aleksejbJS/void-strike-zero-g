// Works around a Pixi 8 (8.14.3) bug that poisons the page-wide batch pool when a renderer is
// destroyed while another one keeps drawing.
//
// Each frame `Batcher.begin()` hands last frame's batches back to the shared pool but leaves
// them in its `batches` array; `Batcher.destroy()` then hands back the *whole* array again.
// Batches that already went back — and that another renderer may have taken and be drawing
// with — land in the pool a second time, so two batchers end up sharing one batch. The live
// renderer then draws with geometry of a dead one: "glDrawElements: Insufficient buffer size",
// later "Cannot read properties of null (reading 'instanceCount')" and missing or black art.
// Seen after match → menu → match and in the menu's mode preview after a match.
//
// Fix: before destroy, cut the array down to the batches this batcher still owns (the first
// `batchIndex`), so each batch is returned exactly once. Pixi itself does the same by 8.22.0
// (its destroy loop stops at `batchIndex`): drop this file when upgrading.

import { Batcher } from 'pixi.js';

let installed = false;

/** Patches Batcher.destroy once; safe to call any number of times. */
export const installBatchPoolFix = (): void => {
    if (installed) return;
    installed = true;
    const destroy = Batcher.prototype.destroy;
    Batcher.prototype.destroy = function patchedDestroy(this: Batcher, options) {
        if (this.batches) this.batches.length = this.batchIndex;
        destroy.call(this, options);
    };
};
