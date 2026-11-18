// The hot glow at the nozzle of each rocket in flight: one sprite per rocket, moved to its nozzle every frame and
// flickering a little, so it looks the same at any frame rate. Sprites are reused; the extra ones are hidden. Visual only.

import { Container, Sprite, Texture } from 'pixi.js';
import { flameSprite } from '../flame/spriteKit';
import { NOZZLE } from './blastTuning';

export class NozzleGlows {
    readonly layer = new Container();
    private readonly sprites: Sprite[] = [];
    private used = 0;

    constructor(private readonly tex: Texture) {}

    /** How many glows are shown this frame. */
    get shown(): number {
        return this.used;
    }

    /** Start a frame: no glow placed yet. */
    begin(): void {
        this.used = 0;
    }

    /** Show one glow at (x, y) this frame. */
    place(x: number, y: number): void {
        const s = this.sprites[this.used] ??= flameSprite(this.layer, this.tex, true);
        this.used++;
        const size = NOZZLE.size * (1 - NOZZLE.flicker + Math.random() * 2 * NOZZLE.flicker);
        s.visible = true;
        s.position.set(x, y);
        s.scale.set(size / s.texture.width, size / s.texture.height);
        s.tint = NOZZLE.tint;
        s.alpha = NOZZLE.alpha;
    }

    /** End the frame: glows not placed are hidden. */
    end(): void {
        for (let i = this.used; i < this.sprites.length; i++) if (this.sprites[i].visible) this.sprites[i].visible = false;
    }

    destroy(): void {
        this.layer.destroy({ children: true });
        this.sprites.length = 0;
        this.used = 0;
    }
}
