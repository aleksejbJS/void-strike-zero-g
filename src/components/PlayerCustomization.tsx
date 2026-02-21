import React, { useState, useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SKINS } from '../constants';
import { useUIStore } from '../store/uiStore';
import { generateAssets } from '../game/systems/assets';
import { ItemType } from '../types';

const PlayerCustomization: React.FC<{ onContinue: () => void; onBack: () => void }> = ({ onContinue, onBack }) => {
    const { state, actions } = useUIStore();
    const [name, setName] = useState(state.playerName);
    const [skinId, setSkinId] = useState(state.selectedSkin || 'classic');
    const [skinIndex, setSkinIndex] = useState(() => {
        const foundIndex = SKINS.findIndex((skin) => skin.id === state.selectedSkin);
        return foundIndex >= 0 ? foundIndex : 0;
    });
    const [torsoColor, setTorsoColor] = useState(state.torsoColor || state.playerColor);
    const [headColor, setHeadColor] = useState(state.headColor || state.playerColor);
    const [armColor, setArmColor] = useState(state.armColor || state.playerColor);
    const [legColor, setLegColor] = useState(state.legColor || '#475569');
    const [jetpackColor, setJetpackColor] = useState(state.jetpackColor || '#ef4444');
    const [showCustomPicker, setShowCustomPicker] = useState(false);
    const [leftArmAngle, setLeftArmAngle] = useState(0);
    const [rightArmAngle, setRightArmAngle] = useState(0.15);
    const pixiRef = useRef<HTMLDivElement | null>(null);
    const pixiApp = useRef<Application | null>(null);
    const texturesRef = useRef<Record<string, Texture>>({});
    const currentSkin = SKINS[skinIndex] || SKINS[0];

    const drawPreview = (
        app: Application,
        textures: Record<string, Texture>,
        skin: (typeof SKINS)[number] | undefined = currentSkin
    ) => {
        const stage = app.stage;
        stage.removeChildren();
        const root = new Container();
        root.position.set(app.view.width / 2, app.view.height / 2 + 12);
        const previewScale = 1.7; // Крупный, но ближе к масштабу в игре
        root.scale.set(previewScale);
        stage.addChild(root);

        const background = new Graphics();
        const bgPadding = 8;
        background.roundRect(
            -app.view.width / 2 + bgPadding,
            -app.view.height / 2 + bgPadding,
            app.view.width - bgPadding * 2,
            app.view.height - bgPadding * 2,
            20
        ).fill({ color: 0x0f172a, alpha: 0.9 });
        root.addChild(background);

        const ground = new Graphics();
        ground.rect(
            -app.view.width / 2 + bgPadding,
            app.view.height / 2 - 48,
            app.view.width - bgPadding * 2,
            24
        ).fill({ color: 0x111827, alpha: 0.9 });
        root.addChild(ground);

        const accentColor = skin?.accent || '#e5e7eb';
        const style = skin?.style || 'human';
        const accentNum = parseInt(accentColor.replace('#', ''), 16);

        const createLeg = (thigh: string, shin: string) => {
            const leg = new Container();
            const thighG = new Graphics(); thighG.roundRect(-3, 0, 6, 16, 3).fill(parseInt(thigh.replace('#', ''), 16)); leg.addChild(thighG);
            const shinC = new Graphics(); shinC.roundRect(-2, 0, 4, 18, 2).fill(parseInt(shin.replace('#', ''), 16));
            const shinSegment = new Container(); shinSegment.position.set(0, 14); shinSegment.addChild(shinC); leg.addChild(shinSegment);
            const boot = new Graphics(); boot.rect(-4, 16, 10, 4).fill(0x1f2937); // чуть светлее, чтобы ступня была видна на фоне
            shinSegment.addChild(boot);
            return { leg, shin: shinSegment };
        };

        const createArm = (color: string, withWeapon: boolean) => {
            const arm = new Container();
            const upper = new Graphics(); upper.roundRect(-3, -2, 18, 6, 3).fill(parseInt(color.replace('#', ''), 16)); arm.addChild(upper);
            if (withWeapon) {
                const wGfx = new Graphics(); wGfx.label = 'weapon'; wGfx.position.set(14, 0); arm.addChild(wGfx);
            }
            return arm;
        };

        const legOffsetY = 2;
        const legOffsetX = 2; // ближе к центру, как в игре

        const torso = new Graphics(); torso.label = 'body';
        torso.roundRect(-9, -24, 18, 28, 4).fill(parseInt(torsoColor.replace('#', ''), 16));
        if (style === 'robot') {
            torso.rect(-10, -8, 20, 10).fill(accentNum);
            torso.rect(-6, -20, 12, 6).fill(0x0f172a);
        }
        root.addChild(torso);

        const back = createLeg(legColor, '#334155'); back.leg.position.set(-legOffsetX, legOffsetY); root.addChild(back.leg);
        const front = createLeg(legColor, '#334155'); front.leg.position.set(legOffsetX, legOffsetY); root.addChild(front.leg);

        const head = new Graphics();
        if (style === 'robot') {
            head.roundRect(-10, -36, 20, 16, 3).fill(parseInt(headColor.replace('#', ''), 16));
            head.rect(-8, -30, 16, 8).fill(accentNum);
            head.rect(-2, -42, 4, 8).fill(accentNum);
        } else {
            head.circle(0, -30, 10).fill(parseInt(headColor.replace('#', ''), 16));
            head.rect(4, -34, 6, 8).fill(0x000000);
            head.rect(2, -26, 10, 4).fill(0x333333);
            if (style === 'beast' || style === 'alien') {
                head.moveTo(-10, -34).lineTo(-4, -48).lineTo(0, -34).fill(parseInt(headColor.replace('#', ''), 16));
                head.moveTo(10, -34).lineTo(4, -48).lineTo(0, -34).fill(parseInt(headColor.replace('#', ''), 16));
                head.circle(-4, -36, 2).fill(accentNum);
                head.circle(4, -36, 2).fill(accentNum);
            }
        }
        root.addChild(head);

        if (style === 'beast' || style === 'alien') {
            const tail = new Graphics();
            tail.roundRect(-18, -2, 14, 4, 2).fill(accentNum);
            tail.pivot.set(7, 0);
            tail.position.set(-16, 4);
            tail.rotation = -0.25;
            root.addChild(tail);
        }

        const jetpack = new Graphics(); jetpack.label = 'jetpack'; jetpack.rect(-4, -12, 10, 24).fill(parseInt(jetpackColor.replace('#', ''), 16));
        jetpack.position.set(-14, -6); root.addChild(jetpack);

        const leftArm = createArm(armColor, false); leftArm.position.set(-8, -20); root.addChild(leftArm);
        const rightArm = createArm(armColor, true); rightArm.position.set(0, -20); root.addChild(rightArm);

        // Weapon sprite
        const wGfx = rightArm.getChildByLabel('weapon') as Graphics;
        if (wGfx) {
            wGfx.removeChildren();
            const tex = textures['weapon_machine_gun'] || textures[ItemType.WEAPON];
            if (tex) {
                const sprite = new Sprite(tex);
                sprite.anchor.set(0.2, 0.5);
                const base = Math.max(tex.width, tex.height) || 1;
                sprite.scale.set(48 / base);
                wGfx.addChild(sprite);
            } else {
                wGfx.rect(-10, -3, 24, 6).fill(0x1e293b);
            }
        }

        // Simple pose
        rightArm.rotation = rightArmAngle;
        leftArm.rotation = leftArmAngle;
    };
    const patchNotes = [
        {
            title: 'v0.3.1 — 2025-11-28', points: [
                '⚔️ Gun Game: прогрессия оружия, без пикапов, победа после финального оружия',
                '🎯 Фиксы выбора оружия: удалены дубли .js, только TypeScript',
                '🛠️ UI: стрелки выбора скинов, роботы/звери с уникальными акцентами',
                '🌐 Сервер: ESM-совместимость, туннели localtunnel/ngrok',
                '🐞 Багфиксы: ачивки только за игрока, победа в Gun Game без резкого выхода'
            ]
        },
        {
            title: 'v0.3.0 — 2024-11-25', points: [
                '💀 Ragdoll Physics: тела разлетаются на 6 частей с реалистичной физикой',
                '🎨 Модульные персонажи: отдельные части тела (голова, торс, руки, ноги)',
                '🏴 Hold The Flag: новый режим "король горы" с золотым флагом',
                '🌐 Мультиплеер P2P: создавай игру и приглашай друзей',
                '🤖 Улучшенный AI ботов: активно преследуют цели'
            ]
        },
        {
            title: 'v0.0.4 — 2024-10-05', points: [
                'Новые спрайты оружия (machinegun/shotgun/rocket/railgun) + подсветка',
                'Рейлган стреляет синим лучом и наносит 200 урона (ваншот)',
                'Дропы/флаги: свои текстуры и ореолы, увеличенные размеры'
            ]
        }
    ];

    // Removed auto-update useEffect to prevent overwriting store on mount with defaults
    // We will only update store on Continue or explicit actions

    useEffect(() => {
        console.log('PlayerCustomization mounted. Initial state:', { name, storeMode: state.selectedMode });
        let raf: number;
        const tick = () => {
            const t = Date.now() * 0.01;
            setLeftArmAngle(Math.sin(t) * 0.4);
            setRightArmAngle(Math.sin(t * 0.4) * 0.15 + 0.1);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    const changeSkin = (direction: number) => {
        setSkinIndex((prev) => {
            const next = (prev + direction + SKINS.length) % SKINS.length;
            return next;
        });
    };

    // PIXI preview setup
    useEffect(() => {
        let mounted = true;
        const setupPixi = async () => {
            const textures = await generateAssets();
            if (!mounted) return;
            texturesRef.current = textures;
            const app = new Application();
            await app.init({ width: 400, height: 400, backgroundAlpha: 0, antialias: true });
            pixiApp.current = app;
            if (pixiRef.current) { pixiRef.current.innerHTML = ''; pixiRef.current.appendChild(app.canvas); }
            drawPreview(app, textures, currentSkin);
        };
        setupPixi();
        return () => {
            mounted = false;
            if (pixiApp.current) { pixiApp.current.destroy(true, { children: true, texture: false }); pixiApp.current = null; }
        };
    }, []);

    // Update preview when colors change
    useEffect(() => {
        if (pixiApp.current && Object.keys(texturesRef.current).length) {
            drawPreview(pixiApp.current, texturesRef.current, currentSkin);
        }
    }, [torsoColor, headColor, armColor, legColor, jetpackColor, rightArmAngle, currentSkin]);

    useEffect(() => {
        setSkinId(currentSkin.id);
    }, [currentSkin]);

    useEffect(() => {
        if (currentSkin?.palette) {
            setTorsoColor(currentSkin.palette.torso ?? torsoColor);
            setHeadColor(currentSkin.palette.head ?? headColor);
            setArmColor(currentSkin.palette.arms ?? armColor);
            setLegColor(currentSkin.palette.legs ?? legColor);
            setJetpackColor(currentSkin.palette.jetpack ?? jetpackColor);
            setShowCustomPicker(false);
        }
    }, [currentSkin]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.length <= 12) {
            setName(value);
        }
    };

    const handleContinue = () => {
        console.log('handleContinue called. Sending to store:', { name: name || 'Anonymous', torsoColor, headColor, armColor, legColor, jetpackColor });
        actions.selectSkin(skinId);
        actions.setPlayerCustomization(name || 'Anonymous', {
            torso: torsoColor,
            head: headColor,
            arms: armColor,
            legs: legColor,
            jetpack: jetpackColor
        });
        actions.startGame(state.selectedMode);
        onContinue();
    };

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#050b14] text-white overflow-hidden font-mono">

            <div className="absolute inset-0 grid-bg animate-[pulse_4s_ease-in-out_infinite]"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050b14]/80 to-[#050b14]"></div>
            <div className="scanlines"></div>

            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[100px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-600/10 blur-[100px]"></div>

            <div className="relative z-20 flex flex-col items-center w-full max-w-6xl px-4 py-6">

                {/* Title */}
                <div className="mb-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight italic bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-cyan-300 to-purple-500">
                        OPERATOR SETUP
                    </h1>
                    <p className="text-gray-500 text-xs mt-1">Configure your battle identity</p>
                </div>

                <div className="flex flex-col md:flex-row gap-6 w-full items-stretch">
                    {/* Patch Notes */}
                    <div className="md:w-72 w-full bg-gray-900/60 border border-gray-700/60 rounded-xl p-4 shadow-xl">
                        <div className="flex items-center justify-between text-xs font-bold tracking-widest uppercase text-cyan-300">
                            <span>Patch Notes</span>
                            <span className="text-[10px] text-gray-400 font-mono">{patchNotes[0].title}</span>
                        </div>
                        <div className="mt-3 space-y-2 text-gray-300 text-sm">
                            {patchNotes[0].points.map((note, i) => (
                                <div key={i} className="flex gap-2">
                                    <span className="text-cyan-300">•</span>
                                    <span className="leading-snug break-words">{note}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Left: Character Preview */}
                    <div className="flex-1 bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 flex flex-col items-center shadow-2xl">
                        <h3 className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-3 w-full border-b border-gray-700 pb-2">
                            Preview
                        </h3>

                        {/* Character Preview */}
                        <div className="relative w-full aspect-square max-w-[400px] bg-gray-950 rounded-lg border border-gray-700 flex items-center justify-center overflow-hidden mb-3">
                            <div ref={pixiRef} className="w-full h-full" />
                        </div>

                        {/* Skin Selector */}
                        <div className="w-full flex items-center gap-3 mb-2">
                            <button
                                type="button"
                                aria-label="Previous character"
                                onClick={() => changeSkin(-1)}
                                className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-900/60 hover:bg-gray-800 transition-all flex items-center justify-center text-lg"
                            >
                                ‹
                            </button>

                            <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-lg px-3 py-2 text-center">
                                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Character</div>
                                <div className="flex items-center justify-center gap-3">
                                    <div className="text-sm font-bold text-white">{currentSkin.name}</div>
                                    <div className="text-[11px] text-gray-500">{skinIndex + 1}/{SKINS.length}</div>
                                    <span
                                        className="w-4 h-4 rounded-full border border-gray-700 shadow-inner"
                                        style={{ backgroundColor: currentSkin.color }}
                                        aria-hidden
                                    />
                                </div>
                            </div>

                            <button
                                type="button"
                                aria-label="Next character"
                                onClick={() => changeSkin(1)}
                                className="w-10 h-10 rounded-lg border border-gray-700 bg-gray-900/60 hover:bg-gray-800 transition-all flex items-center justify-center text-lg"
                            >
                                ›
                            </button>
                        </div>

                        {/* Name Display */}
                        <div className="text-center">
                            <div className="text-xl font-bold text-white">{name || 'Anonymous'}</div>
                            <div className="text-[10px] text-gray-400 mt-1">
                                Модульные части: голова, торс, две руки, ноги, джетпак — готовы к отдельным скинам.
                            </div>
                        </div>
                    </div>

                    {/* Right: Customization */}
                    <div className="flex-1 flex flex-col gap-4">

                        {/* Name Input */}
                        <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl">
                            <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-2 border-b border-gray-700 pb-1">
                                Operator Name
                            </h3>
                            <input
                                type="text"
                                value={name}
                                onChange={handleNameChange}
                                placeholder="Enter name..."
                                maxLength={12}
                                className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-base font-bold placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                            />
                            <div className="text-right text-[10px] text-gray-500 mt-1">
                                {name.length}/12
                            </div>
                        </div>

                        {/* Color Selectors */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                            {/* Torso Color */}
                            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl">
                                <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-2 border-b border-gray-700 pb-1">
                                    Torso Color
                                </h3>
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                    {SKINS.slice(0, 4).map((skin) => (
                                        <button
                                            key={skin.id}
                                            onClick={() => { setTorsoColor(skin.color); setShowCustomPicker(false); }}
                                            className={`aspect-square rounded-lg border-2 transition-all duration-200 ${torsoColor === skin.color && !showCustomPicker
                                                ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105'
                                                : 'border-gray-700 hover:border-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                            style={{ backgroundColor: skin.color }}
                                        >
                                            {torsoColor === skin.color && !showCustomPicker && (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                                                        <div className="text-black text-[10px]">✓</div>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Head Color */}
                            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl">
                                <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-2 border-b border-gray-700 pb-1">
                                    Head Color
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {['#eab308', '#f97316', '#22c55e', '#38bdf8'].map(c => (
                                        <button key={c}
                                            onClick={() => setHeadColor(c)}
                                            className={`aspect-square rounded-lg border-2 transition-all ${headColor === c
                                                ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105'
                                                : 'border-gray-700 hover:border-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        >
                                            {headColor === c && (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                                                        <div className="text-black text-[10px]">✓</div>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Arm Color */}
                            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl">
                                <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-2 border-b border-gray-700 pb-1">
                                    Arm Color
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {['#3b82f6', '#ef4444', '#f59e0b', '#a855f7'].map(c => (
                                        <button key={c}
                                            onClick={() => setArmColor(c)}
                                            className={`aspect-square rounded-lg border-2 transition-all ${armColor === c
                                                ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105'
                                                : 'border-gray-700 hover:border-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        >
                                            {armColor === c && (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                                                        <div className="text-black text-[10px]">✓</div>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Leg Color */}
                            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl">
                                <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-2 border-b border-gray-700 pb-1">
                                    Leg Color
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {['#475569', '#334155', '#0ea5e9', '#15803d'].map(c => (
                                        <button key={c}
                                            onClick={() => setLegColor(c)}
                                            className={`aspect-square rounded-lg border-2 transition-all ${legColor === c
                                                ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105'
                                                : 'border-gray-700 hover:border-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                            style={{ backgroundColor: c }}
                                        >
                                            {legColor === c && (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                                                        <div className="text-black text-[10px]">✓</div>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Jetpack Color */}
                            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-700/50 rounded-xl p-4 shadow-2xl">
                                <h3 className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-2 border-b border-gray-700 pb-1">
                                    Jetpack Color
                                </h3>

                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { name: 'Red', color: '#ef4444' },
                                        { name: 'Orange', color: '#f97316' },
                                        { name: 'Yellow', color: '#eab308' },
                                        { name: 'Gray', color: '#64748b' }
                                    ].map((preset) => (
                                        <button
                                            key={preset.name}
                                            onClick={() => setJetpackColor(preset.color)}
                                            className={`aspect-square rounded-lg border-2 transition-all duration-200 ${jetpackColor === preset.color
                                                ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105'
                                                : 'border-gray-700 hover:border-gray-500 opacity-60 hover:opacity-100'
                                                }`}
                                            style={{ backgroundColor: preset.color }}
                                        >
                                            {jetpackColor === preset.color && (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
                                                        <div className="text-black text-[10px]">✓</div>
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 mt-auto">
                            <button
                                onClick={onBack}
                                className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-bold text-base rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] border border-gray-700"
                            >
                                ← BACK
                            </button>
                            <button
                                onClick={handleContinue}
                                className="flex-[2] group relative py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg italic tracking-wider rounded-xl shadow-lg overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] bg-[position:-100%_0] group-hover:bg-[position:200%_0] transition-[background-position] duration-1000 ease-in-out"></div>
                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    CONTINUE <span className="text-blue-200">►</span>
                                </span>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PlayerCustomization;
