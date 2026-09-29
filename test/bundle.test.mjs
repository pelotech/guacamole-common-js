import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import Guacamole, * as named from "../dist/guacamole-common-js.js";

test("carries the upstream version it was built from", async () => {
  const upstream = (
    await readFile(new URL("../UPSTREAM_VERSION", import.meta.url), "utf8")
  ).trim();
  assert.equal(Guacamole.API_VERSION, upstream);
});

test("exposes the client classes", () => {
  for (const name of [
    "ArrayBufferWriter",
    "Client",
    "Keyboard",
    "Mouse",
    "Status",
    "StringReader",
    "WebSocketTunnel",
  ]) {
    assert.equal(typeof Guacamole[name], "function", name);
  }
});

test("names every member of the namespace", () => {
  const { default: namespace, ...rest } = named;
  assert.equal(namespace, Guacamole);
  assert.deepEqual(Object.keys(rest).sort(), Object.keys(Guacamole).sort());
});

test("declares no binding named like a global, which would shadow it for the whole bundle", async () => {
  const source = await readFile(
    new URL("../dist/guacamole-common-js.js", import.meta.url),
    "utf8",
  );
  for (const name of Object.keys(Guacamole).filter(
    (name) => name in globalThis,
  )) {
    assert.doesNotMatch(
      source,
      new RegExp(`^(?:const|let|var|class|function\\*?)\\s+${name}\\b`, "m"),
      name,
    );
  }
});
