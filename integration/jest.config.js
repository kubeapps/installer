module.exports = {
  rootDir: "./",
  testMatch: ["<rootDir>/use-cases/create-private-registry.js"],
  globalSetup: "jest-environment-puppeteer/setup",
  globalTeardown: "jest-environment-puppeteer/teardown",
  testEnvironment: "./jest.environment.js",
  testRunner: "jest-circus/runner",
  setupFilesAfterEnv: ["./jest.setup.js"]
};
