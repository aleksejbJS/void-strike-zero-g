// Draws GameState.projectiles: one pooled ProjectileSprite per live projectile id, with the
// remembered trail and the age each look needs. The view never touches the game state; it
// only reports which projectiles it saw for the first time so the caller can spawn effects.

import { Container } from 'pixi.js';
import { Projectile } from '../../../types';
import { keepOnTop } from '../effects/keepOnTop';
import { ProjectileMemory, projectileAge } from './projectileMemory';
import { ProjectileSprite, drawProjectile, newProjectileSprite } from './projectileLooks';

const POOL_MAX = 50;

export class ProjectileView {
    private readonly slots = new Map<string, ProjectileSprite>();
    private readonly pool: ProjectileSprite[] = [];
    private readonly memory = new ProjectileMemory();
    private readonly live = new Set<string>();
    private readonly container = new Container();

    constructor(private readonly layer: Container) {
        this.raise();
    }

    /**
     * Show exactly the given projectiles; sprites of vanished ids go back to the pool.
     * Returns the projectiles whose ids were not on screen before this call.
     */
    sync(projectiles: readonly Projectile[], nowMs: number): Projectile[] {
        this.raise();
        const newlySeen: Projectile[] = [];
        this.live.clear();
        for (const p of projectiles) {
            this.live.add(p.id);
            let sprite = this.slots.get(p.id);
            if (!sprite) {
                sprite = this.acquire();
                this.slots.set(p.id, sprite);
                newlySeen.push(p);
            }
            this.memory.remember(p.id, p.pos);
            drawProjectile(sprite, p, this.memory.trail(p.id), projectileAge(p), nowMs);
        }
        for (const [id, sprite] of this.slots) {
            if (this.live.has(id)) continue;
            this.release(sprite);
            this.slots.delete(id);
        }
        this.memory.forgetMissing(this.live);
        return newlySeen;
    }

    /** Destroy every sprite and the container; the view is not usable afterwards. */
    clear(): void {
        for (const sprite of this.slots.values()) this.dispose(sprite.root);
        for (const sprite of this.pool) this.dispose(sprite.root);
        this.slots.clear();
        this.pool.length = 0;
        this.memory.forgetMissing(new Set());
        this.dispose(this.container);
    }

    // Fighters, ragdolls and texts added to the layer later would otherwise cover the projectiles
    private raise(): void {
        keepOnTop(this.layer, [this.container]);
    }

    private acquire(): ProjectileSprite {
        const sprite = this.pool.pop() ?? newProjectileSprite();
        this.container.addChild(sprite.root);
        return sprite;
    }

    private release(sprite: ProjectileSprite): void {
        sprite.root.parent?.removeChild(sprite.root);
        if (this.pool.length < POOL_MAX) {
            sprite.body.clear();
            this.pool.push(sprite);
        } else {
            this.dispose(sprite.root);
        }
    }

    private dispose(obj: Container): void {
        obj.parent?.removeChild(obj);
        if (!obj.destroyed) obj.destroy({ children: true });
    }
}
