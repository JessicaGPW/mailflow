import { config } from "dotenv";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
config({ path: process.env.ENV_FILE ?? ".env", override: false });

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required. Set it in .env or point ENV_FILE to a configured environment file."
  );
  process.exit(1);
}

const vitestCli = join(dirname(require.resolve("vitest")), "vitest.mjs");
const result = spawnSync(process.execPath, [vitestCli, "run"], {
  env: { ...process.env, RUN_NETWORK_TESTS: "1" },
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
