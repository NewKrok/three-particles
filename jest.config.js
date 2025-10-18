export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.m?[tj]sx?$': 'babel-jest',
  },
  moduleNameMapper: {
    '^(.+)\\.js$': '$1',
  },
  transformIgnorePatterns: ['node_modules/(?!three-noise|three|@newkrok/three-utils)'],
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  maxWorkers: '50%',
};
