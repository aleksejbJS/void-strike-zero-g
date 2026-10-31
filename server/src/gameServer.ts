// Socket.io transport around the authoritative GameRoom

import { performance } from 'node:perf_hooks';
import { Server, Socket } from 'socket.io';
import { GameRoom } from '../../src/game/net/room.js';
import { FixedStepper } from '../../src/game/systems/fixedStep.js';
import { validateJoin, validateInput } from '../../src/game/net/validation.js';
import { MSG, SNAPSHOT_RATE, JoinAccepted, JoinRejected } from '../../src/game/net/protocol.js';

// Timer granularity for the loop; the FixedStepper turns real elapsed time into exact ticks
const LOOP_INTERVAL_MS = 4;
const SNAPSHOT_INTERVAL_MS = 1000 / SNAPSHOT_RATE;

export const startGameServer = (io: Server, room: GameRoom): (() => void) => {
  const stepper = new FixedStepper();
  let lastLoop = performance.now();
  let lastSnapshot = 0;

  const loop = setInterval(() => {
    const now = performance.now();
    stepper.advance(now - lastLoop, () => room.tick());
    lastLoop = now;

    if (now - lastSnapshot < SNAPSHOT_INTERVAL_MS) return;
    lastSnapshot = now;
    const events = room.drainEvents();
    if (events.length) io.emit(MSG.EVENTS, events);
    io.emit(MSG.SNAPSHOT, room.snapshot(Date.now()));
  }, LOOP_INTERVAL_MS);

  io.on('connection', (socket: Socket) => {
    console.log('Player connected:', socket.id);
    let joined = false;

    socket.on(MSG.JOIN, (raw: unknown) => {
      const reject = (reason: JoinRejected['reason']) => socket.emit(MSG.JOIN_REJECTED, { reason } satisfies JoinRejected);

      if (joined) return reject('already_joined');
      const req = validateJoin(raw);
      if (!req) return reject('invalid');

      const result = room.join(socket.id, req);
      if (!result.ok) return reject(result.reason);

      joined = true;
      const accepted: JoinAccepted = {
        id: socket.id,
        mode: room.state.mode,
        map: room.state.currentMap,
        platforms: room.state.platforms,
        snapshot: room.snapshot(Date.now()),
      };
      socket.emit(MSG.JOINED, accepted);
      console.log(`Player ${req.name} joined as ${socket.id}`);
    });

    socket.on(MSG.INPUT, (raw: unknown) => {
      if (!joined) return;
      const input = validateInput(raw, Date.now());
      if (input) room.pushInput(socket.id, input);
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      if (joined) room.leave(socket.id);
    });
  });

  return () => clearInterval(loop);
};
