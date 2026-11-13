// One sprite per particle of a pool, made the first time its record is used and reused after that.
// Each frame copies the records' sprite fields; dead or invisible records hide their sprite.

import { Container, Sprite, Texture } from 'pixi.js';
import type { ParticlePool } from './particlePool';
import { applyDraw, destroyLayer, flameSprite } from './spriteKit';

export class ParticleSprites {
    readonly layer = new Container();
    private readonly sprites: (Sprite | undefined)[] = [];

    constructor(private readonly pool: ParticlePool, private readonly tex: Texture, private readonly additive: boolean) {}

    sync(): void {
        const items = this.pool.items;
        for (let i = 0; i < items.length; i++) {
            const p = items[i];
            let s = this.sprites[i];
            const show = p.alive && p.alpha > 0.002;
            if (!show) {
                if (s?.visible) s.visible = false;
                continue;
            }
            s ??= this.sprites[i] = flameSprite(this.layer, this.tex, this.additive);
            applyDraw(s, p, true);
        }
    }

    destroy(): void {
        destroyLayer(this.layer);
        this.sprites.length = 0;
    }
}
