import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hostRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
loadEnv({ path: path.join(hostRoot, ".env") });

import {
  formatPreflightFailure,
  runDshPreflight,
} from "./preflight.js";

const result = await runDshPreflight();
console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  console.error(formatPreflightFailure(result));
  process.exitCode = 1;
}
