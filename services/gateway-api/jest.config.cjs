module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 25,
      lines: 5,
      statements: 5,
    },
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.e2e.ts',
    '**/__tests__/**/*.e2e.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    'stream-resume\\.e2e\\.test\\.ts$',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@sven/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@sven/shared/(.*)\\.js$': '<rootDir>/../../packages/shared/src/$1.ts',
    '^@sven/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json',
      diagnostics: false,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: ['/node_modules/'],
};
