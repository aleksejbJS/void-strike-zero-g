// Live Pixi preview of the character standing on a hazard-taped platform.
// Arms sway via Pixi's ticker directly (no React re-render per frame).

import React, { useEffect, useRef } from 'react';
import { Application, Container, Texture } from 'pixi.js';
import { generateAssets } from '../../game/systems/assets';
import { buildCharacter, CharacterLook } from './characterArt';

const CANVAS_W = 420;
const CANVAS_H = 360;
const SCALE = 3.4;

const prefersReducedMotion = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CharacterPreview: React.FC<{ look: CharacterLook; label: string; badge: string }> = ({ look, label, badge }) => {
    const host = useRef<HTMLDivElement>(null);
    const app = useRef<Application | null>(null);
    const textures = useRef<Record<string, Texture> | null>(null);
    const lookRef = useRef(look);
    lookRef.current = look;

    const redraw = () => {
        const a = app.current;
        if (!a || !textures.current) return;
        a.stage.removeChildren().forEach(c => c.destroy({ children: true })); // textures are shared and kept
        const character = buildCharacter(lookRef.current, textures.current);
        character.position.set(CANVAS_W / 2, CANVAS_H);
        character.scale.set(SCALE);
        a.stage.addChild(character);
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
                created.destroy(true, { children: true, texture: false });
                return;
            }
            textures.current = loaded;
            app.current = created;
            host.current?.replaceChildren(created.canvas);
            redraw();
            if (prefersReducedMotion()) return;
            created.ticker.add(() => {
                const t = Date.now() * 0.01;
                const body = (created.stage.children[0] as Container | undefined)?.children[0] as Container | undefined;
                const left = body?.getChildByLabel('leftArm');
                const right = body?.getChildByLabel('rightArm');
                if (left) left.rotation = Math.sin(t) * 0.4;
                if (right) right.rotation = Math.sin(t * 0.4) * 0.15 + 0.1;
            });
        };
        setup().catch(err => console.error('Character preview failed to start:', err));
        return () => {
            cancelled = true;
            app.current?.destroy(true, { children: true, texture: false });
            app.current = null;
        };
    }, []);

    // Redraw when colors or skin change
    useEffect(redraw, [look.skin, look.torso, look.head, look.arms, look.legs, look.jetpack]);

    return (
        <div role="img" aria-label={label} className="relative min-h-[300px] flex-grow overflow-hidden rounded bg-bay-panel">
            <span className="absolute left-5 top-4 text-sm text-bay-dust">{badge}</span>
            <div ref={host} aria-hidden="true" className="absolute bottom-[74px] left-1/2 -translate-x-1/2" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-10 h-[34px] border-t-4 border-bay-edge bg-bay-steel" />
            <div aria-hidden="true" className="hazard-stripes-sm absolute inset-x-0 bottom-7 h-3" />
        </div>
    );
};
