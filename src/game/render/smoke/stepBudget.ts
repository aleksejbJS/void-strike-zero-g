// How many grid cells the smoke may step in one frame, shared by every grid of a view (clouds first, then plumes). At
// 120 fps a grid steps every second frame; without a budget the grids that fell into step together ran their steps on
// the same frame and left the next one idle (6-8 steps, over 3 ms, then none). A grid whose step is due when the budget
// is spent waits one frame (GridDriver), never more, so no grid loses steps and the work spreads over both frames. Visual only.

export class StepBudget {
    private remaining = 0;

    /** `cells` is the frame's budget, in cell steps (a step of an n x n grid costs n * n). */
    constructor(private readonly cells: number) {}

    /** What is left of this frame's budget (negative when the last grid went over). */
    get left(): number {
        return this.remaining;
    }

    /** True when nothing is left. */
    get spent(): boolean {
        return this.remaining <= 0;
    }

    /** A new frame: the whole budget again. */
    refill(): void {
        this.remaining = this.cells;
    }

    /** `steps` steps of a grid of `cells` cells were run. */
    spend(steps: number, cells: number): void {
        this.remaining -= steps * cells;
    }
}
