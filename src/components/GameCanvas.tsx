import React, { useRef, useEffect } from 'react';
import { Application, Container, Graphics, Texture, Sprite, Text } from 'pixi.js';
import { GameState, PlayerInput, GameMode, Team, WeaponType, ItemType, Pickup, NetworkMode, MapId } from '../types';
import { WEAPONS_DATA, INFILTRATION_TIMER, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../constants';
import { initAudio } from '../game/systems/audio';
import { generateAssets } from '../game/systems/assets';
import { updatePhysics } from '../game/systems/physics';
import { drawStaticMap, drawBackground, syncVisuals, getPickupSpriteScale, drawZoneOverlay } from '../game/systems/renderer';
import { clearBotMemory } from '../game/systems/bot';
import { getPlatforms, getInitialPickups } from '../game/data/level';
import { useUIStore } from '../store/uiStore';
import { WeaponIcon } from './WeaponIcon';
import { SocketManager } from '../game/systems/socket';
import { achievementManager } from '../game/systems/achievements';
import { Achievement } from '../game/systems/achievements';
import { useTranslation } from '../i18n/useTranslation';
import { gameEvents } from '../game/systems/events';
import { playSound } from '../game/systems/audio';
import { MatterPhysicsEngine } from '../game/physics/MatterEngine';

export default function GameCanvas() {
    const containerRef = useRef<HTMLDivElement>(null);
    const pixiApp = useRef<Application | null>(null);
    const socketManager = useRef<SocketManager | null>(null);
    const [inviteLink, setInviteLink] = React.useState<string | null>(null);
    const [infiltrationTimeLeft, setInfiltrationTimeLeft] = React.useState<number | null>(null);
    const [gunGameStatus, setGunGameStatus] = React.useState<{ weapon: string; level: number; progress: number; total: number } | null>(null);
    const [gunGameWinner, setGunGameWinner] = React.useState<string | null>(null);
    const shakeIntensity = useRef(0);
    const lastStateUpdate = useRef(0);
    const gameReady = useRef(false); // Track if game is ready to start (for multiplayer)
    const gunGameEndedRef = useRef(false);
    const { state, actions } = useUIStore();
    const { t } = useTranslation();
    const physicsEngine = useRef(new MatterPhysicsEngine());

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
    const inputSequence = useRef(0);
    const pendingInputs = useRef<{ sequence: number; input: PlayerInput }[]>([]);
    const isMutedRef = useRef(state.isMuted);
    const gameMode = state.selectedMode;
    const hungerCredits = useRef(100);

    // Mobile touch controls
    const [isMobile, setIsMobile] = React.useState(false);
    const [touchJoystick, setTouchJoystick] = React.useState<{ active: boolean; startX: number; startY: number; currentX: number; currentY: number } | null>(null);
    const [touchButtons, setTouchButtons] = React.useState<{ jump: boolean; hook: boolean; fire: boolean }>({ jump: false, hook: false, fire: false });
    const [hungerBetTarget, setHungerBetTarget] = React.useState<string | null>(null);
    const [hungerWinner, setHungerWinner] = React.useState<string | null>(null);
    const [hungerWinnerId, setHungerWinnerId] = React.useState<string | null>(null);
    const [hungerAlive, setHungerAlive] = React.useState<{ id: string; name: string }[]>([]);
    const [isLocalDead, setIsLocalDead] = React.useState(false);
    const [hungerShrinkCountdown, setHungerShrinkCountdown] = React.useState<number | null>(null);
    const [hungerEnded, setHungerEnded] = React.useState(false);
    const [hungerRestartAt, setHungerRestartAt] = React.useState<number | null>(null);
    const [hungerRestartCountdown, setHungerRestartCountdown] = React.useState<number | null>(null);

    // Achievement system
    const [recentAchievement, setRecentAchievement] = React.useState<Achievement | null>(null);
    const [showAchievements, setShowAchievements] = React.useState(false);

    // HP Animation State
    const previousHP = useRef(100);
    const [hpGainAmount, setHpGainAmount] = React.useState<number | null>(null);
    const [showHpGain, setShowHpGain] = React.useState(false);

    // Achievement listener
    React.useEffect(() => {
        const handleAchievementUnlock = (achievement: Achievement) => {
            setRecentAchievement(achievement);
            // Hide after 5 seconds
            setTimeout(() => setRecentAchievement(null), 5000);
        };

        achievementManager.onAchievementUnlocked(handleAchievementUnlock);
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
            setHungerRestartAt(null);
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
        const checkMobile = () => {
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
            setIsMobile(isMobileDevice);
        };
        checkMobile();
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

        // Socket Setup
        const socket = new SocketManager();
        socketManager.current = socket;

        if (state.networkMode === NetworkMode.CLIENT) {
            // Use hostname to allow LAN connections (e.g. if accessing via 192.168.x.x)
            const serverUrl = `http://${window.location.hostname}:3001`;
            console.log('Connecting to server:', serverUrl);
            socket.connect(serverUrl, {
                name: state.playerName,
                color: state.playerColor,
                skinId: state.selectedSkin,
                headColor: state.headColor,
                torsoColor: state.torsoColor,
                armColor: state.armColor,
                legColor: state.legColor,
                jetpackColor: state.jetpackColor,
                mapId: state.selectedMap
            });

            socket.onInit = (data) => {
                console.log('Init from server:', data);
                // We could set our ID here if needed
                gameReady.current = true;
            };

            socketManager.current.onStateUpdate = (serverState: GameState) => {
                // Reconciliation
                const localId = socketManager.current.socket?.id;
                if (localId) {
                    const serverPlayer = serverState.players.find(p => p.id === localId);
                    if (serverPlayer) {
                        const lastProcessed = serverPlayer.lastProcessedInput;
                        // Remove processed inputs
                        pendingInputs.current = pendingInputs.current.filter(i => i.sequence > lastProcessed);

                        // Apply server state as base
                        gameState.current = serverState;

                        // Sync Local MatterEngine
                        serverState.players.forEach(p => {
                            if (!physicsEngine.current.bodies.has(p.id)) {
                                physicsEngine.current.addPlayer(p);
                            } else {
                                physicsEngine.current.setPosition(p.id, p.pos);
                                physicsEngine.current.setVelocity(p.id, p.vel);
                            }
                        });

                        // Re-apply pending inputs
                        pendingInputs.current.forEach(pi => {
                            // We need to be careful not to double-play sounds or particles here
                            // Ideally updatePhysics should have a 'prediction' flag
                            // For now, we just run it.
                            // Note: updatePhysics expects screen coords for mouse for local player, 
                            // but stored input has world coords.
                            // We need to convert back or update updatePhysics to handle this.
                            // Actually, updatePhysics logic for local player:
                            // worldMouseX = (mouse.x - cx) + state.camera.x;
                            // So if we pass world coords as 'mouse', it will double add camera.

                            // FIX: We should pass a flag or handle this.
                            // Let's cheat: We know pi.input.mouse is WORLD.
                            // We can pass a dummy mouse object where x = worldX - cameraX + cx
                            // But cameraX changes.

                            // Better: Modify updatePhysics to accept 'isPrediction' or 'useWorldMouse'.
                            // Or just pass the input as 'remoteInputs' even for local player?
                            // If we pass it as remoteInputs, updatePhysics will treat it as remote and use world coords directly!
                            // But we need to pass localPlayerId so it knows it's us.
                            // Wait, if isLocal is true, it ignores remoteInputs.

                            // Let's just reconstruct screen mouse for now.
                            const cx = window.innerWidth / 2; // Approximate
                            const cy = window.innerHeight / 2;
                            const screenMouse = {
                                x: pi.input.mouse.x - gameState.current.camera.x + cx,
                                y: pi.input.mouse.y - gameState.current.camera.y + cy
                            };

                            // To actually predict with MatterEngine:
                            const runForce = 0.005;
                            const force = { x: 0, y: 0 };
                            if (pi.input.keys['KeyA']) force.x = -runForce;
                            if (pi.input.keys['KeyD']) force.x = runForce;
                            const pBody = physicsEngine.current.bodies.get(localId);
                            // Very simple jump prediction for now
                            if (pi.input.keys['KeyW'] && pBody && Math.abs(pBody.velocity.y) < 0.1) force.y = -0.1;

                            physicsEngine.current.applyForce(localId, force);
                            physicsEngine.current.step(16); // simulate 1 tick (assuming 60fps)

                            updatePhysics(
                                gameState.current,
                                pi.input.keys,
                                screenMouse,
                                pi.input.hookPressed,
                                pi.input.mousePressed,
                                window.innerWidth,
                                window.innerHeight,
                                getSpawnPoint,
                                localId
                            );
                        });

                        // After prediction re-simulation, update our rendering state
                        physicsEngine.current.syncGameState(gameState.current);
                    } else {
                        gameState.current = serverState;
                        serverState.players.forEach(p => {
                            if (!physicsEngine.current.bodies.has(p.id)) {
                                physicsEngine.current.addPlayer(p);
                            } else {
                                physicsEngine.current.setPosition(p.id, p.pos);
                                physicsEngine.current.setVelocity(p.id, p.vel);
                            }
                        });
                    }
                } else {
                    gameState.current = serverState;
                    serverState.players.forEach(p => {
                        if (!physicsEngine.current.bodies.has(p.id)) {
                            physicsEngine.current.addPlayer(p);
                        } else {
                            physicsEngine.current.setPosition(p.id, p.pos);
                            physicsEngine.current.setVelocity(p.id, p.vel);
                        }
                    });
                }
            };

        } else {
            gameReady.current = true; // Offline mode is always ready
        }

        let isMounted = true;

        const setup = async () => {
            await app.init({ resizeTo: window, backgroundColor: 0x020617, antialias: true, autoDensity: true });

            if (!isMounted) {
                app.destroy(true, { children: true, texture: true });
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
                }
            });

            initLevel();

            // Start Loop
            app.ticker.add(() => {
                const now = Date.now();
                const hungerFinished = gameMode === GameMode.HUNGER_GAMES && !!gameState.current.hungerWinnerId;
                if (hungerFinished) {
                    const champ = gameState.current.players.find(p => p.id === gameState.current.hungerWinnerId);
                    if (champ) {
                        gameState.current.camera.x += (champ.pos.x - gameState.current.camera.x) * 0.1;
                        gameState.current.camera.y += (champ.pos.y - 50 - gameState.current.camera.y) * 0.1;
                    }
                    if (hungerRestartAt) {
                        const remaining = Math.max(0, Math.ceil((hungerRestartAt - now) / 1000));
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
                            decalLayer.removeChildren();
                            gameLayer.removeChildren();
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
                            setHungerRestartAt(null);
                            setHungerRestartCountdown(null);
                        }
                    } else {
                        // ensure countdown starts
                        setHungerRestartAt(Date.now() + 10000);
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
                        null
                    );
                    drawZoneOverlay(zoneLayer, gameState.current.hungerZone);
                    return;
                }

                if (state.networkMode === NetworkMode.CLIENT) {
                    // Send Input
                    const cx = app.screen.width / 2;
                    const cy = app.screen.height / 2;
                    const worldMouse = {
                        x: (mouse.current.x - cx) + gameState.current.camera.x,
                        y: (mouse.current.y - cy) + gameState.current.camera.y
                    };

                    inputSequence.current++;
                    const input: PlayerInput = {
                        keys: { ...keys.current }, // Copy keys to avoid reference issues
                        mouse: worldMouse,
                        mousePressed: mousePressed.current,
                        hookPressed: hookPressed.current,
                        timestamp: Date.now(),
                        sequence: inputSequence.current
                    };
                    socket.sendInput(input);

                    // Client-Side Prediction
                    const localId = socketManager.current.socket?.id || '';
                    if (localId) {
                        const runForce = 0.005;
                        const force = { x: 0, y: 0 };
                        if (keys.current['KeyA']) force.x = -runForce;
                        if (keys.current['KeyD']) force.x = runForce;

                        const localPlayer = gameState.current.players.find(p => p.id === localId);
                        if (localPlayer) {
                            if (keys.current['KeyW'] && localPlayer.isGrounded) force.y = -0.1;
                            physicsEngine.current.applyForce(localId, force);
                        }

                        physicsEngine.current.step(app.ticker.deltaMS);
                        physicsEngine.current.syncGameState(gameState.current);

                        updatePhysics(
                            gameState.current,
                            keys.current,
                            mouse.current, // updatePhysics handles screen-to-world conversion for local player
                            hookPressed.current,
                            mousePressed.current,
                            app.screen.width,
                            app.screen.height,
                            getSpawnPoint,
                            localId
                        );

                        // Sync velocity/position changes from updatePhysics back to Matter
                        physicsEngine.current.syncFromGameState(gameState.current);

                        // Store input for reconciliation
                        pendingInputs.current.push({ sequence: inputSequence.current, input });
                    }

                } else {
                    // OFFLINE MODE

                    // Apply movement forces for the local player
                    const runForce = 0.005;
                    const force = { x: 0, y: 0 };
                    if (keys.current['KeyA']) force.x = -runForce;
                    if (keys.current['KeyD']) force.x = runForce;

                    const localPlayer = gameState.current.players.find(p => p.id === 'player');
                    if (localPlayer) {
                        if ((keys.current['KeyW'] || keys.current['Space']) && localPlayer.isGrounded) force.y = -0.1;
                        physicsEngine.current.applyForce('player', force);
                    }

                    physicsEngine.current.step(app.ticker.deltaMS);

                    // Prevent crazy speeds
                    gameState.current.players.forEach(player => {
                        const body = physicsEngine.current.bodies.get(player.id);
                        if (body) {
                            if (body.velocity.x > 15) physicsEngine.current.setVelocity(player.id, { x: 15, y: body.velocity.y });
                            if (body.velocity.x < -15) physicsEngine.current.setVelocity(player.id, { x: -15, y: body.velocity.y });
                        }
                    });

                    physicsEngine.current.syncGameState(gameState.current);

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

                    // Sync velocity/position changes from updatePhysics (jetpack, grapple, bots) back to Matter
                    physicsEngine.current.syncFromGameState(gameState.current);
                }

                if (gameMode === GameMode.HUNGER_GAMES) {
                    const alive = gameState.current.players.filter(p => !p.dead).map(p => ({ id: p.id, name: p.name }));
                    setHungerAlive(alive);
                    if (gameState.current.hungerWinnerId && !hungerWinner) {
                        const found = gameState.current.players.find(pl => pl.id === gameState.current.hungerWinnerId);
                        setHungerWinner(found ? found.name : gameState.current.hungerWinnerId);
                        setHungerWinnerId(gameState.current.hungerWinnerId);
                        setHungerEnded(true);
                        if (!hungerRestartAt) setHungerRestartAt(Date.now() + 10000);
                    }
                    const local = gameState.current.players.find(p => p.id === 'player') || gameState.current.players[0];
                    setIsLocalDead(!!local?.dead);
                    if (gameState.current.hungerZone?.pendingShrink && gameState.current.hungerZone.nextShrinkAt) {
                        const eta = Math.max(0, Math.ceil((gameState.current.hungerZone.nextShrinkAt - now) / 1000));
                        setHungerShrinkCountdown(eta);
                    } else {
                        setHungerShrinkCountdown(null);
                    }
                }
                if (gameMode === GameMode.GUN_GAME) {
                    const local = gameState.current.players.find(p => p.id === 'player') || gameState.current.players[0];
                    if (local) {
                        setGunGameStatus({
                            weapon: local.weapon.name,
                            level: (local.gunLevel || 0) + 1,
                            progress: local.gunProgress || 0,
                            total: GUN_GAME_LADDER.length
                        });
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
                if (gameMode === GameMode.HUNGER_GAMES) {
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
                        actions.setPlayerScores
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
                        null
                    );
                }
            });

            // Draw static elements
            // Draw map
            drawStaticMap(platformLayer, gameState.current.platforms, gameState.current.currentMap, visualCache.current);
            drawBackground(backgroundLayer, app.screen.width, app.screen.height);

            // Load assets async
            const textures = await generateAssets();
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
                if (!gameState.current.players.length) return;
                const num = parseInt(e.key);
                if (!isNaN(num) && num >= 1 && num <= 6) {
                    const local = gameState.current.players.find(p => p.id === 'player') || gameState.current.players[0];
                    const w = local?.inventory[num - 1];
                    if (w && local) local.weapon = w;
                }
                if (e.code === 'Escape') {
                    const local = gameState.current.players.find(p => p.id === 'player') || gameState.current.players[0];
                    if (local) actions.finishGame(local.score);
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
                initAudio();
                if (e.button === 0) mousePressed.current = true;
                if (e.button === 2) hookPressed.current = true;
            };
            onMouseUp = (e: MouseEvent) => { if (e.button === 0) mousePressed.current = false; if (e.button === 2) hookPressed.current = false; };
            onContextMenu = (e: Event) => e.preventDefault();

            // Mobile touch controls
            // Mobile touch controls

            if (isMobile) {
                onTouchStart = (e: TouchEvent) => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const rect = app.canvas.getBoundingClientRect();

                    if (touch.clientX < rect.width / 2) {
                        // Left side - movement joystick
                        setTouchJoystick({
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
                };

                onTouchMove = (e: TouchEvent) => {
                    e.preventDefault();
                    if (touchJoystick?.active) {
                        const touch = Array.from(e.touches).find(t => {
                            const rect = app.canvas.getBoundingClientRect();
                            return t.clientX < rect.width / 2;
                        });

                        if (touch && touchJoystick) {
                            const deltaX = touch.clientX - touchJoystick.startX;
                            const deltaY = touch.clientY - touchJoystick.startY;
                            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                            const maxDistance = 50;

                            const clampedX = Math.max(-maxDistance, Math.min(maxDistance, deltaX));
                            const clampedY = Math.max(-maxDistance, Math.min(maxDistance, deltaY));

                            setTouchJoystick(prev => prev ? { ...prev, currentX: touch.clientX, currentY: touch.clientY } : null);

                            // Update movement keys based on joystick
                            keys.current['KeyW'] = clampedY < -20;
                            keys.current['KeyS'] = clampedY > 20;
                            keys.current['KeyA'] = clampedX < -20;
                            keys.current['KeyD'] = clampedX > 20;
                        }
                    }

                    // Handle aiming on right side
                    const rightTouch = Array.from(e.touches).find(t => {
                        const rect = app.canvas.getBoundingClientRect();
                        return t.clientX >= rect.width / 2;
                    });

                    if (rightTouch) {
                        const rect = app.canvas.getBoundingClientRect();
                        mouse.current.x = rightTouch.clientX - rect.left;
                        mouse.current.y = rightTouch.clientY - rect.top;
                    }
                };

                onTouchEnd = (e: TouchEvent) => {
                    e.preventDefault();
                    if (touchJoystick?.active && e.touches.length === 0) {
                        setTouchJoystick(null);
                        keys.current['KeyW'] = false;
                        keys.current['KeyS'] = false;
                        keys.current['KeyA'] = false;
                        keys.current['KeyD'] = false;
                    }

                    const hasRightTouch = Array.from(e.touches).some(t => {
                        const rect = app.canvas.getBoundingClientRect();
                        return t.clientX >= rect.width / 2;
                    });

                    if (!hasRightTouch) {
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

            // Mobile touch listeners
            if (isMobile && onTouchStart && onTouchMove && onTouchEnd) {
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

            // Mobile touch cleanup
            if (isMobile && pixiApp.current) {
                const canvas = pixiApp.current.canvas;
                if (onTouchStart) canvas.removeEventListener('touchstart', onTouchStart);
                if (onTouchMove) canvas.removeEventListener('touchmove', onTouchMove);
                if (onTouchEnd) canvas.removeEventListener('touchend', onTouchEnd);
            }

            if (pixiApp.current) pixiApp.current.destroy(true, { children: true, texture: true });
            gameState.current = makeInitialState();
            // Clear visual cache to prevent reusing dead sprites
            visualCache.current.players.clear();
            visualCache.current.projectiles.clear();
            visualCache.current.particles.clear();
            visualCache.current.pickups.clear();
            visualCache.current.decals.clear();
            if (socketManager.current) {
                socketManager.current.disconnect();
            }
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
