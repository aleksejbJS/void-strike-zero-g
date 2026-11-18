// Client-only settings of the offline test range (#range): what the keys change and what the
// range loop reads. Never sent over a network and never part of a saved match.

export type DummyStance = 'stand' | 'crouch' | 'prone';

export interface RangeState {
    stance: DummyStance;
    armored: boolean;          // the dummy wears full armor (K)
    showHitZones: boolean;     // outlines of the hit zones are drawn (H)
    resetRequested: boolean;   // R was pressed: the range loop resets the dummy and clears the readout
    diedAt: Record<string, number>; // dummy id -> timestamp of its death, for the delayed return
}

/** How long a dead dummy lies before it stands up again. */
export const DUMMY_RETURN_MS = 3000;

const STANCE_CYCLE: readonly DummyStance[] = ['stand', 'crouch', 'prone'];

export const createRangeState = (): RangeState => ({
    stance: 'stand',
    armored: false,
    showHitZones: false,
    resetRequested: false,
    diedAt: {},
});

/** The stance after `stance` when C is pressed: stand, crouch, prone, then stand again. */
export const nextStance = (stance: DummyStance): DummyStance =>
    STANCE_CYCLE[(STANCE_CYCLE.indexOf(stance) + 1) % STANCE_CYCLE.length];
