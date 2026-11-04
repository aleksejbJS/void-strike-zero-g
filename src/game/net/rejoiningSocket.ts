// A socket that can drop its link and dial the same host again under the same handlers, so ClientSession
// stays attached while a tournament guest gets back into its duel: the new link's 'connect' makes the
// session send JOIN again, and its JOINED sets the session up like the first time.
// While a new link is being dialled, its failures ('disconnect', 'connect_error', JOIN_REJECTED) go to
// onAttemptFailed instead of the session (the duel retries; see guestRejoin.ts).

import { MSG } from './protocol';
import type { SessionSocket } from './sessionSocket';

type Handler = (data: any) => void;

const ATTEMPT_FAILURES: ReadonlySet<string> = new Set(['disconnect', 'connect_error', MSG.JOIN_REJECTED]);

export class RejoiningSocket implements SessionSocket {
    private readonly handlers: [string, Handler][] = [];
    private link: SessionSocket;
    private dialling = false;

    constructor(private readonly open: () => SessionSocket, private readonly onAttemptFailed: () => void) {
        this.link = this.watch(open());
    }

    emit(event: string, data?: unknown) {
        this.link.emit(event, data);
    }

    on(event: string, handler: Handler) {
        this.handlers.push([event, handler]);
        this.forward(this.link, event, handler);
    }

    removeAllListeners() {
        this.handlers.length = 0;
        this.link.removeAllListeners();
    }

    disconnect() {
        this.link.disconnect();
    }

    /** Closes the current link (silently) and dials the host again. */
    rejoin() {
        const old = this.link;
        old.removeAllListeners();
        old.disconnect();
        this.dialling = true;
        this.link = this.watch(this.open());
        for (const [event, handler] of this.handlers) this.forward(this.link, event, handler);
    }

    /** Our own listeners go first: JOINED ends the dialling before the session hears about it. */
    private watch(link: SessionSocket): SessionSocket {
        link.on(MSG.JOINED, () => { this.dialling = false; });
        for (const event of ATTEMPT_FAILURES) {
            link.on(event, () => { if (this.dialling) this.onAttemptFailed(); });
        }
        return link;
    }

    private forward(link: SessionSocket, event: string, handler: Handler) {
        const failure = ATTEMPT_FAILURES.has(event);
        link.on(event, data => { if (!(failure && this.dialling)) handler(data); });
    }
}
