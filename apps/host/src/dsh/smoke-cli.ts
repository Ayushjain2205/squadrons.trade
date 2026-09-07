import "dotenv/config";
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
