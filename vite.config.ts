import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

/**
 * Optional FIRMS proxy (dev server and `vite preview` only). Use it when the browser cannot call NASA FIRMS directly
 * (CORS) or when you do not want a MAP_KEY inside the browser bundle: the key is read from the NON-prefixed variable
 * FIRMS_MAP_KEY, which Vite never exposes to client code, and is added to the upstream request on the server side.
 * The app is pointed at it with VITE_FIRMS_BASE_URL=/api/firms. Without FIRMS_MAP_KEY no proxy is created.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const key = (env.FIRMS_MAP_KEY ?? "").trim();
  const proxy = key
    ? {
        "/api/firms": {
          target: "https://firms.modaps.eosdis.nasa.gov",
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/api\/firms/, `/api/area/csv/${encodeURIComponent(key)}`),
        },
      }
    : undefined;
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
    build: { chunkSizeWarningLimit: 1200 },
    server: { proxy },
    preview: { proxy },
  };
});
