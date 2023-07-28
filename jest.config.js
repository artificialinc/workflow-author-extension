// const tsconfig = require('./tsconfig.json');
// const moduleNameMapper = require('tsconfig-paths-jest')(tsconfig);

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  setupFilesAfterEnv: ['./jest.setup.env.js'],

  // modulePathIgnorePatterns: [
  //   '/dist',
  //   '.*__mocks__.*',
  //   '/node_modules',
  //   '/prod_modules',
  // ],
  transform: {"\\.[jt]sx?$": "ts-jest"},
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.[t]sx?$",
  transformIgnorePatterns: ['^.+\\.js$'],
  coveragePathIgnorePatterns: [
    '/dist',
    '.*__mocks__.*',
    '/node_modules',
    '/prod_modules',
  ]
};
