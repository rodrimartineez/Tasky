import { defineConfig } from "vite";

// Empaqueta el servidor MCP (src/mcp/edge.ts + core/ + dependencias) en un único módulo ES
// que importa la Edge Function de Supabase (supabase/functions/tasky-mcp/index.ts).
export default defineConfig({
  build: {
    lib: { entry: "src/mcp/edge.ts", formats: ["es"], fileName: () => "tasky.js" },
    outDir: "supabase/functions/tasky-mcp/dist",
    emptyOutDir: true,
    target: "es2022",
    minify: false,
    copyPublicDir: false,
  },
});
