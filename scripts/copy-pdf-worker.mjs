// Copia el worker de pdfjs a public/ para servirlo como asset estático.
// Webpack no puede empaquetar el worker (.mjs usa import.meta), así que lo
// cargamos por URL estática. Se ejecuta en predev y prebuild (queda sincronizado
// con la versión instalada de pdfjs-dist y no se versiona en git).
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgJson = require.resolve("pdfjs-dist/package.json");
const src = join(dirname(pkgJson), "build", "pdf.worker.min.mjs");

const destDir = join(process.cwd(), "public");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "pdf.worker.min.mjs"));

console.log("✓ pdf.worker.min.mjs copiado a public/");
