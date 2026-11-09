// Canonical appearance choices. These channels leave the approved source artwork untinted.

import { BodyId } from './bodyTypes';

export interface BodyPalette { head: number; torso: number; arm: number; leg: number }
export interface BaseColors { head: string; torso: string; arms: string; legs: string; jetpack: string }
export interface BodyPreset {
    id: string;
    body: BodyId;
    name: string;
    style: 'human' | 'robot' | 'alien' | 'beast';
    color: string;
    accent?: string;
    palette: BaseColors;
}

export const BODY_PALETTES: Record<BodyId, BodyPalette> = {
    human: { head: 0xa56b47, torso: 0xe4d4ab, arm: 0xa56b47, leg: 0x514d42 },
    'human-female': { head: 0xa56b47, torso: 0xe4d4ab, arm: 0xa56b47, leg: 0x514d42 },
    robot: { head: 0xd9cda8, torso: 0xd9cda8, arm: 0xb65842, leg: 0x6b716a },
    toxic: { head: 0xa6ba43, torso: 0xb6bf46, arm: 0xa6ba43, leg: 0x526344 },
    cat: { head: 0x919082, torso: 0xc8bea2, arm: 0x919082, leg: 0x55584e },
};

const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
const base = (id: string, body: BodyId, name: string, style: BodyPreset['style']): BodyPreset => {
    const { head, torso, arm, leg } = BODY_PALETTES[body];
    return {
        id, body, name, style, color: hex(torso),
        palette: { head: hex(head), torso: hex(torso), arms: hex(arm), legs: hex(leg), jetpack: '#ef4444' },
    };
};

export const BODY_PRESETS: readonly BodyPreset[] = [
    base('base-human', 'human', 'Human', 'human'),
    base('base-female', 'human-female', 'Female human', 'human'),
    base('base-robot', 'robot', 'Robot', 'robot'),
    base('base-toxic', 'toxic', 'Toxic', 'alien'),
    base('base-cat', 'cat', 'Cat', 'beast'),
];
