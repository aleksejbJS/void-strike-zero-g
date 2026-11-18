// What the fighters ask the flame engine to draw this frame, collected by FighterFire while the fighters are
// animated and consumed (then cleared) by FlameFx. A fighter that asks for nothing this frame is not drawn:
// its stream dies out and its body fire fades.

export interface StreamOrder {
    x: number;       // nozzle, world px
    y: number;
    angle: number;   // radians, the way the flame flies
    firing: boolean; // spraying now; false shows only the pilot light
}

export interface BodyOrder {
    x: number;       // feet, world px (pos is centreX, bottomY)
    y: number;
    w: number;       // hitbox size
    h: number;
    prone: boolean;
}

export class FlameOrders {
    readonly streams = new Map<string, StreamOrder>();
    readonly bodies = new Map<string, BodyOrder>();

    /** Fighter `id` holds a flamethrower with its nozzle at (x, y). */
    stream(id: string, order: StreamOrder): void {
        this.streams.set(id, order);
    }

    /** Fighter `id` is on fire. */
    body(id: string, order: BodyOrder): void {
        this.bodies.set(id, order);
    }

    clear(): void {
        this.streams.clear();
        this.bodies.clear();
    }
}
