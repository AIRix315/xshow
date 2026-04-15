// Vitest 全局 setup — RTL cleanup + jest-dom matchers + jsdom polyfills
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom polyfills
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = (_obj: Blob) => `blob:mock-${Math.random().toString(36).slice(2)}`;
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = (_url: string) => {};
}

afterEach(() => {
  cleanup();
});