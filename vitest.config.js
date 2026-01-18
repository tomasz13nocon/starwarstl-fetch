import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Enable globals like describe, it, expect without imports
    globals: true,

    // Use node environment
    environment: "node",

    // Snapshot settings
    snapshotFormat: {
      escapeString: false,
      printBasicPrototype: false,
    },

    // Coverage configuration
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,ts}"],
      exclude: ["src/**/*.test.{js,ts}", "src/env.js"],
    },

    // Run tests sequentially for snapshot tests to avoid race conditions
    sequence: {
      shuffle: false,
    },

    // Define test projects for granular test running
    // Run all:        npm test
    // Run by project: npm test -- --project unit
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.{js,ts}"],
          testTimeout: 5000,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/*.test.{js,ts}"],
          exclude: ["tests/integration/pipeline-regression.test.{js,ts}"],
          testTimeout: 60000,
        },
      },
      {
        extends: true,
        test: {
          name: "regression",
          include: ["tests/integration/pipeline-regression.test.{js,ts}"],
          testTimeout: 600000, // 10 minutes
        },
      },
    ],
  },
});
