/**
 * Node custom loader: server-only shim + @/ path alias for CLI workers.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, "..", "..");
const emptyUrl = pathToFileURL(path.join(dir, "empty-server-only.mjs")).href;

function resolveAlias(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const rel = specifier.slice(2);
  const base = path.join(root, "src", rel);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return pathToFileURL(`${base}.ts`).href;
}

function resolveExtensionless(base) {
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (
    specifier === "server-only" ||
    specifier.endsWith("/server-only") ||
    specifier.endsWith("/server-only/index.js")
  ) {
    return { shortCircuit: true, url: emptyUrl };
  }

  const aliased = resolveAlias(specifier);
  if (aliased) {
    return { shortCircuit: true, url: aliased };
  }

  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      (specifier.startsWith("./") || specifier.startsWith("../")) &&
      context?.parentURL?.startsWith("file:")
    ) {
      const parentPath = fileURLToPath(context.parentURL);
      const base = path.resolve(path.dirname(parentPath), specifier);
      const fallback = resolveExtensionless(base);
      if (fallback) {
        return { shortCircuit: true, url: pathToFileURL(fallback).href };
      }
    }
    throw err;
  }
}
