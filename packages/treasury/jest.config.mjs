/**
 * Jest config for @sven/treasury. Uses ts-jest ESM preset so .ts sources run
 * directly. Mirrors other internal packages.
 */
/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@sven/shared$': '<rootDir>/src/__tests__/__mocks__/sven-shared.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: { module: 'esnext', target: 'es2022', moduleResolution: 'node' } }],
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
};
