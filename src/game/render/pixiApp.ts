// The one way to tear down a Pixi Application in this app.
//
// Never call `app.destroy(true, …)`: `true` means "release global resources", and Pixi
// then clears its page-wide batch pool — including batches another, still-live
// renderer has checked out. The next frame of that renderer crashes in the batcher
// ("Cannot read properties of null (reading 'clear')") and the pool stays poisoned
// until the page reloads. The character preview and the match canvas overlap for a
// moment at match start, so that is exactly our situation.

import type { Application } from 'pixi.js';

type DestroyableApp = Pick<Application, 'destroy'>;

/** Removes the canvas from the page and frees the display tree; shared textures stay. */
export const destroyApp = (app: DestroyableApp): void => {
    app.destroy({ removeView: true }, { children: true, texture: false });
};
