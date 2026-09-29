# @pelotech/guacamole-common-js

[Apache Guacamole](https://guacamole.apache.org/)'s `guacamole-common-js`, the browser client library, built from the
Apache release tag and published as an ES module with types.

Apache ships this library only as a Maven artifact. The packages on npm under this name and others are personal
repacks that stopped at 1.5.x. This package is the same files Apache releases, at the version pinned in
`UPSTREAM_VERSION`, with nothing added but the module wrapper.

```sh
npm install @pelotech/guacamole-common-js
```

```ts
import Guacamole from "@pelotech/guacamole-common-js";

const tunnel = new Guacamole.WebSocketTunnel(
  "wss://guacamole.example/websocket-tunnel",
);
const client = new Guacamole.Client(tunnel);
```

Named exports exist too: `import { Client, Keyboard } from "@pelotech/guacamole-common-js"`.

Types come from DefinitelyTyped's `@types/guacamole-common-js`, installed as a dependency and re-exported, so the
package needs no separate `@types` install.

## How it is built

`npm run build` downloads the Apache source archive for the tag in `UPSTREAM_VERSION`, or for the commit in
`UPSTREAM_COMMIT` when that file exists, concatenates `common/license.js` and `modules/*.js` in the order Apache's own
build uses, appends a default export and one named export per member of the `Guacamole` namespace, and copies Apache's
`LICENSE` and `NOTICE` next to the package. Since Apache 1.6.1 the version lives in a template under
`webapp-templates/modules` that Maven fills in; the build fills `${project.version}` the same way. The build fails if
the bundle's `API_VERSION` is not the pinned version.

`npm test` loads the bundle and checks the version and the classes, then type-checks a consumer against `index.d.ts`.

## Releasing a new upstream version

Renovate watches Apache's release tags and opens a PR that bumps `UPSTREAM_VERSION` and `version` in `package.json`
together; CI builds and tests from the new tag. Merging it starts the release: every push to `main` whose version the
registry does not know yet is rebuilt from the Apache tag, tested, and staged on npm with provenance. Nothing goes live
from CI. A maintainer reviews the staged version and approves it with 2FA:

```sh
npm stage list @pelotech/guacamole-common-js
npm stage approve <stage-id>
```

`npm stage reject <stage-id>` drops a staged version instead; the next push to `main` stages it again.

The package version tracks the Apache version. A fix to this packaging alone takes the next patch number, with
`UPSTREAM_VERSION` left as it was, so the file is the source of truth for what Apache code a version contains. When
Apache later releases that same number, bump the package to the next patch by hand.

A prerelease from Apache's staging branch lives on a branch of the same name here (`staging/1.6.1`), so `main` keeps
the latest release. It pins the Apache commit in `UPSTREAM_COMMIT`, keeps `UPSTREAM_VERSION` at the version Apache
will release, and takes a prerelease package version such as `1.6.1-alpha.0`. Running the Release workflow on that
branch (`gh workflow run release.yaml --ref staging/1.6.1`) stages it under the `next` dist-tag; approval is the same.
Renovate ignores both files in that state. When Apache tags the release, `main` takes the release as usual and the
branch is deleted.

## Publishing needs

- The repository must be public: npm provenance is refused for private repositories.
- The workflow authenticates through npm's trusted publisher binding for this repository and workflow file, created
  with `npm trust github @pelotech/guacamole-common-js --file release.yaml --repository pelotech/guacamole-common-js
--allow-stage-publish`. No token is stored anywhere; the binding allows staging only, and approving takes a
  maintainer's 2FA.
- Staging needs the package to exist on the registry, so the very first version was published by a maintainer from a
  checkout: `npm run build && npm test && npm publish --provenance=false`.
- A push to `main` while a version is staged and awaiting approval reports it as staged already and stops; approve
  or reject it and the next push behaves normally.

## Developing

`pre-commit install` sets up the hooks (conventional commits, yamllint, prettier). `npm run lint`, `npm run build`
and `npm test` are what CI runs.

## License

Apache-2.0, as upstream. See `LICENSE` and `NOTICE`.
