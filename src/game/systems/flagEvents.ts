// Announces objective changes (flag grabbed, lost, returned, captured) for the HUD banner.
// Called by the simulation; online the event reaches every client with the other events.

import { Team } from '../../types';
import { gameEvents, FlagAction, FlagKind } from './events';

export const emitFlag = (kind: FlagKind, action: FlagAction, team: Team = Team.NONE) =>
    gameEvents.emit({ type: 'FLAG', kind, action, team });
