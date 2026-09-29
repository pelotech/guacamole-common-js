// Builds dist/guacamole-common-js.js from the Apache source named in UPSTREAM_VERSION: the same files, in the same
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
// A prerelease pins a commit of Apache's staging branch for that version; a release builds from the tag
const commit = await readOptional(new URL("UPSTREAM_COMMIT", root));
const ref = commit ?? upstream;
const work = new URL(".upstream/", root);
const archive = new URL(`${ref}.tar.gz`, work);
const extracted = `guacamole-client-${ref}`;
const source = new URL(`${extracted}/`, work);
const main = new URL("guacamole-common-js/src/main/", source);
const webapp = new URL("webapp/", main);
const dist = new URL("dist/", root);

await mkdir(work, { recursive: true });
if (!(await exists(archive))) {
  const url = commit
    ? `https://github.com/apache/guacamole-client/archive/${commit}.tar.gz`
    : `https://github.com/apache/guacamole-client/archive/refs/tags/${upstream}.tar.gz`;
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
  `${extracted}/guacamole-common-js/src/main`,
  `${extracted}/LICENSE`,
  `${extracted}/NOTICE`,
]);

// Apache's pom lists common/license.js first, then modules/**/*.js; since 1.6.1 Maven fills the version into the
// templates under webapp-templates/modules and they join the same set
const modules = new Map();
for (const name of await jsFiles(new URL("modules/", webapp))) {
  modules.set(name, await readFile(new URL(`modules/${name}`, webapp), "utf8"));
}
const templates = new URL("webapp-templates/modules/", main);
for (const name of await jsFiles(templates)) {
  if (modules.has(name)) {
    throw new Error(`${name} is both a module and a template`);
  }
  const filtered = (
    await readFile(new URL(name, templates), "utf8")
  ).replaceAll("${project.version}", upstream);
  if (filtered.includes("${")) {
    throw new Error(
      `${name} uses a Maven property this build does not fill in`,
    );
  }
  modules.set(name, filtered);
}
const names = [...modules.keys()].sort();
const parts = [
  await readFile(new URL("common/license.js", webapp), "utf8"),
  ...names.map((name) => modules.get(name)),
];
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

// Exported under their own names through an alias list: a binding named like a global (Object, Event) would shadow
// it for the whole bundle
const named = [
  ...members.map((member) => `const guac_${member} = Guacamole.${member};`),
  `export { ${members.map((member) => `guac_${member} as ${member}`).join(", ")} };`,
].join("\n");
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
  `Built guacamole-common-js ${upstream}${commit ? ` from commit ${commit}` : ""}: ${names.length} modules, ${members.length} exports`,
);

async function exists(url) {
  try {
    await access(url);
    return true;
  } catch {
    return false;
  }
}

// The .js files of a directory that may not exist: older releases have no templates
async function jsFiles(dir) {
  try {
    return (await readdir(dir)).filter((name) => name.endsWith(".js"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readOptional(url) {
  try {
    return (await readFile(url, "utf8")).trim() || undefined;
  } catch (error) {
    if (error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
