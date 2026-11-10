// Torn robot sockets on screen: cables (Graphics) under a torn metal flange (the kit's `woundFlange` picture)
// at every open socket. Shared by live fighters (a lost leg) and torn corpses (gib, cut, torn-off leg).
import { Container, Graphics, Mesh, MeshGeometry, Texture } from 'pixi.js';
import type { SourcePart } from './artTypes';
import { ROBOT_KIT } from './data/robotKit';
import { partGeometry, placePart } from './placement';
import { cableCurves } from './robotCables';
import type { Socket } from './robotSockets';

const INK = 0x24160f, COPPER = 0xd08a4a;

export interface RobotWounds {
    root: Container;
    cables: Graphics;
    flanges: Mesh[];
    source: SourcePart;
    texture: Texture;
    geometry: MeshGeometry;
    seed: number;
}

/** The flange as a renderer part, or undefined when the kit carries none. */
const flangePart = (): SourcePart | undefined => {
    const data = ROBOT_KIT.extras?.woundFlange;
    if (!data) return undefined;
    const pixelScale = 19 / Math.hypot(ROBOT_KIT.neck[0] - ROBOT_KIT.hip[0], ROBOT_KIT.neck[1] - ROBOT_KIT.hip[1]);
    return { polygon: data.atlas.polygon, origin: data.atlas.origin, axisEnd: data.atlas.axisEnd, channel: 'none',
        texture: 'atlas', pixelScale };
};

export const createRobotWounds = (atlas: Texture): RobotWounds | undefined => {
    const source = flangePart();
    if (!source) return undefined;
    const root = new Container(), cables = new Graphics();
    root.label = 'robot-wounds';
    root.addChild(cables);
    const geometry = new MeshGeometry(partGeometry(source, ROBOT_KIT.atlas.size));
    root.on('destroyed', () => geometry.destroy(true));
    return { root, cables, flanges: [], source, texture: atlas, geometry, seed: Math.floor(Math.random() * 1e6) };
};

const flangeAt = (w: RobotWounds, i: number): Mesh => {
    while (w.flanges.length <= i) {
        const mesh = new Mesh({ geometry: w.geometry, texture: w.texture });
        mesh.label = 'robot-flange';
        w.flanges.push(mesh);
        w.root.addChild(mesh); // after the cables: the flange ring hides their roots
    }
    return w.flanges[i];
};

/** Shows one flange and its cable bundle per socket (rig space); hides everything when there are none. */
export const updateRobotWounds = (w: RobotWounds, sockets: readonly Socket[], time: number): void => {
    const g = w.cables.clear();
    w.cables.visible = sockets.length > 0;
    const sourceLength = Math.hypot(w.source.axisEnd![0] - w.source.origin[0], w.source.axisEnd![1] - w.source.origin[1]);
    sockets.forEach((socket, i) => {
        for (const c of cableCurves(socket, w.seed + i * 97, time, { x: 0, y: 0 })) {
            g.moveTo(c.from.x, c.from.y).quadraticCurveTo(c.ctrl.x, c.ctrl.y, c.to.x, c.to.y).stroke({ width: 1.2, color: INK, cap: 'round' });
            g.moveTo(c.from.x, c.from.y).quadraticCurveTo(c.ctrl.x, c.ctrl.y, c.to.x, c.to.y).stroke({ width: 0.75, color: c.color, cap: 'round' });
            g.circle(c.to.x, c.to.y, 0.38).fill(COPPER);
        }
        const size = socket.radius / 2.375;
        const length = sourceLength * (w.source.pixelScale ?? 1) * size;
        const at = placePart(w.source, { start: socket.at, end: { x: socket.at.x + socket.dir.x * length, y: socket.at.y + socket.dir.y * length } }, 1);
        const mesh = flangeAt(w, i);
        mesh.visible = true;
        mesh.position.set(at.x, at.y);
        mesh.rotation = at.rotation;
        mesh.scale.set(at.scaleX * size, at.scaleY);
    });
    for (let i = sockets.length; i < w.flanges.length; i++) w.flanges[i].visible = false;
};

export const destroyRobotWounds = (w: RobotWounds): void => {
    if (!w.root.destroyed) w.root.destroy({ children: true, context: true });
};
