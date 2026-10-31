import React, { useRef, useEffect } from 'react';
import { Application, Container, Graphics, Texture, Sprite, Text } from 'pixi.js';
import { GameState, GameMode, Team, WeaponType, ItemType, Pickup, NetworkMode, MapId } from '../types';
import { WEAPONS_DATA, INFILTRATION_TIMER, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../constants';
import { initAudio } from '../game/systems/audio';
import { generateAssets } from '../game/systems/assets';
import { updatePhysics } from '../game/systems/physics';
import { drawStaticMap, drawBackground, syncVisuals, getPickupSpriteScale, drawZoneOverlay } from '../game/systems/renderer';
import { clearBotMemory } from '../game/systems/bot';
import { getPlatforms, getInitialPickups } from '../game/data/level';
import { useUIStore } from '../store/uiStore';
import { WeaponIcon } from './WeaponIcon';
import { ClientSession } from '../game/net/clientSession';
import { resolveServerUrl } from '../game/net/serverAddress';
import { achievementManager } from '../game/systems/achievements';
import { Achievement } from '../game/systems/achievements';
import { useTranslation } from '../i18n/useTranslation';
import { gameEvents } from '../game/systems/events';
import { playSound } from '../game/systems/audio';
import { MatterPhysicsEngine } from '../game/physics/MatterEngine';
import { applyEffectEvent } from '../game/systems/effects';
import { FixedStepper, FIXED_STEP_MS } from '../game/systems/fixedStep';

type JoystickState = { active: boolean; startX: number; startY: number; currentX: number; currentY: number };

const HUNGER_RESTART_DELAY = 10000;

const detectMobile = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

export default function GameCanvas() {
    const containerRef = useRef<HTMLDivElement>(null);
    const pixiApp = useRef<Application | null>(null);
    // Online match (CLIENT mode only) and the id of the player this browser controls
    const sessionRef = useRef<ClientSession | null>(null);
    const localIdRef = useRef('player');
    const [netError, setNetError] = React.useState<string | null>(null);
    const [onlineMode, setOnlineMode] = React.useState<GameMode | null>(null);
    const [inviteLink, setInviteLink] = React.useState<string | null>(null);
    const [infiltrationTimeLeft, setInfiltrationTimeLeft] = React.useState<number | null>(null);
    const [gunGameStatus, setGunGameStatus] = React.useState<{ weapon: string; level: number; progress: number; total: number } | null>(null);
    const [gunGameWinner, setGunGameWinner] = React.useState<string | null>(null);
    const shakeIntensity = useRef(0);
    const lastStateUpdate = useRef(0);
    const gunGameEndedRef = useRef(false);
    const { state, actions } = useUIStore();
    const { t } = useTranslation();
    const physicsEngine = useRef<MatterPhysicsEngine>(null as unknown as MatterPhysicsEngine);
    if (!physicsEngine.current) physicsEngine.current = new MatterPhysicsEngine();

    // Game State
    const gameState = useRef<GameState>({
        mode: state.selectedMode,
        scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
        players: [],
        projectiles: [],
        particles: [],
        decals: [],
        floatingTexts: [],
        platforms: [],
        pickups: [],
        camera: { x: 0, y: 0, zoom: 1 },
        ragdollParts: [],
        lastHTFScore: 0,
        infiltrationEndTime: undefined,
        currentMap: state.selectedMap,
        hungerZone: undefined,
        hungerWinnerId: null
    });

    const visualCache = useRef({
        players: new Map(),
        projectiles: new Map(),
        particles: new Map(),
        pickups: new Map(),
        decals: new Map(),
        floatingTexts: new Map(),
        beams: new Map(),
        textures: {} as Record<string, Texture>,
    });

    // Input Refs
    const keys = useRef<{ [key: string]: boolean }>({});
    const mouse = useRef({ x: 0, y: 0 });
    const mousePressed = useRef(false);
    const hookPressed = useRef(false);
    const isMutedRef = useRef(state.isMuted);
    // Online, the server decides the mode; the HUD follows it once we've joined
    const gameMode = onlineMode ?? state.selectedMode;
    const hungerCredits = useRef(100);

    // Mobile touch controls
    const [isMobile, setIsMobile] = React.useState(detectMobile);
    // Joystick: the ref drives game input, the state only drives the on-screen widget
    const [touchJoystick, setTouchJoystick] = React.useState<JoystickState | null>(null);
    const joystickRef = useRef<JoystickState | null>(null);
    const updateJoystick = (next: JoystickState | null) => {
        joystickRef.current = next;
        setTouchJoystick(next);
    };
    const [touchButtons, setTouchButtons] = React.useState<{ jump: boolean; hook: boolean; fire: boolean }>({ jump: false, hook: false, fire: false });
    const [hungerBetTarget, setHungerBetTarget] = React.useState<string | null>(null);
    const [hungerWinner, setHungerWinner] = React.useState<string | null>(null);
    const [hungerWinnerId, setHungerWinnerId] = React.useState<string | null>(null);
    const [hungerAlive, setHungerAlive] = React.useState<{ id: string; name: string }[]>([]);
    const [isLocalDead, setIsLocalDead] = React.useState(false);
    const [hungerShrinkCountdown, setHungerShrinkCountdown] = React.useState<number | null>(null);
    const [hungerEnded, setHungerEnded] = React.useState(false);
    const [hungerRestartCountdown, setHungerRestartCountdown] = React.useState<number | null>(null);
    // Loop-owned values live in refs: the Pixi ticker closure never sees fresh React state
    const hungerRestartAtRef = useRef<number | null>(null);
    const hungerWinnerShownRef = useRef(false);
    const hungerAliveKeyRef = useRef('');
    const gunGameStatusKeyRef = useRef('');

    // Achievement system
    const [recentAchievement, setRecentAchievement] = React.useState<Achievement | null>(null);
    const [showAchievements, setShowAchievements] = React.useState(false);

    // F3 debug overlay: frames/s (display refresh) vs physics ticks/s (should stay at PHYSICS_TICK_RATE)
    const [debugStats, setDebugStats] = React.useState<{ fps: number; tps: number } | null>(null);
    const debugVisibleRef = useRef(false);
    const debugCounters = useRef({ frames: 0, ticks: 0, since: 0 });

    // HP Animation State
    const previousHP = useRef(100);
    const [hpGainAmount, setHpGainAmount] = React.useState<number | null>(null);
    const [showHpGain, setShowHpGain] = React.useState(false);

    // Achievement listener
    React.useEffect(() => {
        let hideTimer: ReturnType<typeof setTimeout> | undefined;
        const handleAchievementUnlock = (achievement: Achievement) => {
            setRecentAchievement(achievement);
            // Hide after 5 seconds
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setRecentAchievement(null), 5000);
        };

        const unsubscribe = achievementManager.onAchievementUnlocked(handleAchievementUnlock);
        return () => {
            unsubscribe();
            clearTimeout(hideTimer);
        };
    }, []);
    const placeHungerBet = (id: string) => {
        if (hungerBetTarget || hungerCredits.current < 100) return;
        hungerCredits.current -= 100;
        setHungerBetTarget(id);
        // When spectating, follow the bet target
        const betPlayer = gameState.current.players.find(p => p.id === id);
        if (betPlayer) {
            gameState.current.camera.x = betPlayer.pos.x;
            gameState.current.camera.y = betPlayer.pos.y;
        }
        (gameState.current as any).betSpectateId = id;
    };

    const getSpawnPoint = (team: Team) => {
        if (gameMode === GameMode.HUNGER_GAMES) {
            return { x: -2400 + Math.random() * 4800, y: Math.random() > 0.5 ? 1200 + Math.random() * 300 : 200 + Math.random() * 800 };
        }
        if (team === Team.BLUE) return { x: -400 + Math.random() * 200, y: 400 };
        if (team === Team.RED) return { x: 2200 + Math.random() * 200, y: 400 };
        return { x: Math.random() * 2000, y: Math.random() > 0.5 ? 700 : 200 };
    };

    const makeInitialState = (): GameState => ({
        mode: state.selectedMode,
        scores: { [Team.BLUE]: 0, [Team.RED]: 0, [Team.NONE]: 0 },
        players: [],
        projectiles: [],
        particles: [],
        decals: [],
        floatingTexts: [],
        platforms: [],
        pickups: [],
        camera: { x: 0, y: 0, zoom: 1 },
        ragdollParts: [],
        lastHTFScore: 0,
        infiltrationEndTime: undefined,
        currentMap: state.selectedMap,
        hungerZone: undefined,
        hungerWinnerId: null,
        gunGameWinnerId: null,
        beams: []
    });

    const initLevel = () => {
        const effectiveMap = (gameMode === GameMode.DEATHMATCH || gameMode === GameMode.HUNGER_GAMES || gameMode === GameMode.GUN_GAME)
            ? state.selectedMap
            : MapId.DEFAULT;
        gameState.current.currentMap = effectiveMap;
        gameState.current.platforms = getPlatforms(gameMode, effectiveMap);

        physicsEngine.current.clear();
        gameState.current.platforms.forEach(p => physicsEngine.current.addPlatform(p));

        gameState.current.gunGameWinnerId = null;
        if (gameMode === GameMode.HUNGER_GAMES) {
            gameState.current.hungerZone = { x: -2600, y: -1600, w: 8200, h: 3600, lastShrink: Date.now() };
            gameState.current.hungerWinnerId = null;
            hungerCredits.current = 100;
            setHungerBetTarget(null);
            setHungerWinner(null);
            setHungerWinnerId(null);
            setHungerShrinkCountdown(null);
            setHungerEnded(false);
            (gameState.current as any).betSpectateId = null;
            hungerRestartAtRef.current = null;
            hungerWinnerShownRef.current = false;
            setHungerRestartCountdown(null);
        } else {
            gameState.current.hungerZone = undefined;
            gameState.current.hungerWinnerId = null;
            setHungerWinnerId(null);
        }

        // Init Players (Only for OFFLINE mode)
        if (state.networkMode === NetworkMode.OFFLINE) {
            const isTeamMode = gameMode === GameMode.CTF || gameMode === GameMode.HOLD_THE_FLAG || gameMode === GameMode.INFILTRATION;
            const playerTeam = isTeamMode ? Team.BLUE : Team.NONE;
            const startPos = getSpawnPoint(playerTeam);

            // Create Main Player
            const baseWeaponType = gameMode === GameMode.GUN_GAME ? GUN_GAME_LADDER[0] : WeaponType.MACHINE_GUN;
            const startWeapon = { ...WEAPONS_DATA[baseWeaponType] };
            gameState.current.players.push({
                id: 'player', type: 'player', pos: startPos, vel: { x: 0, y: 0 }, width: 30, height: 72, color: state.playerColor,
                headColor: state.headColor, torsoColor: state.torsoColor, armColor: state.armColor, legColor: state.legColor,
                isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
                jetpackFuel: 100, maxFuel: 100, jetpackColor: state.jetpackColor,
                dead: false, respawnTimer: 0, team: playerTeam,
                facingRight: true, weapon: startWeapon, inventory: [startWeapon], lastFired: 0, skinId: state.selectedSkin,
                name: state.playerName, score: 0,
                gunLevel: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                gunProgress: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE
            });

            // Create Bots
            const botCount = gameMode === GameMode.HUNGER_GAMES ? 7 : (isTeamMode ? 6 : 3);
            for (let i = 0; i < botCount; i++) {
                let team = Team.NONE;
                if (isTeamMode) {
                    if (gameMode === GameMode.INFILTRATION) {
                        team = i < 2 ? Team.BLUE : Team.RED;
                    } else {
                        team = i % 2 === 0 ? Team.RED : Team.BLUE;
                    }
                }
                const pos = getSpawnPoint(team);
                const botWeaponType = gameMode === GameMode.GUN_GAME ? GUN_GAME_LADDER[0] : WeaponType.MACHINE_GUN;
                const botWeapon = { ...WEAPONS_DATA[botWeaponType] };
                gameState.current.players.push({
                    id: `bot_${i} `, type: 'bot', pos, vel: { x: 0, y: 0 }, width: 30, height: 72,
                    color: team === Team.RED ? '#ef4444' : '#3b82f6',
                    headColor: team === Team.RED ? '#ef4444' : '#3b82f6',
                    torsoColor: team === Team.RED ? '#ef4444' : '#3b82f6',
                    armColor: team === Team.RED ? '#ef4444' : '#3b82f6',
                    legColor: '#475569',
                    isGrounded: false, isCrouching: false, health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
                    jetpackFuel: 100, maxFuel: 100, jetpackColor: '#64748b', dead: false, respawnTimer: 0, team,
                    facingRight: true, weapon: botWeapon, inventory: [botWeapon], lastFired: 0, skinId: 'classic',
                    name: `Bot ${i + 1} `, score: 0,
                    gunLevel: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                    gunProgress: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE
                });
            }

            gameState.current.players.forEach(p => physicsEngine.current.addPlayer(p));
        }

        // Pickups
        gameState.current.pickups = getInitialPickups(state.selectedMode);
        if (state.selectedMode === GameMode.INFILTRATION) {
            gameState.current.infiltrationEndTime = Date.now() + INFILTRATION_TIMER;
            setInfiltrationTimeLeft(INFILTRATION_TIMER);
        } else {
            setInfiltrationTimeLeft(null);
        }
    };
    useEffect(() => {
        isMutedRef.current = state.isMuted;
    }, [state.isMuted]);

    useEffect(() => {
        // Detect mobile device
        const checkMobile = () => setIsMobile(detectMobile());
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (!containerRef.current) return;
        // Сброс state на старт, чтобы не накапливались игроки/боты при повторах
        console.log('GameCanvas mounting. Player:', state.playerName, state.playerColor, 'Mode:', gameMode);
        gameState.current = makeInitialState();
        const app = new Application();
        const setKillFeed = actions.setKillFeed;
        const setStats = actions.setStats;
        const setPlayerInventory = actions.setPlayerInventory;
        const setActiveWeaponType = actions.setActiveWeaponType;
        const setScores = actions.setScores;
        let onKeyDown: ((e: KeyboardEvent) => void) | null = null;
        let onKeyUp: ((e: KeyboardEvent) => void) | null = null;
        let onMouseMove: ((e: MouseEvent) => void) | null = null;
        let onMouseDown: ((e: MouseEvent) => void) | null = null;
        let onMouseUp: ((e: MouseEvent) => void) | null = null;
        let onContextMenu: ((e: Event) => void) | null = null;
        let onTouchStart: ((e: TouchEvent) => void) | null = null;
        let onTouchMove: ((e: TouchEvent) => void) | null = null;
        let onTouchEnd: ((e: TouchEvent) => void) | null = null;
        let onBlur: (() => void) | null = null;
        let onVisibilityChange: (() => void) | null = null;
        // Read once here: the isMobile state is not a dependency of this effect
        const mobile = detectMobile();

        // Online match: the server owns the simulation, we predict our own player
        let redrawMap: (() => void) | null = null;
        if (state.networkMode === NetworkMode.CLIENT) {
            const serverUrl = resolveServerUrl(state.gameId, window.location.hostname);
            console.log('Connecting to server:', serverUrl);
            setNetError(null);
            const session = new ClientSession(serverUrl, {
                name: state.playerName,
                color: state.playerColor,
                skinId: state.selectedSkin,
                headColor: state.headColor,
                torsoColor: state.torsoColor,
                armColor: state.armColor,
                legColor: state.legColor,
                jetpackColor: state.jetpackColor,
            }, physicsEngine.current, {
                onJoined: info => {
                    localIdRef.current = info.id;
                    session.setupWorld(gameState.current, info);
                    setOnlineMode(info.mode);
                    redrawMap?.();
                },
                onRejected: reason => setNetError(
                    reason === 'full' ? t('net.serverFull') : reason === 'invalid' ? t('net.joinInvalid') : t('net.alreadyJoined')
                ),
                onConnectionError: message => setNetError(`${t('net.cannotConnect')} ${serverUrl} (${message})`),
                onEvents: events => events.forEach(e => gameEvents.emit(e)),
            });
            sessionRef.current = session;
        }

        let isMounted = true;
        const stepper = new FixedStepper();

        const updateDebugStats = (now: number, ticksRun: number) => {
            const c = debugCounters.current;
            c.frames++;
            c.ticks += ticksRun;
            const elapsed = now - c.since;
            if (elapsed < 500) return;
            if (debugVisibleRef.current) {
                setDebugStats({ fps: Math.round(c.frames * 1000 / elapsed), tps: Math.round(c.ticks * 1000 / elapsed) });
            }
            c.frames = 0;
            c.ticks = 0;
            c.since = now;
        };

        const setup = async () => {
            await app.init({ resizeTo: window, backgroundColor: 0x020617, antialias: true, autoDensity: true });

            if (!isMounted) {
                // Keep textures: they are shared via the generateAssets() cache
                app.destroy(true, { children: true, texture: false });
                return;
            }

            clearBotMemory();

            if (containerRef.current) containerRef.current.appendChild(app.canvas);
            pixiApp.current = app;

            // Layers
            const worldContainer = new Container();
            app.stage.addChild(worldContainer);
            const backgroundLayer = new Graphics();
            const decalLayer = new Container();
            const zoneLayer = new Graphics();
            const platformLayer = new Graphics();
            const gameLayer = new Container();
            const uiLayer = new Container();

            worldContainer.addChild(backgroundLayer);
            worldContainer.addChild(decalLayer);
            worldContainer.addChild(zoneLayer);
            worldContainer.addChild(platformLayer);
            worldContainer.addChild(gameLayer);
            app.stage.addChild(uiLayer);

            // Subscribe to game events (kill feed, sounds)
            const unsubEvents = gameEvents.on((event) => {
                if (event.type === 'KILL') {
                    setKillFeed((prev: any) => [...prev.slice(-4), {
                        id: `kf_${Date.now()}`,
                        killer: event.killer,
                        killerColor: event.killerColor,
                        weapon: event.weapon,
                        victim: event.victim,
                        victimColor: event.victimColor
                    }]);
                } else if (event.type === 'SOUND') {
                    playSound(event.sound as any, event.subtype as any, isMutedRef.current);
                } else {
                    // Blood, explosions, damage numbers… (offline from the simulation, online from the server)
                    applyEffectEvent(gameState.current, event);
                }
            });

            // Online, the map arrives from the server on join (ClientSession.setupWorld)
            if (state.networkMode !== NetworkMode.CLIENT) initLevel();

            // Start Loop
            app.ticker.add(() => {
                const now = Date.now();
                const liveMode = gameState.current.mode;
                const hungerFinished = liveMode === GameMode.HUNGER_GAMES && !!gameState.current.hungerWinnerId;
                if (hungerFinished) {
                    const champ = gameState.current.players.find(p => p.id === gameState.current.hungerWinnerId);
                    if (champ) {
                        gameState.current.camera.x += (champ.pos.x - gameState.current.camera.x) * 0.1;
                        gameState.current.camera.y += (champ.pos.y - 50 - gameState.current.camera.y) * 0.1;
                    }
                    if (hungerRestartAtRef.current === null) hungerRestartAtRef.current = now + HUNGER_RESTART_DELAY;
                    const remaining = Math.max(0, Math.ceil((hungerRestartAtRef.current - now) / 1000));
                    setHungerRestartCountdown(remaining);
                    if (remaining <= 0) {
                        // Restart round
                        // Clear visual caches
                        visualCache.current.players.clear();
                        visualCache.current.projectiles.clear();
                        visualCache.current.particles.clear();
                        visualCache.current.pickups.clear();
                        visualCache.current.decals.clear();
                        visualCache.current.floatingTexts.clear();
                        decalLayer.removeChildren().forEach(c => c.destroy({ children: true }));
                        gameLayer.removeChildren().forEach(c => c.destroy({ children: true }));
                        platformLayer.clear();
                        zoneLayer.clear();

                        const nextState = makeInitialState();
                        nextState.mode = GameMode.HUNGER_GAMES;
                        nextState.currentMap = MapId.HUNGER;
                        gameState.current = nextState;
                        initLevel();
                        drawStaticMap(platformLayer, gameState.current.platforms, gameState.current.currentMap, visualCache.current);
                        drawBackground(backgroundLayer, app.screen.width, app.screen.height);
                        setHungerWinner(null);
                        setHungerWinnerId(null);
                        setHungerEnded(false);
                        setHungerRestartCountdown(null);
                    }
                    // Keep rendering positions but skip input/physics
                    syncVisuals(
                        app,
                        worldContainer,
                        gameLayer,
                        decalLayer,
                        uiLayer,
                        gameState.current,
                        visualCache.current,
                        shakeIntensity,
                        mouse.current,
                        null,
                        null,
                        null,
                        null,
                        null,
                        localIdRef.current
                    );
                    drawZoneOverlay(zoneLayer, gameState.current.hungerZone);
                    return;
                }

                // Simulate at a fixed PHYSICS_TICK_RATE regardless of display refresh rate
                const ticksRun = stepper.advance(app.ticker.deltaMS, () => {
                    if (state.networkMode === NetworkMode.CLIENT) {
                        const camera = gameState.current.camera;
                        sessionRef.current?.tick(gameState.current, {
                            keys: { ...keys.current },
                            aim: { x: mouse.current.x - app.screen.width / 2 + camera.x, y: mouse.current.y - app.screen.height / 2 + camera.y },
                            mousePressed: mousePressed.current,
                            hookPressed: hookPressed.current,
                        }, performance.now());
                    } else {
                        // OFFLINE MODE

                        // 1. Step Matter (uses velocity from previous frame)
                        physicsEngine.current.step(FIXED_STEP_MS);

                        // 2. Read latest pos/vel/isGrounded from this step
                        physicsEngine.current.syncGameState(gameState.current);

                        // 3. Force Pipeline (gravity, inputs, jetpack, grapple, friction, caps)
                        updatePhysics(
                            gameState.current,
                            keys.current,
                            mouse.current,
                            hookPressed.current,
                            mousePressed.current,
                            app.screen.width,
                            app.screen.height,
                            getSpawnPoint,
                            'player'
                        );

                        // 4. Push updated velocities to Matter for next step
                        physicsEngine.current.syncFromGameState(gameState.current);

                        // 5. Speed clamp
                        gameState.current.players.forEach(player => {
                            const body = physicsEngine.current.bodies.get(player.id);
                            if (body) {
                                if (body.velocity.x > 15) physicsEngine.current.setVelocity(player.id, { x: 15, y: body.velocity.y });
                                if (body.velocity.x < -15) physicsEngine.current.setVelocity(player.id, { x: -15, y: body.velocity.y });
                            }
                        });
                    }
                });
                updateDebugStats(now, ticksRun);

                if (liveMode === GameMode.HUNGER_GAMES) {
                    const alive = gameState.current.players.filter(p => !p.dead).map(p => ({ id: p.id, name: p.name }));
                    const aliveKey = alive.map(p => p.id).join('|');
                    if (aliveKey !== hungerAliveKeyRef.current) {
                        hungerAliveKeyRef.current = aliveKey;
                        setHungerAlive(alive);
                    }
                    if (gameState.current.hungerWinnerId && !hungerWinnerShownRef.current) {
                        hungerWinnerShownRef.current = true;
                        const found = gameState.current.players.find(pl => pl.id === gameState.current.hungerWinnerId);
                        setHungerWinner(found ? found.name : gameState.current.hungerWinnerId);
                        setHungerWinnerId(gameState.current.hungerWinnerId);
                        setHungerEnded(true);
                        if (hungerRestartAtRef.current === null) hungerRestartAtRef.current = now + HUNGER_RESTART_DELAY;
                    }
                    const local = gameState.current.players.find(p => p.id === localIdRef.current);
                    setIsLocalDead(!!local?.dead);
                    if (gameState.current.hungerZone?.pendingShrink && gameState.current.hungerZone.nextShrinkAt) {
                        const eta = Math.max(0, Math.ceil((gameState.current.hungerZone.nextShrinkAt - now) / 1000));
                        setHungerShrinkCountdown(eta);
                    } else {
                        setHungerShrinkCountdown(null);
                    }
                }
                if (liveMode === GameMode.GUN_GAME) {
                    const local = gameState.current.players.find(p => p.id === localIdRef.current);
                    if (local) {
                        const status = {
                            weapon: local.weapon.name,
                            level: (local.gunLevel || 0) + 1,
                            progress: local.gunProgress || 0,
                            total: GUN_GAME_LADDER.length
                        };
                        const statusKey = `${status.weapon}|${status.level}|${status.progress}`;
                        if (statusKey !== gunGameStatusKeyRef.current) {
                            gunGameStatusKeyRef.current = statusKey;
                            setGunGameStatus(status);
                        }
                    }
                    if (gameState.current.gunGameWinnerId && !gunGameEndedRef.current) {
                        gunGameEndedRef.current = true;
                        const winner = gameState.current.players.find(pl => pl.id === gameState.current.gunGameWinnerId);
                        setGunGameWinner(winner?.name || gameState.current.gunGameWinnerId);
                    }
                } else {
                    if (gunGameStatus) setGunGameStatus(null);
                    if (gunGameWinner) setGunGameWinner(null);
                    gunGameEndedRef.current = false;
                }

                // Zone overlay
                if (liveMode === GameMode.HUNGER_GAMES) {
                    drawZoneOverlay(zoneLayer, gameState.current.hungerZone, now);
                } else {
                    zoneLayer.clear();
                }

                // RENDER UPDATE - Optimized frequency
                const shouldUpdateUI = now - lastStateUpdate.current > 150; // Reduced from 100ms to 150ms
                if (shouldUpdateUI) {
                    syncVisuals(
                        app,
                        worldContainer,
                        gameLayer,
                        decalLayer,
                        uiLayer,
                        gameState.current,
                        visualCache.current,
                        shakeIntensity,
                        mouse.current,
                        setStats,
                        setPlayerInventory,
                        setActiveWeaponType,
                        setScores,
                        actions.setPlayerScores,
                        localIdRef.current
                    );
                    lastStateUpdate.current = now;
                } else {
                    // Still sync visuals (positions etc) but DONT update React state
                    syncVisuals(
                        app,
                        worldContainer,
                        gameLayer,
                        decalLayer,
                        uiLayer,
                        gameState.current,
                        visualCache.current,
                        shakeIntensity,
                        mouse.current,
                        null, // Pass null to skip React updates
                        null,
                        null,
                        null,
                        null,
                        localIdRef.current
                    );
                }
            });

            // Draw static elements
            redrawMap = () => drawStaticMap(platformLayer, gameState.current.platforms, gameState.current.currentMap, visualCache.current);
            redrawMap();
            drawBackground(backgroundLayer, app.screen.width, app.screen.height);

            // Load assets async
            const textures = await generateAssets();
            // Component may have unmounted while assets were loading — don't attach listeners
            if (!isMounted) return;
            visualCache.current.textures = textures;
            // Redraw the map once textures are ready so tunnel tiles use real sprites
            drawStaticMap(platformLayer, gameState.current.platforms, gameState.current.currentMap, visualCache.current);

            // Upgrade already spawned pickups to use the newly loaded textures
            visualCache.current.pickups.forEach((container, id) => {
                const pickup = gameState.current.pickups.find(p => p.id === id);
                if (!pickup) return;
                const texture = textures[pickup.type];
                const hasSprite = container.getChildByLabel('sprite');
                const baseTex = texture;
                let tex: Texture | undefined = baseTex;
                if (pickup.type === ItemType.FLAG) {
                    const teamKey = pickup.team === Team.BLUE ? 'flag_blue' : pickup.team === Team.RED ? 'flag_red' : undefined;
                    tex = (teamKey && (textures as any)[teamKey]) || textures[pickup.type] || baseTex;
                } else if (pickup.type === ItemType.WEAPON && pickup.subtype) {
                    const key = `weapon_${pickup.subtype.toLowerCase?.() ?? String(pickup.subtype).toLowerCase()}`;
                    tex = (textures as any)[key] || baseTex;
                }

                if (!hasSprite && tex) {
                    const oldGraphic = container.getChildByLabel('g');
                    if (oldGraphic) { container.removeChild(oldGraphic); oldGraphic.destroy(); }
                    const baseScale = getPickupSpriteScale(pickup.type, tex);
                    let scale = baseScale;
                    if (pickup.type === ItemType.WEAPON && pickup.subtype === WeaponType.SHOTGUN) scale = baseScale * 1.4;
                    else if (pickup.type === ItemType.WEAPON && pickup.subtype === WeaponType.ROCKET_LAUNCHER) scale = baseScale * 1.4;
                    const sprite = new Sprite(tex);
                    sprite.anchor.set(0.5);
                    sprite.scale.set(scale);
                    sprite.label = 'sprite';
                    container.addChild(sprite);
                }
            });

            // Inputs
            onKeyDown = (e: KeyboardEvent) => {
                keys.current[e.code] = true;
                const local = gameState.current.players.find(p => p.id === localIdRef.current);
                const num = parseInt(e.key);
                if (!isNaN(num) && num >= 1 && num <= 6) {
                    const w = local?.inventory[num - 1];
                    if (w && local) local.weapon = w;
                    sessionRef.current?.selectWeapon(num - 1);
                }
                if (e.code === 'F3') {
                    e.preventDefault();
                    debugVisibleRef.current = !debugVisibleRef.current;
                    if (!debugVisibleRef.current) setDebugStats(null);
                }
                if (e.code === 'Escape') {
                    // Works before joining too (e.g. server unreachable)
                    actions.finishGame(local?.score ?? 0);
                }
                // Shift key can also activate grappling hook (convenient for trackpad users)
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') hookPressed.current = true;
            };
            onKeyUp = (e: KeyboardEvent) => {
                keys.current[e.code] = false;
                // Release grappling hook when Shift is released
                if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') hookPressed.current = false;
            };
            onMouseMove = (e: MouseEvent) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; };
            onMouseDown = (e: MouseEvent) => {
                initAudio().catch(err => console.error('Audio init failed:', err));
                if (e.button === 0) mousePressed.current = true;
                if (e.button === 2) hookPressed.current = true;
            };
            onMouseUp = (e: MouseEvent) => { if (e.button === 0) mousePressed.current = false; if (e.button === 2) hookPressed.current = false; };
            onContextMenu = (e: Event) => e.preventDefault();

            // Release all inputs when the window loses focus, otherwise keys stay "held"
            onBlur = () => {
                keys.current = {};
                mousePressed.current = false;
                hookPressed.current = false;
            };
            onVisibilityChange = () => { if (document.hidden) onBlur?.(); };

            // Mobile touch controls
            // Mobile touch controls

            if (mobile) {
                const isLeftHalf = (t: Touch) => t.clientX < app.canvas.getBoundingClientRect().width / 2;
                const releaseMoveKeys = () => {
                    keys.current['KeyW'] = false;
                    keys.current['KeyS'] = false;
                    keys.current['KeyA'] = false;
                    keys.current['KeyD'] = false;
                };

                onTouchStart = (e: TouchEvent) => {
                    e.preventDefault();
                    const rect = app.canvas.getBoundingClientRect();
                    // changedTouches: only the finger(s) that just went down
                    for (const touch of Array.from(e.changedTouches)) {
                        if (isLeftHalf(touch)) {
                            // Left side - movement joystick
                            updateJoystick({
                                active: true,
                                startX: touch.clientX,
                                startY: touch.clientY,
                                currentX: touch.clientX,
                                currentY: touch.clientY
                            });
                        } else {
                            // Right side - aim and fire
                            mouse.current.x = touch.clientX - rect.left;
                            mouse.current.y = touch.clientY - rect.top;
                            mousePressed.current = true;
                        }
                    }
                };

                onTouchMove = (e: TouchEvent) => {
                    e.preventDefault();
                    const joystick = joystickRef.current;
                    const leftTouch = Array.from(e.touches).find(isLeftHalf);
                    if (joystick?.active && leftTouch) {
                        const maxDistance = 50;
                        const clampedX = Math.max(-maxDistance, Math.min(maxDistance, leftTouch.clientX - joystick.startX));
                        const clampedY = Math.max(-maxDistance, Math.min(maxDistance, leftTouch.clientY - joystick.startY));

                        updateJoystick({ ...joystick, currentX: leftTouch.clientX, currentY: leftTouch.clientY });

                        // Update movement keys based on joystick
                        keys.current['KeyW'] = clampedY < -20;
                        keys.current['KeyS'] = clampedY > 20;
                        keys.current['KeyA'] = clampedX < -20;
                        keys.current['KeyD'] = clampedX > 20;
                    }

                    // Handle aiming on right side
                    const rightTouch = Array.from(e.touches).find(t => !isLeftHalf(t));
                    if (rightTouch) {
                        const rect = app.canvas.getBoundingClientRect();
                        mouse.current.x = rightTouch.clientX - rect.left;
                        mouse.current.y = rightTouch.clientY - rect.top;
                    }
                };

                onTouchEnd = (e: TouchEvent) => {
                    e.preventDefault();
                    const remaining = Array.from(e.touches);
                    // Release the joystick as soon as no finger is left on the left half
                    if (joystickRef.current?.active && !remaining.some(isLeftHalf)) {
                        updateJoystick(null);
                        releaseMoveKeys();
                    }
                    if (!remaining.some(t => !isLeftHalf(t))) {
                        mousePressed.current = false;
                    }
                };
            }

            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('contextmenu', onContextMenu);
            window.addEventListener('blur', onBlur);
            document.addEventListener('visibilitychange', onVisibilityChange);

            // Mobile touch listeners
            if (mobile && onTouchStart && onTouchMove && onTouchEnd) {
                app.canvas.addEventListener('touchstart', onTouchStart, { passive: false });
                app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
                app.canvas.addEventListener('touchend', onTouchEnd, { passive: false });
            }
        };

        setup();

        return () => {
            isMounted = false;
            gameEvents.clear();
            if (onKeyDown) window.removeEventListener('keydown', onKeyDown);
            if (onKeyUp) window.removeEventListener('keyup', onKeyUp);
            if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
            if (onMouseDown) window.removeEventListener('mousedown', onMouseDown);
            if (onMouseUp) window.removeEventListener('mouseup', onMouseUp);
            if (onContextMenu) window.removeEventListener('contextmenu', onContextMenu);
            if (onBlur) window.removeEventListener('blur', onBlur);
            if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);

            // Mobile touch cleanup
            if (mobile && pixiApp.current) {
                const canvas = pixiApp.current.canvas;
                if (onTouchStart) canvas.removeEventListener('touchstart', onTouchStart);
                if (onTouchMove) canvas.removeEventListener('touchmove', onTouchMove);
                if (onTouchEnd) canvas.removeEventListener('touchend', onTouchEnd);
            }

            // Keep textures: they are shared via the generateAssets() cache and reused next game
            if (pixiApp.current) pixiApp.current.destroy(true, { children: true, texture: false });
            gameState.current = makeInitialState();
            // Clear visual cache to prevent reusing dead sprites
            visualCache.current.players.clear();
            visualCache.current.projectiles.clear();
            visualCache.current.particles.clear();
            visualCache.current.pickups.clear();
            visualCache.current.decals.clear();
            sessionRef.current?.dispose();
            sessionRef.current = null;
            localIdRef.current = 'player';
            visualCache.current.floatingTexts.clear();
        };
    }, [actions, state.selectedMode, state.selectedSkin, state.playerColor, state.playerName, state.jetpackColor, state.headColor, state.armColor, state.legColor, state.torsoColor]);

    const stats = state.stats;
    const scores = state.scores;
    const playerInventory = state.playerInventory;
    const activeWeaponType = state.activeWeaponType;
    const killFeed = state.killFeed;
    const playerScores = state.playerScores;

    useEffect(() => { isMutedRef.current = state.isMuted; }, [state.isMuted]);

    useEffect(() => {
        if (gameMode !== GameMode.HUNGER_GAMES) return;
        if (hungerWinnerId && hungerBetTarget) {
            if (hungerWinnerId === hungerBetTarget) {
                hungerCredits.current += 200;
            }
        }
    }, [hungerWinnerId, hungerBetTarget, gameMode]);

    useEffect(() => {
        if (gameMode !== GameMode.INFILTRATION) return;
        const id = setInterval(() => {
            const end = gameState.current.infiltrationEndTime;
            if (!end) return;
            const remaining = Math.max(0, end - Date.now());
            setInfiltrationTimeLeft(remaining);
        }, 500);
        return () => clearInterval(id);
    }, [gameMode]);

    // HP Gain Animation Effect
    useEffect(() => {
        const currentHP = stats.hp;
        if (currentHP > previousHP.current && previousHP.current > 0) {
            // HP increased!
            const gain = currentHP - previousHP.current;
            previousHP.current = currentHP;
            setHpGainAmount(gain);
            setShowHpGain(true);

            // Hide after 1.5 seconds
            const timer = setTimeout(() => {
                setShowHpGain(false);
            }, 1500);

            return () => clearTimeout(timer);
        }
        previousHP.current = currentHP;
    }, [stats.hp]);

    return (
        <div ref={containerRef} className="w-full h-full bg-black relative">
            {/* HUD UI RENDERED HERE (Same as before) */}
            <div className="absolute top-4 left-4 z-50 cursor-pointer" onClick={actions.toggleMute}>
                <div className={`w-8 h-8 flex items-center justify-center rounded bg-gray-800 border border-gray-600 text-white select-none`}>
                    {state.isMuted ? '🔇' : '🔊'}
                </div>
            </div>

            {state.networkMode === NetworkMode.CLIENT && !onlineMode && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
                    <div className="px-6 py-4 rounded-xl bg-black/80 border border-white/10 text-center font-mono">
                        <div className={netError ? 'text-red-400 font-bold' : 'text-gray-200'}>{netError ?? t('net.connecting')}</div>
                        {netError && <div className="text-xs text-gray-400 mt-2">{t('net.backToMenu')}</div>}
                    </div>
                </div>
            )}

            {debugStats && (
                <div className="absolute top-14 left-4 z-50 px-2 py-1 rounded bg-black/70 border border-white/10 font-mono text-xs text-green-300 pointer-events-none">
                    FPS {debugStats.fps} · physics {debugStats.tps}/s
                </div>
            )}

            {/* Счет команд для CTF/HTF/INFILTRATION */}
            {(gameMode === GameMode.CTF || gameMode === GameMode.HOLD_THE_FLAG || gameMode === GameMode.INFILTRATION) && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-4 py-2 bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg font-mono text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                        <span className="text-blue-300 font-bold text-lg">{scores.blue}</span>
                    </div>
                    <div className="text-gray-400 text-xs">
                        {gameMode === GameMode.CTF ? 'CTF' : gameMode === GameMode.HOLD_THE_FLAG ? 'HOLD' : 'INF'}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-red-300 font-bold text-lg">{scores.red}</span>
                        <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    </div>
                </div>
            )}

            {/* Hunger Games zone visualization */}
            {gameMode === GameMode.INFILTRATION && infiltrationTimeLeft !== null && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3 py-1 bg-black/60 border border-amber-400/40 rounded text-amber-200 font-mono text-sm">
                    T-{Math.ceil(infiltrationTimeLeft / 1000)}s
                </div>
            )}

            {gameMode === GameMode.HUNGER_GAMES && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-black/70 border border-lime-400/50 rounded text-lime-200 font-mono text-sm flex items-center gap-4">
                    <span className="font-bold">Credits: {hungerCredits.current}</span>
                    {hungerBetTarget ? (
                        <span className="text-gray-300 text-xs">Bet placed on {hungerBetTarget}</span>
                    ) : (
                        <span className="text-gray-400 text-xs">Bet 100 on a survivor after you die</span>
                    )}
                    {hungerWinner && (
                        <span className="text-yellow-300 text-xs font-bold">Winner: {hungerWinner}</span>
                    )}
                    {hungerShrinkCountdown !== null && !hungerEnded && (
                        <span className="text-lime-300 text-xs font-bold">Zone shrinks in {hungerShrinkCountdown}s</span>
                    )}
                    {hungerRestartCountdown !== null && hungerEnded && (
                        <span className="text-amber-300 text-xs font-bold">Next round in {hungerRestartCountdown}s</span>
                    )}
                </div>
            )}
            {gameMode === GameMode.GUN_GAME && gunGameStatus && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-4 py-3 bg-black/70 border border-fuchsia-400/50 rounded text-fuchsia-100 font-mono text-sm flex flex-col gap-1 w-[280px]">
                    <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-xs">{t('ui.gunProgress')}</span>
                        <span className="text-[11px] text-gray-300">Lv {gunGameStatus.level}/{gunGameStatus.total}</span>
                    </div>
                    <div className="text-white font-bold text-base truncate">{gunGameStatus.weapon}</div>
                    <div className="w-full h-2 bg-gray-800 rounded overflow-hidden border border-gray-700/80">
                        <div
                            className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                            style={{ width: `${Math.min(100, (gunGameStatus.progress / GUN_GAME_KILLS_PER_LEVEL) * 100)}%` }}
                        />
                    </div>
                    <div className="text-[11px] text-gray-400">{gunGameStatus.progress}/{GUN_GAME_KILLS_PER_LEVEL} kills this level</div>
                </div>
            )}

            {/* Invite Link Overlay */}
            {inviteLink && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
                    <div className="bg-purple-900/80 backdrop-blur px-4 py-2 rounded-lg border border-purple-500 text-white font-mono text-sm flex items-center gap-3 shadow-lg">
                        <span className="text-purple-300 font-bold">INVITE LINK:</span>
                        <code className="bg-black/50 px-2 py-1 rounded select-all">{inviteLink}</code>
                        <button
                            onClick={() => navigator.clipboard.writeText(inviteLink)}
                            className="hover:text-white text-purple-300 transition-colors"
                            title="Copy"
                        >
                            📋
                        </button>
                    </div>
                    <div className="text-xs text-purple-300/80 animate-pulse">Waiting for players...</div>
                </div>
            )}

            {/* Scoreboard - Top Left */}
            {(gameMode === GameMode.DEATHMATCH || gameMode === GameMode.HUNGER_GAMES || gameMode === GameMode.GUN_GAME) && playerScores.length > 0 && (
                <div className="absolute top-4 left-4 z-40 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg font-mono text-sm overflow-hidden min-w-[200px]">
                    <div className="px-3 py-2 bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-white/10">
                        <div className="text-white font-bold text-xs uppercase tracking-wider">Scoreboard</div>
                    </div>
                    <div className="px-2 py-1">
                        {playerScores.map((player, index) => (
                            <div
                                key={player.id}
                                className={`flex items-center justify-between gap-4 px-2 py-1.5 rounded transition-all ${player.isPlayer
                                    ? 'bg-blue-500/20 border-l-2 border-blue-400'
                                    : 'hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className={`text-xs ${index === 0 ? 'text-yellow-400' :
                                        index === 1 ? 'text-gray-300' :
                                            index === 2 ? 'text-orange-400' :
                                                'text-gray-500'
                                        }`}>
                                        #{index + 1}
                                    </span>
                                    <span className={`truncate ${player.isPlayer ? 'text-blue-300 font-bold' : 'text-gray-300'
                                        }`}>
                                        {player.name}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className={`font-bold tabular-nums ${player.isPlayer ? 'text-blue-400' : 'text-white'
                                        }`}>
                                        {player.score}
                                    </div>
                                    {gameMode === GameMode.GUN_GAME && (
                                        <div className="text-[10px] text-gray-400">
                                            Lv {((player.gunLevel || 0) + 1)}/{player.gunTotalLevels || GUN_GAME_LADDER.length} · {player.gunProgress || 0}/{GUN_GAME_KILLS_PER_LEVEL}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {gameMode === GameMode.HUNGER_GAMES && isLocalDead && !hungerBetTarget && !hungerWinner && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 bg-black/90 border border-lime-400/70 rounded-lg p-4 w-[360px] text-sm font-mono text-white shadow-xl">
                    <div className="text-lime-200 font-bold mb-2 uppercase tracking-widest text-xs">Place Your Bet (100)</div>
                    <div className="grid grid-cols-2 gap-2">
                        {hungerAlive.map(p => (
                            <button
                                key={p.id}
                                onClick={() => placeHungerBet(p.id)}
                                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded border border-white/10 text-left"
                            >
                                {p.name} <span className="text-gray-400 text-xs">({p.id})</span>
                            </button>
                        ))}
                        {hungerAlive.length === 0 && <div className="text-gray-400 col-span-2">Нет выживших для ставки</div>}
                    </div>
                </div>
            )}

            {gameMode === GameMode.HUNGER_GAMES && hungerEnded && hungerWinner && (
                <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-4 bg-black/70 px-10 py-8 rounded-2xl border border-amber-400/60 shadow-2xl">
                        <div className="text-6xl">🏆</div>
                        <div className="text-2xl font-black text-amber-300 tracking-wide">Winner: {hungerWinner}</div>
                        {hungerRestartCountdown !== null && (
                            <div className="text-sm text-gray-200">Next round in {hungerRestartCountdown}s</div>
                        )}
                        <div className="w-full max-w-md bg-gray-900/60 border border-white/10 rounded-lg p-4 text-sm font-mono text-white">
                            <div className="text-gray-400 text-xs uppercase tracking-widest mb-2">Final Ranking</div>
                            {playerScores.map((player, idx) => (
                                <div key={player.id} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                        <span className={`w-6 text-center ${idx === 0 ? 'text-yellow-300' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-300' : 'text-gray-500'}`}>#{idx + 1}</span>
                                        <span className={`${idx === 0 ? 'font-bold text-white' : 'text-gray-200'}`}>{player.name}</span>
                                    </div>
                                    <div className="text-gray-300">{player.score}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            {gameMode === GameMode.GUN_GAME && gunGameWinner && (
                <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="flex flex-col items-center gap-3 bg-black/80 px-8 py-6 rounded-2xl border border-fuchsia-400/60 shadow-2xl text-fuchsia-100">
                        <div className="text-5xl">🏆</div>
                        <div className="text-xl font-black uppercase tracking-wide">Winner: {gunGameWinner}</div>
                        <div className="text-xs text-gray-300">Gun Game complete</div>
                    </div>
                </div>
            )}

            {/* Player Stats - Bottom Left */}
            <div className="absolute bottom-8 left-8 flex flex-col gap-3 pointer-events-none font-mono text-white text-shadow-md z-40">
                {/* HP Bar with Dynamic Colors */}
                <div className="relative">
                    {/* HP Gain Notification */}
                    {showHpGain && hpGainAmount && (
                        <div className="absolute -top-12 left-0 animate-[float_1.5s_ease-out_forwards] pointer-events-none">
                            <div className="text-2xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">
                                +{hpGainAmount} HP
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        {/* HP Number Display with Dynamic Color */}
                        <div className={`text-5xl font-black italic drop-shadow-lg transition-colors duration-300 ${stats.hp > 66 ? 'text-green-400' :
                            stats.hp > 33 ? 'text-yellow-400' :
                                'text-red-500'
                            } ${showHpGain ? 'animate-pulse' : ''}`}>
                            {stats.hp}
                            <span className="text-sm text-gray-400 not-italic ml-1">HP</span>
                        </div>

                        {/* Armor Display */}
                        {stats.arm > 0 && (
                            <div className="text-3xl font-bold text-cyan-300">
                                {Math.round(stats.arm)}
                                <span className="text-sm text-gray-400 ml-1">ARM</span>
                            </div>
                        )}
                    </div>

                    {/* HP Bar with Dynamic Color Gradient */}
                    <div className="relative w-64 h-4 bg-gray-900/80 rounded-full overflow-hidden border-2 border-gray-700 mt-2">
                        {/* Background glow effect */}
                        <div
                            className={`absolute inset-0 blur-md transition-all duration-300 ${stats.hp > 66 ? 'bg-green-500/30' :
                                stats.hp > 33 ? 'bg-yellow-500/30' :
                                    'bg-red-500/30'
                                } ${showHpGain ? 'animate-pulse' : ''}`}
                            style={{ width: `${stats.hp}%` }}
                        />

                        {/* Actual HP bar */}
                        <div
                            className={`relative h-full transition-all duration-500 ease-out ${stats.hp > 66 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                stats.hp > 33 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                                    'bg-gradient-to-r from-red-600 to-red-500'
                                } ${showHpGain ? 'brightness-150' : ''}`}
                            style={{ width: `${stats.hp}%` }}
                        >
                            {/* Inner shine effect */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-transparent" />

                            {/* Pulse animation on low HP */}
                            {stats.hp < 25 && (
                                <div className="absolute inset-0 animate-pulse bg-red-300/20" />
                            )}
                        </div>

                        {/* Percentage text overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                                {stats.hp}%
                            </span>
                        </div>
                    </div>

                    {/* Armor Bar (if armor exists) */}
                    {stats.arm > 0 && (
                        <div className="relative w-64 h-3 bg-gray-900/80 rounded-full overflow-hidden border border-cyan-700/50 mt-1">
                            <div
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-500"
                                style={{ width: `${stats.arm}%` }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Jetpack Fuel Bar */}
                <div className="flex flex-col gap-1">
                    <div className="w-64 h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div className="h-full bg-gradient-to-r from-orange-500 to-yellow-300 transition-all duration-300" style={{ width: `${stats.fuel}%` }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent" />
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest">Jetpack Fuel</div>
                </div>
            </div>

            {/* Respawn Timer (hide in Hunger Games to allow betting UI) */}
            {stats.dead && gameMode !== GameMode.HUNGER_GAMES && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
                    <div className="text-center">
                        <div className="text-red-500 text-6xl font-black mb-4 animate-pulse">YOU DIED</div>
                        <div className="text-white text-2xl font-mono">Respawn in {(stats.respawn / 1000).toFixed(1)}s</div>
                    </div>
                </div>
            )}

            {/* Kill Feed - Top Right */}
            <div className="absolute top-4 right-4 flex flex-col gap-1 items-end pointer-events-none font-mono text-xs z-40">
                {killFeed.map(k => (
                    <div key={k.id} className="bg-black/60 backdrop-blur px-2 py-1 rounded border border-white/10 flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                        <span style={{ color: k.killerColor }} className="font-bold">{k.killer}</span>
                        <span className="text-gray-400">[{k.weapon}]</span>
                        <span style={{ color: k.victimColor }} className="font-bold">{k.victim}</span>
                    </div>
                ))}
            </div>

            {/* Achievement Button */}
            <div className="absolute top-16 right-4 z-50">
                <button
                    onClick={() => setShowAchievements(!showAchievements)}
                    className="w-10 h-10 bg-purple-600 hover:bg-purple-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg transition-all hover:scale-110"
                    title="Achievements"
                >
                    🏆
                </button>
            </div>

            {/* Achievement Notification */}
            {recentAchievement && (
                <div className="absolute top-28 right-4 z-50 animate-in slide-in-from-right-4 duration-500">
                    <div className="bg-gradient-to-r from-yellow-600 to-orange-600 border-2 border-yellow-400 rounded-lg p-4 shadow-2xl max-w-sm">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl">{recentAchievement.icon}</div>
                            <div>
                                <div className="text-white font-bold text-lg">Achievement Unlocked!</div>
                                <div className="text-yellow-200 font-semibold">{recentAchievement.name}</div>
                                <div className="text-yellow-100 text-sm">{recentAchievement.description}</div>
                                {recentAchievement.reward && (
                                    <div className="text-green-300 text-sm font-bold mt-1">
                                        +{recentAchievement.reward.xp} XP
                                        {recentAchievement.reward.title && ` • ${recentAchievement.reward.title}`}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Achievement Panel */}
            {showAchievements && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
                    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl font-bold text-white">Achievements</h2>
                            <button
                                onClick={() => setShowAchievements(false)}
                                className="text-gray-400 hover:text-white text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {achievementManager.getAchievements().map(achievement => (
                                <div
                                    key={achievement.id}
                                    className={`p-4 rounded-lg border transition-all ${achievement.unlocked
                                        ? 'bg-green-900/50 border-green-500'
                                        : 'bg-gray-800/50 border-gray-600'
                                        }`}
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`text-2xl ${achievement.unlocked ? '' : 'grayscale opacity-50'}`}>
                                            {achievement.icon}
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-bold ${achievement.unlocked ? 'text-white' : 'text-gray-400'}`}>
                                                {achievement.name}
                                            </div>
                                            <div className={`text-sm ${achievement.unlocked ? 'text-gray-300' : 'text-gray-500'}`}>
                                                {achievement.description}
                                            </div>
                                        </div>
                                    </div>

                                    {achievement.unlocked ? (
                                        <div className="text-green-400 text-sm font-bold">
                                            ✓ Unlocked {achievement.reward?.xp ? `(+${achievement.reward.xp} XP)` : ''}
                                        </div>
                                    ) : (
                                        <div className="text-gray-400 text-sm">
                                            Progress: {achievement.progress}/{achievement.maxProgress}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-700">
                            <div className="text-center">
                                <div className="text-gray-400 text-sm">Total XP</div>
                                <div className="text-2xl font-bold text-yellow-400">
                                    {achievementManager.getTotalXP()} XP
                                </div>
                                <div className="text-gray-500 text-xs">
                                    {achievementManager.getCompletionPercentage()}% Complete
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Ammo Display */}
            {
                (() => {
                    const activeWeapon = playerInventory.find(w => w.type === activeWeaponType);
                    if (!activeWeapon) return null;
                    const isInfinite = activeWeapon.maxAmmo > 1000; // Assuming >1000 is infinite/generator

                    return (
                        <div className="absolute bottom-8 right-8 flex flex-col items-end pointer-events-none font-mono text-white text-shadow-md">
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-black italic tracking-tighter text-yellow-400 drop-shadow-lg">
                                    {isInfinite ? '∞' : stats.ammo}
                                </span>
                                {!isInfinite && (
                                    <span className="text-2xl text-gray-500 font-bold">
                                        / {activeWeapon.maxAmmo}
                                    </span>
                                )}
                            </div>
                            <div className="text-sm font-bold tracking-widest text-gray-400 uppercase">
                                {activeWeapon.name}
                            </div>
                        </div>
                    );
                })()
            }

            {/* Weapon Bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 pointer-events-none">
                {playerInventory.map((w, i) => (
                    <div key={i} className={`w-14 h-14 bg-black/70 backdrop-blur-sm border-2 flex items-center justify-center rounded-lg transition-all shadow-lg ${w.type === activeWeaponType ? 'border-yellow-400 scale-110 shadow-yellow-400/50' : 'border-gray-600/50 opacity-60'}`}>
                        <WeaponIcon weaponType={w.type} size={36} />
                        <span className="absolute bottom-0.5 right-1 text-[10px] text-white font-mono bg-black/50 px-1 rounded">{i + 1}</span>
                        {w.type === activeWeaponType && (
                            <div className="absolute inset-0 rounded-lg bg-yellow-400/10 animate-pulse" />
                        )}
                    </div>
                ))}
            </div>

            {/* Mobile Touch Controls */}
            {isMobile && (
                <>
                    {/* Virtual Joystick Indicator */}
                    {touchJoystick?.active && (
                        <div
                            className="absolute w-24 h-24 border-2 border-blue-400/50 rounded-full pointer-events-none"
                            style={{
                                left: touchJoystick.startX - 48,
                                top: touchJoystick.startY - 48,
                                background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)'
                            }}
                        >
                            <div
                                className="absolute w-8 h-8 bg-blue-400/70 rounded-full border border-blue-300"
                                style={{
                                    left: (touchJoystick.currentX - touchJoystick.startX) + 40,
                                    top: (touchJoystick.currentY - touchJoystick.startY) + 40,
                                    transform: 'translate(-50%, -50%)'
                                }}
                            />
                        </div>
                    )}

                    {/* Mobile Action Buttons */}
                    <div className="absolute bottom-24 right-4 flex flex-col gap-3">
                        <button
                            onTouchStart={() => { keys.current['Space'] = true; setTouchButtons(prev => ({ ...prev, jump: true })); }}
                            onTouchEnd={() => { keys.current['Space'] = false; setTouchButtons(prev => ({ ...prev, jump: false })); }}
                            className={`w-16 h-16 rounded-full font-bold text-white transition-all ${touchButtons.jump ? 'bg-blue-600 scale-95' : 'bg-blue-500/80'
                                } border-2 border-blue-400/50 backdrop-blur-sm shadow-lg active:scale-90`}
                        >
                            ↑
                        </button>
                        <button
                            onTouchStart={() => { hookPressed.current = true; setTouchButtons(prev => ({ ...prev, hook: true })); }}
                            onTouchEnd={() => { hookPressed.current = false; setTouchButtons(prev => ({ ...prev, hook: false })); }}
                            className={`w-16 h-16 rounded-full font-bold text-white transition-all ${touchButtons.hook ? 'bg-purple-600 scale-95' : 'bg-purple-500/80'
                                } border-2 border-purple-400/50 backdrop-blur-sm shadow-lg active:scale-90`}
                        >
                            🪝
                        </button>
                    </div>

                    {/* Mobile Instructions */}
                    <div className="absolute top-20 left-4 bg-black/70 backdrop-blur-sm border border-white/10 rounded-lg p-3 text-xs text-gray-300 font-mono max-w-[200px]">
                        <div className="font-bold text-white mb-1">Mobile Controls:</div>
                        <div>• Left side: Move</div>
                        <div>• Right side: Aim & Fire</div>
                        <div>• Buttons: Jump & Hook</div>
                    </div>
                </>
            )}
        </div >
    );
}
