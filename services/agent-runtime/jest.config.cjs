module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@jest/globals$': require.resolve('@jest/globals', { paths: [__dirname + '/../../node_modules'] }),
    '^@sven/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@sven/shared/(.*)\\.js$': '<rootDir>/../../packages/shared/src/$1.ts',
    '^@sven/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@sven/compute-mesh$': '<rootDir>/../../packages/compute-mesh/src/index.ts',
    '^@sven/compute-mesh/(.*)\\.js$': '<rootDir>/../../packages/compute-mesh/src/$1.ts',
    '^@sven/compute-mesh/(.*)$': '<rootDir>/../../packages/compute-mesh/src/$1',
    '^@sven/model-router$': '<rootDir>/../../packages/model-router/src/index.ts',
    '^@sven/model-router/(.*)\\.js$': '<rootDir>/../../packages/model-router/src/$1.ts',
    '^@sven/model-router/(.*)$': '<rootDir>/../../packages/model-router/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
      diagnostics: false,
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
