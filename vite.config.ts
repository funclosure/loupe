import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Loupe",
        short_name: "Loupe",
        description: "A zen writing app with AI lenses",
        theme_color: "#1a1a1f",
        background_color: "#1a1a1f",
        display: "standalone",
        start_url: "/",
        file_handlers: [
          {
            action: "/",
            accept: { "text/markdown": [".md"] },
          },
        ],
        icons: [
          { src: "favicon.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4460",
        changeOrigin: true,
      },
    },
  },
});
