// Live Pixi preview of the character standing on a hazard-taped platform.
// Breathing is animated via Pixi's ticker directly (no React re-render per frame).

import React, { useEffect, useRef } from 'react';
import { Application, Container, Texture } from 'pixi.js';
import { generateAssets } from '../../game/systems/assets';
import { destroyApp } from '../../game/render/pixiApp';
import { buildCharacter, CharacterArt, CharacterLook } from './characterArt';

const CANVAS_W = 420;
const CANVAS_H = 360;
const SCALE = 3.1;

const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CharacterPreview: React.FC<{ look: CharacterLook; label: string; badge: string }> = ({ look, label, badge }) => {
    const host = useRef<HTMLDivElement>(null);
    const app = useRef<Application | null>(null);
    const textures = useRef<Record<string, Texture> | null>(null);
    const lookRef = useRef(look);
    lookRef.current = look;
    const art = useRef<CharacterArt | null>(null);

    const redraw = () => {
        const a = app.current;
        if (!a || !textures.current) return;
        a.stage.removeChildren().forEach(c => c.destroy({ children: true, context: true })); // textures are shared and kept
        const built = buildCharacter(lookRef.current, textures.current);
        built.update(Date.now() / 1000);
        const holder = new Container();
        holder.position.set(CANVAS_W / 2 - 20, CANVAS_H);
        holder.scale.set(SCALE);
        holder.addChild(built.root);
        a.stage.addChild(holder);
        art.current = built;
    };

    // Create the Pixi app once
    useEffect(() => {
        let cancelled = false;
        const created = new Application();
        const setup = async () => {
            const [loaded] = await Promise.all([
                generateAssets(),
                created.init({ width: CANVAS_W, height: CANVAS_H, backgroundAlpha: 0, antialias: true }),
            ]);
            if (cancelled) {
                destroyApp(created);
                return;
            }
            textures.current = loaded;
            app.current = created;
            host.current?.replaceChildren(created.canvas);
            redraw();
            if (prefersReducedMotion()) return;
            created.ticker.add(() => art.current?.update(Date.now() / 1000));
        };
        setup().catch(err => console.error('Character preview failed to start:', err));
        return () => {
            cancelled = true;
            if (app.current) destroyApp(app.current);
            app.current = null;
        };
    }, []);

    // Redraw when colors or the build change
    useEffect(redraw, [look.build, look.torso, look.head, look.arms, look.legs, look.jetpack]);

    return (
        <div role="img" aria-label={label} className="relative h-[300px] shrink-0 overflow-hidden rounded bg-bay-panel lg:h-[clamp(320px,50vh,520px)]">
            <span className="absolute left-5 top-4 text-sm text-bay-dust">{badge}</span>
            <div ref={host} aria-hidden="true" className="absolute bottom-[74px] left-1/2 -translate-x-1/2" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-10 h-[34px] border-t-4 border-bay-edge bg-bay-steel" />
            <div aria-hidden="true" className="hazard-stripes-sm absolute inset-x-0 bottom-7 h-3" />
        </div>
    );
};
