#!/usr/bin/env node
/**
 * Creates stats + achievements on the Wavedash game from wavedash/catalog.json.
 * Requires the Wavedash CLI (`wavedash auth login`).
 *
 * If the CLI is missing, prints how to import the JSON in the Developer Portal.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME_ID = "wd_770959de815da6fe71ce8f5efaa1f62caa5200f7071b8480c0b4dcf72b3af3b1";
const catalog = JSON.parse(readFileSync(join(ROOT, "wavedash/catalog.json"), "utf8"));

function whichWavedash() {
  const probe = spawnSync("wavedash", ["--version"], { encoding: "utf8" });
  return probe.status === 0 ? probe.stdout.trim() : "";
}

function run(args) {
  const result = spawnSync("wavedash", [...args, "--game-id", GAME_ID], {
    encoding: "utf8",
    cwd: ROOT,
  });
  const out = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  return { status: result.status ?? 1, out };
}

const version = whichWavedash();
if (!version) {
  console.log("[Nothing] wavedash CLI not found.");
  console.log("Install: curl -fsSL https://wavedash.com/cli/install.sh | sh");
  console.log("Then:    wavedash auth login");
  console.log("Or import wavedash/catalog.json in Developer Portal → Achievements → Import JSON");
  console.log(`Game id: ${GAME_ID}`);
  process.exit(0);
}

console.log(`[Nothing] wavedash ${version}`);
console.log(`[Nothing] sync catalog → ${GAME_ID}`);

for (const stat of catalog.stats) {
  const { status, out } = run(["stat", "create", "--identifier", stat.identifier, "--name", stat.display_name]);
  const skip = /already|exist/i.test(out);
  console.log(`[Nothing] stat ${stat.identifier}`, { ok: status === 0 || skip, skip, out: out.slice(0, 200) });
}

for (const ach of catalog.achievements) {
  const args = [
    "achievement",
    "create",
    "--identifier",
    ach.identifier,
    "--title",
    ach.display_name,
    "--description",
    ach.description,
  ];
  const { status, out } = run(args);
  const skip = /already|exist/i.test(out);
  console.log(`[Nothing] achievement ${ach.identifier}`, {
    ok: status === 0 || skip,
    skip,
    out: out.slice(0, 240),
  });
}

console.log("[Nothing] catalog sync finished. Leaderboards are created at runtime via getOrCreateLeaderboard.");
console.log("[Nothing] Stat-triggered unlocks: set thresholds in the portal, or leave them — the game also unlocks by identifier.");
