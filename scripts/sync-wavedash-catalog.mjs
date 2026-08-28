#!/usr/bin/env node
/**
 * Syncs stats + achievements on the Wavedash game from wavedash/catalog.json.
 * Creates missing entries, updates titles/descriptions, deletes identifiers
 * that are no longer in the catalog (the old first-10-seconds set).
 *
 * Requires the Wavedash CLI (`wavedash auth login` or WAVEDASH_TOKEN).
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAME_ID = "j97b4r6g42zdxc5v540d2cn1gs8d8r69";
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

function parseJson(out) {
  const start = out.indexOf("[");
  const startObj = out.indexOf("{");
  const i = start === -1 ? startObj : startObj === -1 ? start : Math.min(start, startObj);
  if (i < 0) return null;
  try {
    return JSON.parse(out.slice(i));
  } catch {
    return null;
  }
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

const listed = run(["achievement", "list", "--json"]);
const remote = Array.isArray(parseJson(listed.out)) ? parseJson(listed.out) : [];
console.log("[Nothing] remote achievements", { count: remote.length });

const byIdentifier = new Map();
for (const row of remote) {
  const identifier = row.identifier ?? row.Identifier;
  if (identifier) byIdentifier.set(identifier, row);
}

const wanted = new Set(catalog.achievements.map((ach) => ach.identifier));

for (const ach of catalog.achievements) {
  const existing = byIdentifier.get(ach.identifier);
  if (!existing) {
    const { status, out } = run([
      "achievement",
      "create",
      "--identifier",
      ach.identifier,
      "--title",
      ach.display_name,
      "--description",
      ach.description,
    ]);
    console.log(`[Nothing] achievement create ${ach.identifier}`, {
      ok: status === 0,
      out: out.slice(0, 240),
    });
    continue;
  }
  const id = existing._id ?? existing.id;
  if (!id) continue;
  const { status, out } = run([
    "achievement",
    "update",
    "--id",
    id,
    "--identifier",
    ach.identifier,
    "--title",
    ach.display_name,
    "--description",
    ach.description,
  ]);
  const skip = /no.?change|unchanged|same/i.test(out) || status === 0;
  console.log(`[Nothing] achievement update ${ach.identifier}`, {
    ok: status === 0 || skip,
    id,
    out: out.slice(0, 240),
  });
}

for (const [identifier, row] of byIdentifier) {
  if (wanted.has(identifier)) continue;
  const id = row._id ?? row.id;
  if (!id) continue;
  const { status, out } = run(["achievement", "delete", "--id", id, "--force"]);
  console.log(`[Nothing] achievement delete ${identifier}`, {
    ok: status === 0,
    id,
    out: out.slice(0, 240),
  });
}

console.log("[Nothing] catalog sync finished. Old first-kiss achievements are removed when the CLI allows it.");
