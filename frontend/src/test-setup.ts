// Vitest test setup — global mocks and polyfills for JSDOM environment
import '@testing-library/jest-dom/vitest';

// Mock IntersectionObserver (not available in JSDOM)
class MockIntersectionObserver {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}
global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => { /* noop */ },
    removeListener: () => { /* noop */ },
    addEventListener: () => { /* noop */ },
    removeEventListener: () => { /* noop */ },
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
class MockResizeObserver {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
