#!/usr/bin/env bun
import { startServer } from "./src/server/index";
import { existsSync } from "fs";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("-") && a !== ".");

// Auto-build on first run (fresh clone / missing dist)
if (!existsSync(new URL("./dist/index.html", import.meta.url).pathname)) {
  console.log("Building client (first run)…");
  const { $ } = await import("bun");
  await $`bun run build`;
}

const server = await startServer();
const url = `http://localhost:${server.port}/w/${filePath ? encodeURIComponent(filePath) : ""}`;

// Open browser
const { $ } = await import("bun");
try {
  await $`open ${url}`.quiet();
} catch {
  console.log(`Open ${url} in your browser`);
}

// Keep process alive
process.on("SIGINT", () => {
  console.log("\nLoupe stopped.");
  process.exit(0);
});
