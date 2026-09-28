import { defineConfig } from "vitest/config";

// Forked workers so tests can pin process.env.TZ (schedule/DST tests).
export default defineConfig({ test: { pool: "forks" } });
