/**
 * Run one of the Atlas's scripts from the workspace root. The compositor, the card
 * renderer and the Post Bridge scripts live in atlas/scripts/ (they share the Atlas's
 * lib and its node_modules); the kit's scripts/*.mjs launchers call them with the Atlas
 * as the working directory and ATLAS_ROOT set to the workspace, so both the Atlas's
 * readers and its built data (atlas/data/) resolve the same way the web app does.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ATLAS = join(ROOT, "atlas");

export function runAtlasScript(script, args, { build = true } = {}) {
  if (!existsSync(join(ATLAS, "node_modules"))) {
    console.error("the Atlas's dependencies are not installed yet: run  scripts/atlas.sh --index  once (a minute, ~370 MB)");
    process.exit(1);
  }
  const env = { ...process.env, ATLAS_ROOT: ROOT };
  if (build) {
    /* The plan and the decks are read through the built data; rebuild first so a deck written a minute ago is seen. */
    const b = spawnSync("node", ["scripts/build-production.mjs"], { cwd: ATLAS, env, stdio: ["ignore", "ignore", "inherit"] });
    if (b.status !== 0) { console.error("the Atlas build failed: cd atlas && node scripts/build-production.mjs"); process.exit(1); }
  }
  const r = spawnSync("node", [join("scripts", script), ...args], { cwd: ATLAS, env, stdio: "inherit" });
  process.exit(r.status ?? 1);
}
