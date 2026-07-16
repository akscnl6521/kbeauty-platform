import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import Module from "node:module";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..");
const emptyMjs = path.join(dir, "hooks", "empty-server-only.mjs");

register(pathToFileURL(path.join(dir, "hooks", "resolve-server-only.mjs")).href);

function resolveAlias(request) {
  if (!request.startsWith("@/")) return null;
  const rel = request.slice(2);
  const base = path.join(root, "src", rel);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return `${base}.ts`;
}

// CJS require path (tsx may pull some modules via require)
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function patchedResolve(request, parent, isMain, options) {
  if (request === "server-only") {
    return emptyMjs;
  }
  const aliased = resolveAlias(request);
  if (aliased) {
    return aliased;
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Warm createRequire for side-effect-free check
createRequire(import.meta.url);
