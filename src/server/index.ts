import { DocumentStore } from "./document";
import { LensManager } from "./lens-manager";
import { RouteHandler } from "./routes";
import { LENS_PRESETS } from "@shared/lens-presets";
import { loadUserLenses } from "./lens-loader";
import { join } from "path";

const PORT = Number(process.env.LOUPE_PORT) || 4460;
const MODEL = process.env.LOUPE_MODEL || "claude-sonnet-4-6";
const LENSES_DIR = join(process.cwd(), "lenses");

export async function startServer() {
  // Load user lenses from lenses/ directory
  const userLenses = await loadUserLenses(LENSES_DIR);
  console.log(`Loaded ${userLenses.length} user lens(es)`);

  const document = new DocumentStore();
  const lensManager = new LensManager([...LENS_PRESETS, ...userLenses], MODEL);
  const router = new RouteHandler(document, lensManager);

  // In production, serve Vite-built static files
  const distDir = join(import.meta.dir, "../../dist");

  const server = Bun.serve({
    port: PORT,
    idleTimeout: 120, // SSE streams idle during Claude processing
    async fetch(req) {
      // Try API routes first
      const apiResponse = await router.handle(req);
      if (apiResponse) return apiResponse;

      // Serve static files from dist/
      const url = new URL(req.url);
      let filePath = join(distDir, url.pathname === "/" ? "index.html" : url.pathname);

      const file = Bun.file(filePath);
      if (await file.exists()) return new Response(file);

      // SPA fallback
      return new Response(Bun.file(join(distDir, "index.html")));
    },
  });

  console.log(`Loupe server running at http://localhost:${server.port}`);
  return server;
}
