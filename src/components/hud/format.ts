// Small formatting helpers for the HUD

/** 272 → "4:32" */
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds) % 60).padStart(2, '0')}`;
