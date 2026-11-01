// Draws GameState.particles: one pooled display object per live particle id.
// Glow kinds (flash, fireball) are additive Sprites on the shared glow texture; the rest
// are Graphics repainted each frame. The glows live in a container above the Graphics one,
// so a fireball always shines over the smoke instead of being painted under it.
// Each pool keeps at most POOL_MAX spare objects.

import { Container, Graphics, Sprite } from 'pixi.js';
import { Particle } from '../../../types';
import { glowTexture } from './glowTextures';
import { keepOnTop } from './keepOnTop';
import { drawGraphic, drawSprite, isSpriteKind } from './particleDraw';

const POOL_MAX = 100;

type Slot =
    | { seen: number; kind: 'sprite'; obj: Sprite }
    | { seen: number; kind: 'graphics'; obj: Graphics };

const newSprite = (): Sprite => {
    const s = new Sprite(glowTexture());
    s.anchor.set(0.5);
    s.blendMode = 'add';
    return s;
};

export class ParticleView {
    private readonly slots = new Map<string, Slot>();
    private readonly spritePool: Sprite[] = [];
    private readonly graphicsPool: Graphics[] = [];
    private readonly graphicsLayer = new Container();
    private readonly glowLayer = new Container();
    private frame = 0;

    constructor(private readonly layer: Container) {
        this.raise();
    }

    /** Show exactly the given particles; objects of vanished ids go back to their pool. */
    sync(particles: Particle[]): void {
        this.raise();
        const frame = ++this.frame;
        for (const p of particles) {
            let slot = this.slots.get(p.id);
            if (!slot) {
                slot = this.acquire(p);
                this.slots.set(p.id, slot);
            }
            slot.seen = frame;
            if (slot.kind === 'sprite') drawSprite(slot.obj, p);
            else drawGraphic(slot.obj, p);
        }
        for (const [id, slot] of this.slots) {
            if (slot.seen === frame) continue;
            this.release(slot);
            this.slots.delete(id);
        }
    }

    /** Destroy every object and both containers; the view is not usable afterwards. */
    clear(): void {
        for (const slot of this.slots.values()) this.dispose(slot.obj);
        this.slots.clear();
        for (const obj of this.spritePool) this.dispose(obj);
        for (const obj of this.graphicsPool) this.dispose(obj);
        this.spritePool.length = 0;
        this.graphicsPool.length = 0;
        this.dispose(this.graphicsLayer);
        this.dispose(this.glowLayer);
    }

    // Things added to the layer later (respawned fighters, ragdolls...) would otherwise sit
    // above every particle; moving both containers back to the top keeps effects in front
    private raise(): void {
        keepOnTop(this.layer, [this.graphicsLayer, this.glowLayer]);
    }

    private acquire(p: Particle): Slot {
        if (isSpriteKind(p.type)) {
            const obj = this.spritePool.pop() ?? newSprite();
            this.glowLayer.addChild(obj);
            return { seen: 0, kind: 'sprite', obj };
        }
        const obj = this.graphicsPool.pop() ?? new Graphics();
        this.graphicsLayer.addChild(obj);
        return { seen: 0, kind: 'graphics', obj };
    }

    private release(slot: Slot): void {
        slot.obj.parent?.removeChild(slot.obj);
        if (slot.kind === 'sprite') {
            if (this.spritePool.length < POOL_MAX) this.spritePool.push(slot.obj);
            else slot.obj.destroy();
        } else if (this.graphicsPool.length < POOL_MAX) {
            slot.obj.clear();
            this.graphicsPool.push(slot.obj);
        } else {
            slot.obj.destroy();
        }
    }

    private dispose(obj: Container): void {
        obj.parent?.removeChild(obj);
        if (!obj.destroyed) obj.destroy();
    }
}
