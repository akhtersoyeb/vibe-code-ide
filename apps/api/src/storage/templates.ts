export const TEMPLATES: Record<string, Record<string, string>> = {
  "vite-react": {
    "package.json": JSON.stringify(
      {
        name: "app",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "vite build",
        },
        dependencies: {
          react: "^18.3.1",
          "react-dom": "^18.3.1",
        },
        devDependencies: {
          "@vitejs/plugin-react": "^4.3.1",
          vite: "^5.4.0",
        },
      },
      null,
      2
    ),

    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>App</title>
    <script type="module">
      // Forwards errors to the parent page, which is on a different origin
      // and can't read this window's state directly. Used for the auto-fix
      // feature — please don't remove this, and keep it type="module": that
      // is what makes import.meta.hot available below.
      window.addEventListener("error", function (e) {
        window.parent.postMessage(
          {
            source: "preview-error-reporter",
            message: e.message + " (" + e.filename + ":" + e.lineno + ")",
          },
          "*"
        );
      });
      window.addEventListener("unhandledrejection", function (e) {
        var reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
        window.parent.postMessage(
          { source: "preview-error-reporter", message: "Unhandled promise rejection: " + reason },
          "*"
        );
      });
      // Catches compile/syntax errors too (e.g. a mismatched JSX tag) —
      // those never produce a runtime window.onerror, since the broken
      // module never finishes loading, let alone running. Vite reports
      // these over its own HMR channel instead, which only a module script
      // (not a classic <script>) can listen to.
      if (import.meta.hot) {
        import.meta.hot.on("vite:error", function (payload) {
          var err = payload && payload.err;
          window.parent.postMessage(
            {
              source: "preview-error-reporter",
              message: (err && err.message) || "Build error",
            },
            "*"
          );
        });
      }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,

    "vite.config.js": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
`,

    "src/main.jsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,

    "src/App.jsx": `export default function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>New project</h1>
      <p>Ask the AI to start building.</p>
    </div>
  );
}
`,
  },
};