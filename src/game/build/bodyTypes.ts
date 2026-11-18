// Stable appearance identifiers carried by builds, saves and network snapshots.
export const BODY_IDS = ['human', 'human-female', 'robot', 'toxic', 'cat'] as const;
export type BodyId = typeof BODY_IDS[number];

export const isBodyId = (value: unknown): value is BodyId =>
    typeof value === 'string' && (BODY_IDS as readonly string[]).includes(value);
