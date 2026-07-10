/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  moduleNameMapper: {
    '^@app/types$': '<rootDir>/../../types/src/index.ts',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!index.ts'],
};
