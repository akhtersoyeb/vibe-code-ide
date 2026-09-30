import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp", // "credentialless"
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
  // Same headers for `vite preview` (production-build testing), which uses
  // a separate server config from dev.
  preview: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp", // "credentialless"
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
})
