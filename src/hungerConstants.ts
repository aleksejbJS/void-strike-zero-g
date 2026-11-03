// Hunger Games zone tuning (shrinking safe zone)
export const HUNGER_SHRINK_STEP = 250;    // zone shrink per edge, per pending death
export const HUNGER_SHRINK_DELAY = 5000;  // ms between first death and the shrink
export const HUNGER_MIN_ZONE = 1200;      // zone never shrinks below this size
export const HUNGER_QUIET_SHRINK = 30000; // with no deaths, the zone still shrinks this often
