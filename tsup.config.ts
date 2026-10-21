import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // The cards come from fancy-app-update's `./cards` entry and are NEVER
  // bundled: a bundled copy would be the duplicated card this package exists
  // not to have, and would stop receiving fancy-app-update's fixes.
  external: [
    "react",
    "react-dom",
    "@particle-academy/react-fancy",
    "@particle-academy/fancy-app-update",
    "@particle-academy/fancy-app-update/cards",
  ],
  // Client component — mark so React Server Component frameworks treat it as a
  // client boundary.
  banner: { js: '"use client";' },
});
