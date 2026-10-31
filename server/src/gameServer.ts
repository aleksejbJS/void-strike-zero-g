// Socket.io transport around the shared RoomHost

import { Server, Socket } from 'socket.io';
import { GameRoom } from '../../src/game/net/room.js';
import { RoomHost, runRoomLoop } from '../../src/game/net/roomHost.js';

export const startGameServer = (io: Server, room: GameRoom): (() => void) => {
  const host = new RoomHost(room);
  const stopLoop = runRoomLoop(host);

  io.on('connection', (socket: Socket) => {
    console.log('Player connected:', socket.id);
    host.connect({ id: socket.id, send: (event, data) => socket.emit(event, data) });
    socket.onAny((event: string, data: unknown) => host.message(socket.id, event, data));
    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      host.disconnect(socket.id);
    });
  });

  return stopLoop;
};
