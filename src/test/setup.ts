// Global test setup. Browser mocks only apply in jsdom; server tests
// (`// @vitest-environment node`) run without them.
if (typeof window !== 'undefined') {
    await import('./browserSetup');
}
