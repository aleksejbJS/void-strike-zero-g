// One-off at start-up: stored colours that are still the painted robot's defaults move to the 3D kit's
// defaults, so a match (which reads the colour keys directly) shows the approved robot. Not a player edit:
// the look's "saved at" stamp is left alone, so a newer cloud customisation still wins.

import { loadBuild } from '../game/build/buildStorage';
import { ROBOT_LEGACY_PALETTE } from '../game/build/characterBases';
import { migrateRobotDefaults } from '../game/build/characterMigration';
import { PLAYER_KEYS, readStored, writeStored } from '../store/playerStorage';

export function migrateStoredRobotLook(): void {
    const body = loadBuild().body;
    if (body !== 'robot') return;
    // The player colour follows the torso (CharacterSetup saves player = torso)
    const fields = { head: 'head', torso: 'torso', arms: 'arms', legs: 'legs', player: 'torso' } as const;
    for (const [field, part] of Object.entries(fields) as [keyof typeof fields, keyof typeof ROBOT_LEGACY_PALETTE][]) {
        const stored = readStored(PLAYER_KEYS[field]);
        if (stored === null) continue;
        const legacy = { ...ROBOT_LEGACY_PALETTE, [part]: stored };
        const migrated = migrateRobotDefaults(legacy, body)[part];
        if (migrated !== stored) writeStored(PLAYER_KEYS[field], migrated);
    }
}
