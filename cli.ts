import { startServer } from "./src/server/index";

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("-"));

const server = await startServer();
const url = `http://localhost:${server.port}${filePath ? `?file=${encodeURIComponent(filePath)}` : ""}`;

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
