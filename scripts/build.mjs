// Builds dist/guacamole-common-js.js from the Apache release named in UPSTREAM_VERSION: the same files, in the same
// order, as Apache's own Maven build concatenates, wrapped as an ES module with a default and named exports.
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const upstream = (
  await readFile(new URL("UPSTREAM_VERSION", root), "utf8")
).trim();
const work = new URL(".upstream/", root);
const archive = new URL(`${upstream}.tar.gz`, work);
const extracted = `guacamole-client-${upstream}`;
const source = new URL(`${extracted}/`, work);
const webapp = new URL("guacamole-common-js/src/main/webapp/", source);
const dist = new URL("dist/", root);

await mkdir(work, { recursive: true });
if (!(await exists(archive))) {
  const url = `https://github.com/apache/guacamole-client/archive/refs/tags/${upstream}.tar.gz`;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(
      `Download of ${url} failed: ${response.status} ${response.statusText}`,
    );
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(archive));
}

await rm(source, { force: true, recursive: true });
execFileSync("tar", [
  "-xzf",
  fileURLToPath(archive),
  "-C",
  fileURLToPath(work),
  `${extracted}/guacamole-common-js/src/main/webapp`,
  `${extracted}/LICENSE`,
  `${extracted}/NOTICE`,
]);

// Apache's pom lists common/license.js first, then modules/**/*.js
const modules = (await readdir(new URL("modules/", webapp)))
  .filter((name) => name.endsWith(".js"))
  .sort();
const parts = [await readFile(new URL("common/license.js", webapp), "utf8")];
for (const name of modules) {
  parts.push(await readFile(new URL(`modules/${name}`, webapp), "utf8"));
}
const body = parts.join("\n");

// The namespace's members become named exports; the bundle is loaded once to list them
await mkdir(dist, { recursive: true });
const probe = new URL("probe.mjs", work);
await writeFile(probe, `${body}\nexport default Guacamole;\n`);
const { default: probed } = await import(probe.href);
const members = Object.keys(probed).sort();
if (probed.API_VERSION !== upstream) {
  throw new Error(
    `Built API_VERSION ${probed.API_VERSION} does not match UPSTREAM_VERSION ${upstream}`,
  );
}

const named = members
  .map((member) => `export const ${member} = Guacamole.${member};`)
  .join("\n");
await writeFile(
  new URL("guacamole-common-js.js", dist),
  `${body}\nexport default Guacamole;\n${named}\n`,
);
// Apache's files end with a blank line or none; the hooks here want exactly one newline
for (const name of ["LICENSE", "NOTICE"]) {
  const text = await readFile(new URL(name, source), "utf8");
  await writeFile(new URL(name, root), `${text.trimEnd()}\n`);
}
console.log(
  `Built guacamole-common-js ${upstream}: ${modules.length} modules, ${members.length} exports`,
);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}
