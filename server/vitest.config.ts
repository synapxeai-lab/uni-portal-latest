import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

// Tests run inside the server container (docker compose exec server npm test):
// unit tests import the source directly, API tests call the running API.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // API tests share one database - run files one after another.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
