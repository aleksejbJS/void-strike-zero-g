// Monotonically increasing ID generator — replaces Math.random().toString()
let counter = 0;

export const nextId = (prefix = ''): string => `${prefix}${++counter}`;

export const resetIdCounter = (): void => { counter = 0; };
