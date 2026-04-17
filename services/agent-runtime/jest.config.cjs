module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.test.json',
    }],
  },
  moduleNameMapper: {
    '^@sven/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@sven/shared/(.*)\\.js$': '<rootDir>/../../packages/shared/src/$1.ts',
    '^@sven/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
    '^@sven/compute-mesh$': '<rootDir>/../../packages/compute-mesh/src/index.ts',
    '^@sven/compute-mesh/(.*)\\.js$': '<rootDir>/../../packages/compute-mesh/src/$1.ts',
    '^@sven/compute-mesh/(.*)$': '<rootDir>/../../packages/compute-mesh/src/$1',
    '^@sven/treasury$': '<rootDir>/../../packages/treasury/src/index.ts',
    '^@sven/treasury/(.*)\\.js$': '<rootDir>/../../packages/treasury/src/$1.ts',
    '^@sven/treasury/(.*)$': '<rootDir>/../../packages/treasury/src/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
