/** tsx/node preload: allow importing server-only modules outside Next.js. */
const Module = require("module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") {
    return require.resolve("./empty-server-only.cjs");
  }
  return original.call(this, request, parent, isMain, options);
};
