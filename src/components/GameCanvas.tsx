import React, { useRef, useEffect } from 'react';
import { Application, Container, Graphics, Texture, Sprite } from 'pixi.js';
import { GameState, GameMode, Team, WeaponType, ItemType, NetworkMode, MapId, Vector2 } from '../types';
import { WEAPONS_DATA, INFILTRATION_TIMER, GUN_GAME_LADDER, GUN_GAME_KILLS_PER_LEVEL } from '../constants';
import { initAudio } from '../game/systems/audio';
import { generateAssets } from '../game/systems/assets';
import { updatePhysics } from '../game/systems/physics';
import { syncVisuals, getPickupSpriteScale, drawZoneOverlay } from '../game/systems/renderer';
import { drawBotPaths } from '../game/render/botPathOverlay';
import { ParticleView } from '../game/render/effects/particleView';
import { drawMarks } from '../game/render/effects/marksView';
import { destroyApp } from '../game/render/pixiApp';
import { screenToWorld, toView, viewportOf, worldToScreen, Viewport } from '../game/render/viewport';
import { drawAimLine } from '../game/render/aimLine';
import { AIM_STICK_RADIUS, aimDirection, aimPoint, deflection, isFiring, moveKeys, smoothAim } from '../game/input/sticks';
import { attachTouchSticks, TouchSticksState } from '../game/input/touchSticks';
import { attachWheelWeapon } from '../game/input/wheelWeapon';
import { isTouchDevice } from './fullscreen';
import { clampProneAim } from '../game/systems/stance';
import { clearMarks } from '../game/systems/marks';
import { ProjectileView } from '../game/render/projectiles/projectileView';
import { BeamView } from '../game/render/projectiles/beamView';
import { SmokeView } from '../game/render/effects/smokeView';
import { CoverView } from '../game/render/cover/coverView';
import type { CorpseView } from '../game/render/ragdoll/corpseView';
import { createMapLook, MapLook } from '../game/render/scene/mapLook';
import { createAdsController, AdsController } from '../game/ads/adsController';
import { clearBotMemory } from '../game/systems/bot';
import { ffaBotLooks } from '../game/build/botLooks';
import { getPlatforms, getInitialPickups } from '../game/data/level';
import { getCoverLayout } from '../game/cover/coverLayout';
import { liftOutOfCover } from '../game/cover/coverSpawn';
import { useUIStore } from '../store/uiStore';
import { GameHud } from './hud/GameHud';
import { objectiveFor, Objective } from './hud/objective';
import { buildMatchHud, MatchHud } from './hud/matchHud';
import type { FlagBannerEvent } from './hud/flagBannerText';
import { formatClock } from './hud/format';
import { isMatchOver } from '../game/systems/matchRound';
import { ClientSession } from '../game/net/clientSession';
import { parseJoinTarget, inviteLink as makeInviteLink } from '../game/net/serverAddress';
import { HostSession, BROWSER_HOST_MAX_PLAYERS } from '../game/net/hostSession';
import { PeerSocket } from '../game/net/peerSocket';
import { SessionSocket } from '../game/net/sessionSocket';
import { io } from 'socket.io-client';
import { achievementManager } from '../game/systems/achievements';
import { Achievement } from '../game/systems/achievements';
import { useTranslation } from '../i18n/useTranslation';
import { gameEvents } from '../game/systems/events';
import { playSound } from '../game/systems/audio';
import { playCoverSoundEvent } from '../game/systems/coverAudio';
import { MatterPhysicsEngine } from '../game/physics/MatterEngine';
import { applyEffectEvent } from '../game/systems/effects';
import { addShake, explosionShake } from '../game/render/screenShake';
import { spawnPointFor } from '../game/net/roomSetup';
import { currentBuild } from '../game/build/currentBuild';
import { useMatchRewards } from './hud/useMatchRewards';
import { useStatsCollector } from './hud/useStatsCollector';
import { useTournamentMatch } from './hud/useTournamentMatch';
import { openTournamentNet } from './hud/tournamentNet';
import { withTournamentSignals } from './hud/tournamentSessionCallbacks';
import { createHungerZone, isHungerRoundOver, hungerTimeLeft, hungerShieldLeft, HUNGER_ROUND_SIZE } from '../game/systems/hungerRound';
import { FixedStepper, FIXED_STEP_MS } from '../game/systems/fixedStep';
import { newStatsSession } from '../game/stats/playerStats';
import { nextId } from '../game/utils/id';

const NO_MOVE_KEYS = { KeyW: false, KeyS: false, KeyA: false, KeyD: false, Walk: false, KeyZ: false };


// Deathmatch-style modes use the chosen map; objective modes are built for the default map
const effectiveMapFor = (mode: GameMode, selected: MapId) =>
    mode === GameMode.DEATHMATCH || mode === GameMode.HUNGER_GAMES || mode === GameMode.GUN_GAME ? selected : MapId.DEFAULT;

const detectMobile = isTouchDevice;

export default function GameCanvas() {
    const containerRef = useRef<HTMLDivElement>(null);
    const pixiApp = useRef<Application | null>(null);
    // Online match (CLIENT mode only) and the id of the player this browser controls
    const sessionRef = useRef<ClientSession | null>(null);
    const hostRef = useRef<HostSession | null>(null); // this browser hosts the game (HOST mode)
    const localIdRef = useRef('player');
    const [netError, setNetError] = React.useState<string | null>(null);
    const [onlineMode, setOnlineMode] = React.useState<GameMode | null>(null);
    const [inviteLink, setInviteLink] = React.useState<string | null>(null);
    // Match clock, goal and results (score/time-limited modes)
    const [matchHud, setMatchHud] = React.useState<MatchHud | null>(null);
    const matchHudKeyRef = useRef('');
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
        corpses: [],
        lastHTFScore: 0,
        infiltrationEndTime: undefined,
        currentMap: state.selectedMap,
        hungerZone: undefined,
        hungerWinnerId: null
    });
    const reward = useMatchRewards(gameState, localIdRef); // XP for the match that just ended
    useStatsCollector(gameState, localIdRef); // lifetime counters and play time for leaderboards
    const tournamentRun = state.tournamentMatch; // a tournament duel: always online, see useTournamentMatch
    const tourney = useTournamentMatch(gameState, localIdRef, tournamentRun);

    const visualCache = useRef({
        players: new Map(),
        projectileView: null as ProjectileView | null,
        particleView: null as ParticleView | null,
        pickups: new Map(),
        decals: new Map(),
        floatingTexts: new Map(),
        beamView: null as BeamView | null,
        smokeView: null as SmokeView | null,
        coverView: null as CoverView | null,
        corpses: new Map<string, CorpseView>(),
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
    // Twin sticks: the refs drive game input, the state only draws the sticks
    const [touchSticks, setTouchSticks] = React.useState<TouchSticksState>({ move: null, aim: null });
    const aimDirectionRef = useRef<Vector2 | null>(null);
    const aimingRef = useRef(false);
    const [hookDown, setHookDown] = React.useState(false);
    const [hungerBetTarget, setHungerBetTarget] = React.useState<string | null>(null);
    const [hungerWinner, setHungerWinner] = React.useState<string | null>(null);
    const [hungerWinnerId, setHungerWinnerId] = React.useState<string | null>(null);
    const [hungerAlive, setHungerAlive] = React.useState<{ id: string; name: string }[]>([]);
    const [isLocalDead, setIsLocalDead] = React.useState(false);
    const [hungerShrinkCountdown, setHungerShrinkCountdown] = React.useState<number | null>(null);
    const [hungerEnded, setHungerEnded] = React.useState(false);
    const [hungerRestartCountdown, setHungerRestartCountdown] = React.useState<number | null>(null);
    const [hungerTimeLeftSec, setHungerTimeLeftSec] = React.useState<number | null>(null);
    const [hungerTimeUp, setHungerTimeUp] = React.useState(false);
    const [hungerFightIn, setHungerFightIn] = React.useState<number | null>(null);
    // Loop-owned values live in refs: the Pixi ticker closure never sees fresh React state
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

    // Team-mode hint under the score ("Bring the flag to your base")
    const [objective, setObjective] = React.useState<Objective | null>(null);
    const [flagBanner, setFlagBanner] = React.useState<FlagBannerEvent | null>(null);
    const objectiveKeyRef = useRef('');
    const closeAchievements = React.useCallback(() => setShowAchievements(false), []);

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
        gameState.current.betSpectateId = id;
    };

    // Clear per-round Hunger Games UI (new round offline or from the server). Credits carry over.
    const resetHungerUi = () => {
        setHungerBetTarget(null);
        setHungerWinner(null);
        setHungerWinnerId(null);
        setHungerShrinkCountdown(null);
        setHungerEnded(false);
        setHungerRestartCountdown(null);
        setHungerTimeUp(false);
        hungerWinnerShownRef.current = false;
        gameState.current.betSpectateId = null;
    };

    // Same spawn rules as the server room
    const getSpawnPoint = (team: Team) => spawnPointFor(gameMode)(team);

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
        corpses: [],
        lastHTFScore: 0,
        infiltrationEndTime: undefined,
        currentMap: state.selectedMap,
        hungerZone: undefined,
        hungerWinnerId: null,
        gunGameWinnerId: null,
        beams: [],
        smokes: [],
        playerStats: {},
        statsSession: newStatsSession()
    });

    const initLevel = () => {
        const effectiveMap = effectiveMapFor(gameMode, state.selectedMap);
        gameState.current.currentMap = effectiveMap;
        gameState.current.platforms = getPlatforms(gameMode, effectiveMap);
        gameState.current.cover = getCoverLayout(gameMode, effectiveMap);

        physicsEngine.current.clear();
        gameState.current.platforms.forEach(p => physicsEngine.current.addPlatform(p));

        gameState.current.gunGameWinnerId = null;
        if (gameMode === GameMode.HUNGER_GAMES) {
            gameState.current.hungerZone = createHungerZone(Date.now());
            gameState.current.hungerWinnerId = null;
            gameState.current.hungerRoundEndsAt = undefined;
            gameState.current.hungerRoundStartedAt = Date.now();
            gameState.current.hungerEndReason = undefined;
            resetHungerUi();
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
                name: state.playerName, score: 0, build: currentBuild(),
                gunLevel: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                gunProgress: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE
            });

            // Create Bots
            const botCount = gameMode === GameMode.HUNGER_GAMES ? HUNGER_ROUND_SIZE - 1 : (isTeamMode ? 6 : 3);
            // Free-for-all bots each wear their own skin and parts instead of the team colour
            const ffaLooks = isTeamMode ? [] : ffaBotLooks(botCount);
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
                    ...ffaLooks[i],
                    gunLevel: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                    gunProgress: gameMode === GameMode.GUN_GAME ? 0 : undefined,
                    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 }, lastDash: 0, hasFlag: Team.NONE
                });
            }

            gameState.current.players.forEach(p => {
                liftOutOfCover(gameState.current, p); // a random spawn can land inside a crate
                physicsEngine.current.addPlayer(p);
            });
        }

        // Pickups
        gameState.current.pickups = getInitialPickups(state.selectedMode);
        if (state.selectedMode === GameMode.INFILTRATION) {
            gameState.current.infiltrationEndTime = Date.now() + INFILTRATION_TIMER;
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
        let detachTouch: (() => void) | null = null;
        let detachWheel: (() => void) | null = null;
        let onBlur: (() => void) | null = null;
        let onVisibilityChange: (() => void) | null = null;
        // Read once here: the isMobile state is not a dependency of this effect
        const mobile = detectMobile();

        // Online match: the server (or the browser host) owns the simulation, we predict our own player
        let redrawMap: (() => void) | null = null;
        let mapLook: MapLook | null = null;
        let ads: AdsController | null = null;
        const isOnline = state.networkMode !== NetworkMode.OFFLINE || tournamentRun !== null;
        if (isOnline) {
            setNetError(null);
            let socket: SessionSocket;
            let targetLabel: string;
            if (tournamentRun) {
                // The host seat runs the duel's room here; the guest joins the host's published peer id
                const net = openTournamentNet(tournamentRun, {
                    onInviteReady: tourney.signals.inviteReady,
                    onError: message => setNetError(`${t('net.hostError')} (${message})`),
                    onSnapshot: tourney.signals.snapshot,
                    onRejoinReady: tourney.signals.rejoinReady,
                    onRejoinFailed: tourney.signals.disconnected,
                });
                hostRef.current = net.host;
                socket = net.socket;
                targetLabel = t(tournamentRun.role === 'host' ? 'net.yourGame' : 'net.hostedGame');
            } else if (state.networkMode === NetworkMode.HOST) {
                // This browser runs the room; we join it like everyone else, minus the network
                const host = new HostSession(
                    { mode: gameMode, map: effectiveMapFor(gameMode, state.selectedMap), maxPlayers: BROWSER_HOST_MAX_PLAYERS },
                    {
                        onInviteReady: peerId => setInviteLink(makeInviteLink(peerId, window.location)),
                        onError: message => setNetError(`${t('net.hostError')} (${message})`),
                    },
                );
                hostRef.current = host;
                socket = host.localSocket;
                targetLabel = t('net.yourGame');
            } else {
                const target = parseJoinTarget(state.gameId, window.location.hostname);
                socket = target.kind === 'peer' ? new PeerSocket(target.peerId) : io(target.url, { reconnection: false });
                targetLabel = target.kind === 'peer' ? t('net.hostedGame') : target.url;
            }
            console.log('Connecting to:', targetLabel);

            const session = new ClientSession(socket, {
                name: state.playerName,
                color: state.playerColor,
                skinId: state.selectedSkin,
                headColor: state.headColor,
                torsoColor: state.torsoColor,
                armColor: state.armColor,
                legColor: state.legColor,
                jetpackColor: state.jetpackColor,
                build: currentBuild(),
            }, physicsEngine.current, withTournamentSignals({
                onJoined: info => {
                    localIdRef.current = info.id;
                    session.setupWorld(gameState.current, info);
                    setOnlineMode(info.mode);
                    redrawMap?.();
                },
                onRejected: reason => setNetError(
                    reason === 'full' ? t('net.serverFull') : reason === 'invalid' ? t('net.joinInvalid') : t('net.alreadyJoined')
                ),
                onConnectionError: message => setNetError(`${t('net.cannotConnect')} ${targetLabel} (${message})`),
                onDisconnected: () => setNetError(t('net.disconnected')),
                onEvents: events => events.forEach(e => gameEvents.emit(e)),
            }, tournamentRun ? tourney.signals : null));
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
                destroyApp(app);
                return;
            }

            clearBotMemory();

            if (containerRef.current) containerRef.current.appendChild(app.canvas);
            pixiApp.current = app;

            // Layers. viewRoot holds everything drawn from the camera (backdrop, world, post
            // effects) and is scaled so every window shows the same slice of the map; the
            // cursor layer stays in window pixels.
            const viewRoot = new Container();
            app.stage.addChild(viewRoot);
            const viewNow = () => viewportOf(app.screen.width, app.screen.height);
            const worldContainer = new Container();
            viewRoot.addChild(worldContainer);
            const backgroundLayer = new Graphics();
            const decalLayer = new Container();
            const zoneLayer = new Graphics();
            const platformLayer = new Graphics();
            const gameLayer = new Container();
            const botPathLayer = new Graphics(); // F3: bots' routes
            const marksLayer = new Graphics(); // scorch marks, above the platform art and below the fighters
            const uiLayer = new Container();

            worldContainer.addChild(backgroundLayer);
            worldContainer.addChild(decalLayer);
            worldContainer.addChild(zoneLayer);
            worldContainer.addChild(platformLayer);
            worldContainer.addChild(gameLayer);
            worldContainer.addChild(botPathLayer);
            app.stage.addChild(uiLayer);
            const aimLine = new Graphics();
            uiLayer.addChild(aimLine);
            // Touch play: aim from the fighter along the aim stick (gliding after the thumb), and show where the shots go
            let shownAim: Vector2 | null = null;
            const aimFromStick = (view: Viewport, dtMs: number) => {
                const local = gameState.current.players.find(p => p.id === localIdRef.current);
                const wanted = aimDirectionRef.current;
                if (!local || local.dead || !wanted) { drawAimLine(aimLine, null, null); return; }
                shownAim = smoothAim(shownAim, wanted, dtMs);
                const direction = shownAim;
                const camera = gameState.current.camera;
                const center = { x: local.pos.x, y: local.pos.y - local.height / 2 };
                const target = worldToScreen(clampProneAim(local, aimPoint(center, direction)), camera, view);
                mouse.current.x = target.x;
                mouse.current.y = target.y;
                drawAimLine(aimLine, aimingRef.current ? worldToScreen(center, camera, view) : null, aimingRef.current ? target : null);
            };
            // In-world ad places get real TrafficStars banners from ads.json (house posters otherwise)
            const adsLayer = containerRef.current ? createAdsController(containerRef.current, new URL('ads.json', document.baseURI).href) : null;
            ads = adsLayer;
            const look = createMapLook({ stage: viewRoot, world: worldContainer }, worldContainer, { platformLayer, backgroundLayer, cache: visualCache.current }, scene => adsLayer?.attach(scene));
            mapLook = look;
            worldContainer.addChildAt(marksLayer, worldContainer.getChildIndex(gameLayer));

            // Subscribe to game events (kill feed, sounds)
            const unsubEvents = gameEvents.on((event) => {
                if (event.type === 'KILL') {
                    setKillFeed((prev: any) => [...prev.slice(-4), {
                        id: nextId('kf_'), // two kills can land in the same millisecond
                        killer: event.killer,
                        killerColor: event.killerColor,
                        weapon: event.weapon,
                        victim: event.victim,
                        victimColor: event.victimColor
                    }]);
                } else if (event.type === 'SOUND') {
                    if (event.sound === 'cover') playCoverSoundEvent(event.subtype, isMutedRef.current);
                    else playSound(event.sound as any, event.subtype as any, isMutedRef.current);
                } else if (event.type === 'FLAG') {
                    setFlagBanner({ id: nextId('fb_'), kind: event.kind, action: event.action, team: event.team });
                } else {
                    // Blood, explosions, damage numbers… (offline from the simulation, online from the server)
                    applyEffectEvent(gameState.current, event);
                    if (event.type === 'EFFECT' && event.effect === 'explosion') {
                        const me = gameState.current.players.find(p => p.id === localIdRef.current && !p.dead);
                        shakeIntensity.current = addShake(shakeIntensity.current, explosionShake(event, me?.pos, event.size));
                    }
                }
            });

            // Online, the map arrives from the server on join (ClientSession.setupWorld)
            if (!isOnline) initLevel();

            // Offline only: a finished round/match starts over (online the server resets the room)
            const restartRound = () => {
                visualCache.current.players.clear();
                // The layer is emptied below; the renderer builds fresh effect views next frame
                visualCache.current.projectileView?.clear();
                visualCache.current.projectileView = null;
                visualCache.current.particleView?.clear();
                visualCache.current.particleView = null;
                visualCache.current.beamView?.clear();
                visualCache.current.beamView = null;
                visualCache.current.smokeView?.clear();
                visualCache.current.smokeView = null;
                visualCache.current.coverView?.clear();
                visualCache.current.coverView = null;
                visualCache.current.pickups.clear();
                visualCache.current.decals.clear();
                visualCache.current.floatingTexts.clear();
                visualCache.current.corpses.clear(); // their views go with the game layer below
                decalLayer.removeChildren().forEach(c => c.destroy({ children: true, context: true }));
                gameLayer.removeChildren().forEach(c => c.destroy({ children: true, context: true }));
                platformLayer.clear();
                zoneLayer.clear();
                clearMarks();
                marksLayer.clear();

                gameState.current = makeInitialState();
                initLevel();
                const view = viewNow();
                look.redraw(gameState.current, view.w, view.h);
            };

            // Hunger Games HUD from the shared round state (same for offline and online)
            const updateHungerHud = (now: number) => {
                const gs = gameState.current;
                const alive = gs.players.filter(p => !p.dead).map(p => ({ id: p.id, name: p.name }));
                const aliveKey = alive.map(p => p.id).join('|');
                if (aliveKey !== hungerAliveKeyRef.current) {
                    hungerAliveKeyRef.current = aliveKey;
                    setHungerAlive(alive);
                }

                const roundOver = !!gs.hungerRoundEndsAt;
                if (roundOver && !hungerWinnerShownRef.current) {
                    hungerWinnerShownRef.current = true;
                    const found = gs.players.find(pl => pl.id === gs.hungerWinnerId);
                    setHungerWinner(found ? found.name : 'No survivors');
                    setHungerWinnerId(gs.hungerWinnerId ?? null);
                    setHungerTimeUp(gs.hungerEndReason === 'time');
                    setHungerEnded(true);
                } else if (!roundOver && hungerWinnerShownRef.current) {
                    resetHungerUi(); // the server started a new round
                }
                setHungerRestartCountdown(roundOver ? Math.max(0, Math.ceil((gs.hungerRoundEndsAt! - now) / 1000)) : null);
                const timeLeft = hungerTimeLeft(gs, now);
                setHungerTimeLeftSec(timeLeft === null ? null : Math.ceil(timeLeft / 1000));
                const shield = hungerShieldLeft(gs, now);
                setHungerFightIn(shield > 0 ? Math.ceil(shield / 1000) : null);

                const local = gs.players.find(p => p.id === localIdRef.current);
                setIsLocalDead(!!local?.dead);
                const zone = gs.hungerZone;
                setHungerShrinkCountdown(zone?.pendingShrink && zone.nextShrinkAt ? Math.max(0, Math.ceil((zone.nextShrinkAt - now) / 1000)) : null);
            };

            // Start Loop
            app.ticker.add(() => {
                const now = Date.now();
                const liveMode = gameState.current.mode;
                const view = viewNow();
                viewRoot.scale.set(view.zoom);
                if (mobile) aimFromStick(view, app.ticker.deltaMS);
                const offline = !isOnline;
                // Offline a finished Hunger Games round restarts here; online the server does it
                if (offline && ((liveMode === GameMode.HUNGER_GAMES && isHungerRoundOver(gameState.current, now)) || isMatchOver(gameState.current, now))) {
                    restartRound();
                }
                const hungerFinished = offline && liveMode === GameMode.HUNGER_GAMES && !!gameState.current.hungerRoundEndsAt;
                if (hungerFinished) {
                    const champ = gameState.current.players.find(p => p.id === gameState.current.hungerWinnerId);
                    if (champ) {
                        gameState.current.camera.x += (champ.pos.x - gameState.current.camera.x) * 0.1;
                        gameState.current.camera.y += (champ.pos.y - 50 - gameState.current.camera.y) * 0.1;
                    }
                    updateHungerHud(now);
                    // Keep rendering positions but skip input/physics
                    syncVisuals(
                        view,
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
                    drawMarks(marksLayer, now); // keep fading while the winner is shown
                    return;
                }

                // Simulate at a fixed PHYSICS_TICK_RATE regardless of display refresh rate
                const ticksRun = stepper.advance(app.ticker.deltaMS, () => {
                    if (isOnline) {
                        const camera = gameState.current.camera;
                        sessionRef.current?.tick(gameState.current, {
                            keys: { ...keys.current },
                            aim: screenToWorld(mouse.current, camera, view),
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
                            toView(mouse.current, view),
                            hookPressed.current,
                            mousePressed.current,
                            view.w,
                            view.h,
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

                if (liveMode === GameMode.HUNGER_GAMES) updateHungerHud(now);
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

                drawBotPaths(botPathLayer, gameState.current, debugVisibleRef.current);
                drawMarks(marksLayer, now);

                // Zone overlay
                if (liveMode === GameMode.HUNGER_GAMES) {
                    drawZoneOverlay(zoneLayer, gameState.current.hungerZone, now);
                } else {
                    zoneLayer.clear();
                }

                // RENDER UPDATE - Optimized frequency
                const shouldUpdateUI = now - lastStateUpdate.current > 150; // Reduced from 100ms to 150ms
                if (shouldUpdateUI) {
                    const nextObjective = objectiveFor(gameState.current, localIdRef.current, now);
                    const objectiveKey = nextObjective ? `${nextObjective.key}:${nextObjective.team ?? ''}:${Math.ceil((nextObjective.timeMs ?? 0) / 1000)}` : '';
                    if (objectiveKey !== objectiveKeyRef.current) {
                        objectiveKeyRef.current = objectiveKey;
                        setObjective(nextObjective);
                    }
                    const nextMatch = buildMatchHud(gameState.current, now, t);
                    const matchKey = JSON.stringify(nextMatch);
                    if (matchKey !== matchHudKeyRef.current) {
                        matchHudKeyRef.current = matchKey;
                        setMatchHud(nextMatch);
                    }
                    syncVisuals(
                        view,
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
                        view,
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
            redrawMap = () => {
                const view = viewNow();
                look.redraw(gameState.current, view.w, view.h);
            };
            redrawMap();
            // Map look follows the camera after the frame's simulation and rendering
            app.ticker.add(() => {
                const now = Date.now();
                const view = viewNow();
                look.update(gameState.current.camera, now, view.w, view.h);
                adsLayer?.update(gameState.current, now, view.w, view.h, view.zoom);
            });

            // Load assets async
            const textures = await generateAssets();
            // Component may have unmounted while assets were loading — don't attach listeners
            if (!isMounted) return;
            visualCache.current.textures = textures;
            // Redraw the map once textures are ready so tunnel tiles use real sprites
            look.texturesReady(gameState.current);

            // Upgrade already spawned pickups to use the newly loaded textures
            visualCache.current.pickups.forEach((container, id) => {
                const pickup = gameState.current.pickups.find(p => p.id === id);
                if (!pickup) return;
                const texture = textures[pickup.type];
                const hasSprite = container.getChildByLabel('sprite');
                const baseTex = texture;
                let tex: Texture | undefined = baseTex;
                if (pickup.type === ItemType.WEAPON && pickup.subtype) {
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
                if (!isNaN(num) && num >= 1 && num <= 7) selectWeapon(num - 1);
                if (e.code === 'F3') {
                    e.preventDefault();
                    debugVisibleRef.current = !debugVisibleRef.current;
                    if (!debugVisibleRef.current) setDebugStats(null);
                }
                if (e.code === 'Escape') {
                    // Works before joining too (e.g. server unreachable). A tournament duel asks twice (forfeit)
                    if (tournamentRun) tourney.signals.escape();
                    else actions.finishGame(local?.score ?? 0);
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

            // Twin-stick touch controls: the sticks only press the keys / aim / fire a mouse would
            if (mobile) {
                detachTouch = attachTouchSticks(app.canvas, sticks => {
                    setTouchSticks(sticks);
                    Object.assign(keys.current, sticks.move ? moveKeys(deflection(sticks.move)) : NO_MOVE_KEYS);
                    const aim = sticks.aim ? deflection(sticks.aim, AIM_STICK_RADIUS) : null;
                    const direction = aim && aimDirection(aim);
                    if (direction) aimDirectionRef.current = direction; // a centred stick keeps the last aim
                    aimingRef.current = !!aim;
                    mousePressed.current = !!aim && isFiring(aim);
                });
            }

            // Mouse wheel cycles through the weapon slots (down = next)
            detachWheel = attachWheelWeapon(window, {
                getLoadout: () => {
                    const local = gameState.current.players.find(p => p.id === localIdRef.current);
                    if (!local) return null;
                    return { slots: local.inventory, current: local.inventory.findIndex(w => w.type === local.weapon?.type) };
                },
                select: index => selectWeapon(index),
            });

            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mousedown', onMouseDown);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('contextmenu', onContextMenu);
            window.addEventListener('blur', onBlur);
            document.addEventListener('visibilitychange', onVisibilityChange);
        };

        setup();

        return () => {
            isMounted = false;
            gameEvents.clear();
            mapLook?.destroy(); // frees the baked map textures before the app goes away
            ads?.destroy();
            if (onKeyDown) window.removeEventListener('keydown', onKeyDown);
            if (onKeyUp) window.removeEventListener('keyup', onKeyUp);
            if (onMouseMove) window.removeEventListener('mousemove', onMouseMove);
            if (onMouseDown) window.removeEventListener('mousedown', onMouseDown);
            if (onMouseUp) window.removeEventListener('mouseup', onMouseUp);
            if (onContextMenu) window.removeEventListener('contextmenu', onContextMenu);
            if (onBlur) window.removeEventListener('blur', onBlur);
            if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);

            detachTouch?.();
            detachWheel?.();

            // Keep textures: they are shared via the generateAssets() cache and reused next game
            if (pixiApp.current) destroyApp(pixiApp.current);
            gameState.current = makeInitialState();
            clearMarks();
            // Clear visual cache to prevent reusing dead sprites
            visualCache.current.players.clear();
            visualCache.current.projectileView?.clear();
            visualCache.current.projectileView = null;
            visualCache.current.particleView?.clear();
            visualCache.current.particleView = null;
            visualCache.current.beamView?.clear();
            visualCache.current.beamView = null;
            visualCache.current.smokeView?.clear();
            visualCache.current.smokeView = null;
            visualCache.current.coverView?.clear();
            visualCache.current.coverView = null;
            visualCache.current.pickups.clear();
            visualCache.current.decals.clear();
            sessionRef.current?.dispose();
            sessionRef.current = null;
            hostRef.current?.dispose();
            hostRef.current = null;
            setInviteLink(null);
            localIdRef.current = 'player';
            visualCache.current.floatingTexts.clear();
            visualCache.current.corpses.clear(); // destroyed with the app's stage
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

    const objectiveText = objective
        ? t(objective.key, objective.team ? t(objective.team === Team.RED ? 'obj.red' : 'obj.blue')
            : objective.timeMs !== undefined ? formatClock(Math.ceil(objective.timeMs / 1000)) : undefined)
        : null;
    /** Keys 1–7, the mouse wheel and the touch weapon row: switch locally at once, and tell the host when online. */
    const selectWeapon = (index: number) => {
        const local = gameState.current.players.find(p => p.id === localIdRef.current);
        const weapon = local?.inventory[index];
        if (local && weapon) local.weapon = weapon;
        sessionRef.current?.selectWeapon(index);
    };
    const leaveGame = () => actions.finishGame(gameState.current.players.find(p => p.id === localIdRef.current)?.score ?? 0);

    return (
        <div ref={containerRef} className="relative h-full w-full bg-black">
            <GameHud
                t={t}
                mode={gameMode}
                stats={stats}
                scores={scores}
                inventory={playerInventory}
                activeWeapon={activeWeaponType}
                killFeed={killFeed}
                playerScores={playerScores}
                muted={state.isMuted}
                onToggleMute={actions.toggleMute}
                objective={objectiveText}
                flagBanner={flagBanner}
                match={matchHud}
                onLeave={leaveGame}
                connection={{ visible: ((state.networkMode !== NetworkMode.OFFLINE || !!tournamentRun) && !onlineMode) || !!(netError ?? tourney.error) || tourney.reconnecting, error: netError ?? tourney.error }}
                debug={debugStats}
                inviteLink={inviteLink}
                recentAchievement={recentAchievement}
                achievementsOpen={showAchievements}
                onAchievementsOpen={() => setShowAchievements(true)}
                onAchievementsClose={closeAchievements}
                hunger={gameMode === GameMode.HUNGER_GAMES ? {
                    credits: hungerCredits.current,
                    betTarget: hungerAlive.find(p => p.id === hungerBetTarget)?.name ?? hungerBetTarget,
                    winner: hungerWinner,
                    ended: hungerEnded,
                    timeUp: hungerTimeUp,
                    timeLeftSec: hungerTimeLeftSec,
                    shrinkSec: hungerShrinkCountdown,
                    restartSec: hungerRestartCountdown,
                    fightInSec: hungerFightIn,
                    winnerId: hungerWinnerId,
                    localDead: isLocalDead,
                    alive: hungerAlive,
                    onBet: placeHungerBet,
                } : null}
                gunGame={gameMode === GameMode.GUN_GAME ? {
                    status: gunGameStatus && { ...gunGameStatus, perLevel: GUN_GAME_KILLS_PER_LEVEL },
                    winner: gunGameWinner,
                } : null}
                reward={reward}
                tournament={tournamentRun ? { backInSec: tourney.backInSec, forfeitArmed: tourney.forfeitArmed, reconnecting: tourney.reconnecting } : null}
                mobile={isMobile ? {
                    sticks: touchSticks,
                    hookDown,
                    onHook: down => { hookPressed.current = down; setHookDown(down); },
                    onSelectWeapon: selectWeapon,
                } : null}
            />
        </div>
    );
}
