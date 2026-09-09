import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000
  },
  resolve: {
    alias: { "@": resolve(__dirname, ".") }
  }
});
