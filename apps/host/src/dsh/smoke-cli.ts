import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hostRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnv({ path: path.join(hostRoot, ".env") });

import { runDshSmoke } from "./runner.js";

const prompt = process.argv.slice(2).join(" ") || undefined;

try {
  const result = await runDshSmoke({ prompt });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("dsh smoke failed:");
  console.error(error);
  process.exitCode = 1;
}
